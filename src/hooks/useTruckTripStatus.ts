import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deriveRunStatus } from "@/lib/trip-status";
import { createDebouncer } from "@/lib/debounce-realtime";
import { deriveDriver } from "@/lib/derive-driver";
import { member3RoleLabel } from "@/lib/crew-roles";

export interface TruckTripStatus {
  truckId: string;
  tripId: string;
  label: string;
  color: string;
  patientName: string | null;
  destination: string | null;
  /** Most recent PCR timestamp recorded for this run */
  lastSignalAt: string | null;
  lastSignalLabel: string | null;
  complete: boolean;
  /** Derived from who is NOT charting the PCR. Display only. */
  driverLabel?: string | null;
  attendingMedicName?: string | null;
  thirdMemberLabel?: string | null;
}

const SIGNALS: Array<[key: string, label: string]> = [
  ["dispatch_time", "Dispatched"],
  ["at_scene_time", "On scene"],
  ["patient_contact_time", "Patient contact"],
  ["left_scene_time", "Left scene"],
  ["arrived_dropoff_at", "At destination"],
  ["in_service_time", "In service"],
];

function localDate() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Today's run status per truck, derived from the same PCR timestamps the
 * Dispatch Board reads — so the map and the board never disagree.
 */
export function useTruckTripStatus(companyId: string | null) {
  const [byTruck, setByTruck] = useState<Record<string, TruckTripStatus>>({});

  const fetchStatuses = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("trip_records")
      .select(
        "id, truck_id, crew_id, attending_medic_id, attending_medic_name, run_date, pcr_status, dispatch_time, at_scene_time, patient_contact_time, left_scene_time, arrived_dropoff_at, in_service_time, patient_name_override, destination_location"
      )
      .eq("company_id", companyId)
      .eq("run_date", localDate());

    // Crew roster for today, so the driver can be derived per truck.
    const { data: crewRows } = await supabase
      .from("crews")
      .select(
        "id, truck_id, member1_id, member2_id, member3_id, member3_role, member1:profiles!crews_member1_id_fkey(id, full_name), member2:profiles!crews_member2_id_fkey(id, full_name), member3:profiles!crews_member3_id_fkey(id, full_name)"
      )
      .eq("company_id", companyId)
      .eq("active_date", localDate());
    const crewByTruck = new Map<string, any>();
    for (const c of (crewRows ?? []) as any[]) crewByTruck.set(c.truck_id, c);

    const next: Record<string, TruckTripStatus> = {};
    for (const trip of (data ?? []) as Record<string, any>[]) {
      if (!trip.truck_id) continue;

      let lastSignalAt: string | null = null;
      let lastSignalLabel: string | null = null;
      for (const [key, label] of SIGNALS) {
        const ts = trip[key] as string | null;
        if (ts && (!lastSignalAt || new Date(ts) > new Date(lastSignalAt))) {
          lastSignalAt = ts;
          lastSignalLabel = label;
        }
      }

      const { label, color } = deriveRunStatus(trip);
      const complete = Boolean(trip.in_service_time) || trip.pcr_status === "submitted";
      const crew = crewByTruck.get(trip.truck_id);
      const derived = deriveDriver(
        crew
          ? {
              member1: { id: crew.member1_id ?? null, name: crew.member1?.full_name ?? null },
              member2: { id: crew.member2_id ?? null, name: crew.member2?.full_name ?? null },
              member3: { id: crew.member3_id ?? null, name: crew.member3?.full_name ?? null },
              member3Role: crew.member3_role ?? null,
            }
          : null,
        trip.attending_medic_id ?? null,
      );

      const entry: TruckTripStatus = {
        truckId: trip.truck_id,
        tripId: trip.id,
        label,
        color,
        patientName: trip.patient_name_override ?? null,
        destination: trip.destination_location ?? null,
        lastSignalAt,
        lastSignalLabel,
        complete,
        driverLabel: crew ? derived.label : null,
        attendingMedicName: trip.attending_medic_name ?? null,
        thirdMemberLabel:
          crew?.member3?.full_name && crew?.member3_role
            ? `${member3RoleLabel(crew.member3_role)} — ${crew.member3.full_name}`
            : null,
      };

      const current = next[trip.truck_id];
      // Prefer an in-progress run; otherwise keep the most recent signal.
      const better =
        !current ||
        (current.complete && !entry.complete) ||
        (current.complete === entry.complete &&
          new Date(entry.lastSignalAt ?? 0) > new Date(current.lastSignalAt ?? 0));
      if (better) next[trip.truck_id] = entry;
    }
    setByTruck(next);
  }, [companyId]);

  useEffect(() => {
    if (!companyId) {
      setByTruck({});
      return;
    }
    fetchStatuses();
    const debounced = createDebouncer(fetchStatuses, 800);
    const channel = supabase
      .channel("fleet_map_trip_status")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_records", filter: `company_id=eq.${companyId}` },
        () => debounced()
      )
      .subscribe();
    return () => {
      debounced.cancel?.();
      supabase.removeChannel(channel);
    };
  }, [companyId, fetchStatuses]);

  return { byTruck, refresh: fetchStatuses };
}

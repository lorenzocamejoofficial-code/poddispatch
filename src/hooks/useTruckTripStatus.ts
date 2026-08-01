import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deriveRunStatus } from "@/lib/trip-status";
import { createDebouncer } from "@/lib/debounce-realtime";

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
        "id, truck_id, run_date, pcr_status, dispatch_time, at_scene_time, patient_contact_time, left_scene_time, arrived_dropoff_at, in_service_time, patient_first_name, patient_last_name, destination_location"
      )
      .eq("company_id", companyId)
      .eq("run_date", localDate());

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
      const entry: TruckTripStatus = {
        truckId: trip.truck_id,
        tripId: trip.id,
        label,
        color,
        patientName:
          [trip.patient_first_name, trip.patient_last_name].filter(Boolean).join(" ") || null,
        destination: trip.destination_location ?? null,
        lastSignalAt,
        lastSignalLabel,
        complete,
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

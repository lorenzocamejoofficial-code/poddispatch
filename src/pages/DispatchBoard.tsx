import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TruckCard } from "@/components/dispatch/TruckCard";
import { AlertsPanel } from "@/components/dispatch/AlertsPanel";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useSchedulingStore } from "@/hooks/useSchedulingStore";
import { computeCleanTripStatus } from "@/lib/billing-utils";
import type { Database } from "@/integrations/supabase/types";

type RunStatus = Database["public"]["Enums"]["run_status"];
type BillingStatus = "clean" | "missing_pcs" | "blocked_auth" | "blocked_other" | "not_ready" | null;

interface TruckData {
  id: string;
  name: string;
  crewNames: string[];
  scheduledLegsCount: number;
  runs: {
    id: string;
    patient_name: string;
    pickup_time: string | null;
    status: RunStatus;
    trip_type: string;
    is_current: boolean;
    patient_weight?: number | null;
    billing_status?: BillingStatus;
    billing_issues?: string[];
    hcpcs_codes?: string[];
    hcpcs_modifiers?: string[];
    loaded_miles?: number | null;
    estimated_charge?: number | null;
  }[];
  overallStatus: "green" | "yellow" | "red";
  downStatus: "down_maintenance" | "down_out_of_service" | null;
  downReason: string | null;
}

interface AlertData {
  id: string;
  message: string;
  severity: "yellow" | "red";
  created_at: string;
}

function computeOverallStatus(runs: { status: RunStatus }[]): "green" | "yellow" | "red" {
  if (runs.length === 0) return "green";
  const statuses = runs.map((r) => r.status);
  if (statuses.some((s) => s === "pending")) return "yellow";
  return "green";
}

function deriveBillingStatus(trip: any, payerRulesMap: Map<string, any>): { status: BillingStatus; issues: string[] } {
  if (!trip) return { status: null, issues: [] };
  // Only show billing status for completed+ trips
  const completedStatuses = ["completed", "ready_for_billing"];
  if (!completedStatuses.includes(trip.status)) return { status: "not_ready", issues: [] };

  const result = computeCleanTripStatus(
    trip,
    payerRulesMap.get(trip.payer_type ?? "") ?? null,
    { auth_required: trip.auth_required, auth_expiration: trip.auth_expiration }
  );

  if (result.level === "clean") return { status: "clean", issues: [] };
  if (result.level === "review") {
    if (result.issues.some(i => i.toLowerCase().includes("pcs"))) return { status: "missing_pcs", issues: result.issues };
    return { status: "missing_pcs", issues: result.issues };
  }
  if (result.issues.some(i => i.toLowerCase().includes("auth"))) return { status: "blocked_auth", issues: result.issues };
  return { status: "blocked_other", issues: result.issues };
}

export default function DispatchBoard() {
  const { selectedDate } = useSchedulingStore();
  const [trucks, setTrucks] = useState<TruckData[]>([]);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const [
      { data: truckRows },
      { data: crewRows },
      { data: slotRows },
      { data: alertRows },
      { data: availRows },
      { data: tripRows },
      { data: payerRules },
    ] = await Promise.all([
      supabase.from("trucks").select("*").eq("active", true),
      supabase.from("crews")
        .select("*, member1:profiles!crews_member1_id_fkey(full_name), member2:profiles!crews_member2_id_fkey(full_name)")
        .eq("active_date", selectedDate),
      supabase
        .from("truck_run_slots")
        .select("id, truck_id, leg_id, slot_order, status, leg:scheduling_legs!truck_run_slots_leg_id_fkey(id, pickup_time, trip_type, patient:patients!scheduling_legs_patient_id_fkey(first_name, last_name, weight_lbs, primary_payer, auth_required, auth_expiration))")
        .eq("run_date", selectedDate)
        .order("slot_order"),
      supabase.from("alerts").select("*").eq("dismissed", false).order("created_at", { ascending: false }),
      supabase.from("truck_availability" as any).select("*").lte("start_date", selectedDate).gte("end_date", selectedDate),
      // Fetch trip records for billing status
      supabase.from("trip_records" as any).select("*").eq("run_date", selectedDate),
      supabase.from("payer_billing_rules" as any).select("*"),
    ]);

    const availMap = new Map<string, { status: string; reason: string | null }>(
      ((availRows ?? []) as any[]).map((a: any) => [a.truck_id, { status: a.status, reason: a.reason ?? null }])
    );

    // Build trip map by slot_id for billing status lookup
    const tripBySlot = new Map<string, any>();
    ((tripRows ?? []) as any[]).forEach((t: any) => {
      if (t.slot_id) tripBySlot.set(t.slot_id, t);
    });

    // Build payer rules map
    const prMap = new Map<string, any>();
    ((payerRules ?? []) as any[]).forEach((r: any) => prMap.set(r.payer_type, r));

    const truckData: TruckData[] = (truckRows ?? []).map((t) => {
      const crew = crewRows?.find((c) => c.truck_id === t.id);
      const crewNames: string[] = [];
      if (crew) {
        if (crew.member1?.full_name) crewNames.push(crew.member1.full_name);
        if (crew.member2?.full_name) crewNames.push(crew.member2.full_name);
      }

      const truckSlots = ((slotRows ?? []) as any[])
        .filter((s) => s.truck_id === t.id)
        .sort((a, b) => (a.slot_order ?? 0) - (b.slot_order ?? 0));

      const truckRuns = truckSlots.map((s) => {
        const leg = s.leg as any;
        const patient = leg?.patient;
        const patientName = patient
          ? `${patient.first_name} ${patient.last_name}`
          : "Unknown";

        // Lookup trip record for billing data
        const tripRecord = tripBySlot.get(s.id);
        const billingData = deriveBillingStatus(
          tripRecord ? { ...tripRecord, auth_required: patient?.auth_required, auth_expiration: patient?.auth_expiration, payer_type: patient?.primary_payer } : null,
          prMap
        );

        return {
          id: s.id,
          patient_name: patientName,
          pickup_time: leg?.pickup_time ?? null,
          status: (s.status ?? "pending") as RunStatus,
          trip_type: leg?.trip_type ?? "dialysis",
          is_current: false,
          patient_weight: patient?.weight_lbs ?? null,
          billing_status: billingData.status,
          billing_issues: billingData.issues,
          hcpcs_codes: tripRecord?.hcpcs_codes ?? [],
          hcpcs_modifiers: tripRecord?.hcpcs_modifiers ?? [],
          loaded_miles: tripRecord?.loaded_miles ?? null,
          estimated_charge: null, // computed later if charge master available
        };
      });

      // Mark first non-completed as "current"
      const currentIdx = truckRuns.findIndex((r) => r.status !== "completed");
      if (currentIdx >= 0) truckRuns[currentIdx].is_current = true;

      const avail = availMap.get(t.id);

      return {
        id: t.id,
        name: t.name,
        crewNames,
        scheduledLegsCount: truckSlots.length,
        runs: truckRuns,
        overallStatus: computeOverallStatus(truckRuns),
        downStatus: (avail?.status as "down_maintenance" | "down_out_of_service" | null) ?? null,
        downReason: avail?.reason ?? null,
      };
    });

    setTrucks(truckData);
    setAlerts(
      (alertRows ?? []).map((a) => ({
        id: a.id,
        message: a.message,
        severity: a.severity as "yellow" | "red",
        created_at: a.created_at,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    fetchData();

    const channel = supabase
      .channel("dispatch-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "truck_run_slots" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "scheduling_legs" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "crews" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "truck_availability" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_records" }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedDate]);

  const dismissAlert = async (id: string) => {
    await supabase.from("alerts").update({ dismissed: true }).eq("id", id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const dateLabel = new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <AdminLayout>
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          Loading dispatch board...
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Dispatch Board</p>
            <h2 className="text-lg font-bold text-foreground">{dateLabel}</h2>
          </div>

          {/* Alerts */}
          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Alerts
            </h3>
            <AlertsPanel alerts={alerts} onDismiss={dismissAlert} />
          </section>

          {/* Trucks */}
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Trucks
            </h3>
            {trucks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No trucks configured. Add trucks in the Trucks & Crews section.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {trucks.map((t) => (
                  <TruckCard
                    key={t.id}
                    truckName={t.name}
                    crewNames={t.crewNames}
                    scheduledLegsCount={t.scheduledLegsCount}
                    runs={t.runs}
                    overallStatus={t.overallStatus}
                    downStatus={t.downStatus}
                    downReason={t.downReason}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </AdminLayout>
  );
}

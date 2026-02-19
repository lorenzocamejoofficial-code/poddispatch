import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TruckCard } from "@/components/dispatch/TruckCard";
import { AlertsPanel } from "@/components/dispatch/AlertsPanel";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useSchedulingStore } from "@/hooks/useSchedulingStore";
import type { Database } from "@/integrations/supabase/types";

type RunStatus = Database["public"]["Enums"]["run_status"];

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

export default function DispatchBoard() {
  const { selectedDate } = useSchedulingStore();
  const [trucks, setTrucks] = useState<TruckData[]>([]);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const [{ data: truckRows }, { data: crewRows }, { data: runRows }, { data: slotRows }, { data: alertRows }, { data: availRows }] = await Promise.all([
      supabase.from("trucks").select("*").eq("active", true),
      supabase.from("crews")
        .select("*, member1:profiles!crews_member1_id_fkey(full_name), member2:profiles!crews_member2_id_fkey(full_name)")
        .eq("active_date", selectedDate),
      supabase.from("runs")
        .select("*, patient:patients!runs_patient_id_fkey(first_name, last_name, weight_lbs)")
        .eq("run_date", selectedDate)
        .order("sort_order"),
      supabase.from("truck_run_slots").select("truck_id, leg_id").eq("run_date", selectedDate),
      supabase.from("alerts").select("*").eq("dismissed", false).order("created_at", { ascending: false }),
      supabase.from("truck_availability" as any).select("*").lte("start_date", selectedDate).gte("end_date", selectedDate),
    ]);

    const availMap = new Map<string, { status: string; reason: string | null }>(
      ((availRows ?? []) as any[]).map((a: any) => [a.truck_id, { status: a.status, reason: a.reason ?? null }])
    );

    const truckData: TruckData[] = (truckRows ?? []).map((t) => {
      const crew = crewRows?.find((c) => c.truck_id === t.id);
      const crewNames: string[] = [];
      if (crew) {
        if (crew.member1?.full_name) crewNames.push(crew.member1.full_name);
        if (crew.member2?.full_name) crewNames.push(crew.member2.full_name);
      }

      const truckRuns = (runRows ?? [])
        .filter((r) => r.truck_id === t.id)
        .map((r) => {
          const patientName = r.patient
            ? `${r.patient.first_name} ${r.patient.last_name}`
            : "Unknown";
          return {
            id: r.id,
            patient_name: patientName,
            pickup_time: r.pickup_time,
            status: r.status,
            trip_type: r.trip_type,
            is_current: false,
            patient_weight: r.patient?.weight_lbs ?? null,
          };
        });

      const currentIdx = truckRuns.findIndex((r) => r.status !== "completed");
      if (currentIdx >= 0) truckRuns[currentIdx].is_current = true;

      const scheduledLegsCount = (slotRows ?? []).filter((s) => s.truck_id === t.id).length;
      const avail = availMap.get(t.id);

      return {
        id: t.id,
        name: t.name,
        crewNames,
        scheduledLegsCount,
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
      .on("postgres_changes", { event: "*", schema: "public", table: "runs" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "status_updates" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => fetchData())
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
                  <TruckCard key={t.id} truckName={t.name} crewNames={t.crewNames} scheduledLegsCount={t.scheduledLegsCount} runs={t.runs} overallStatus={t.overallStatus} downStatus={t.downStatus} downReason={t.downReason} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </AdminLayout>
  );
}

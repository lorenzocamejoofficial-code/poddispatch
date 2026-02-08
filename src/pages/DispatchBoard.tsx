import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TruckCard } from "@/components/dispatch/TruckCard";
import { AlertsPanel } from "@/components/dispatch/AlertsPanel";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { Database } from "@/integrations/supabase/types";

type RunStatus = Database["public"]["Enums"]["run_status"];

interface TruckData {
  id: string;
  name: string;
  crewNames: string[];
  runs: {
    id: string;
    patient_name: string;
    pickup_time: string | null;
    status: RunStatus;
    trip_type: string;
    is_current: boolean;
  }[];
  overallStatus: "green" | "yellow" | "red";
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
  const [trucks, setTrucks] = useState<TruckData[]>([]);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split("T")[0];

  const fetchData = async () => {
    // Fetch trucks
    const { data: truckRows } = await supabase.from("trucks").select("*").eq("active", true);

    // Fetch today's crews
    const { data: crewRows } = await supabase
      .from("crews")
      .select("*, member1:profiles!crews_member1_id_fkey(full_name), member2:profiles!crews_member2_id_fkey(full_name)")
      .eq("active_date", today);

    // Fetch today's runs
    const { data: runRows } = await supabase
      .from("runs")
      .select("*, patient:patients!runs_patient_id_fkey(first_name, last_name)")
      .eq("run_date", today)
      .order("sort_order");

    // Fetch active alerts
    const { data: alertRows } = await supabase
      .from("alerts")
      .select("*")
      .eq("dismissed", false)
      .order("created_at", { ascending: false });

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
          };
        });

      // Mark first non-completed run as current
      const currentIdx = truckRuns.findIndex((r) => r.status !== "completed");
      if (currentIdx >= 0) truckRuns[currentIdx].is_current = true;

      return {
        id: t.id,
        name: t.name,
        crewNames,
        runs: truckRuns,
        overallStatus: computeOverallStatus(truckRuns),
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
    fetchData();

    // Subscribe to real-time run updates
    const channel = supabase
      .channel("dispatch-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "runs" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "status_updates" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const dismissAlert = async (id: string) => {
    await supabase.from("alerts").update({ dismissed: true }).eq("id", id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <AdminLayout>
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          Loading dispatch board...
        </div>
      ) : (
        <div className="space-y-6">
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
              Today's Trucks
            </h3>
            {trucks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No trucks configured. Add trucks in the Trucks & Crews section.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {trucks.map((t) => (
                  <TruckCard key={t.id} truckName={t.name} crewNames={t.crewNames} runs={t.runs} overallStatus={t.overallStatus} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </AdminLayout>
  );
}

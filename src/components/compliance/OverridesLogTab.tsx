import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShieldAlert, RefreshCw } from "lucide-react";
import { useSimulationSession } from "@/hooks/useSimulationSession";

/**
 * Audit-only view of every billing override. Lives in Compliance & QA
 * (history bucket). Money page no longer carries this — billers don't
 * act on it day-to-day; owners/auditors review it after the fact.
 */
export function OverridesLogTab() {
  const { simulationRunId } = useSimulationSession();
  const [logs, setLogs] = useState<any[]>([]);
  const [sort, setSort] = useState<"date" | "user" | "reason">("date");

  const fetchLogs = useCallback(async () => {
    const tripScope = simulationRunId
      ? await supabase.from("trip_records" as any).select("id").eq("simulation_run_id", simulationRunId)
      : { data: [] as any[] };
    const scopedTripIds = simulationRunId ? (tripScope.data ?? []).map((t: any) => t.id) : null;

    let q = supabase
      .from("billing_overrides" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (simulationRunId) {
      if (!scopedTripIds?.length) { setLogs([]); return; }
      q = q.in("trip_id", scopedTripIds);
    }

    const { data } = await q;
    if (!data?.length) { setLogs([]); return; }

    const tripIds = [...new Set((data as any[]).map((d: any) => d.trip_id).filter(Boolean))];
    const { data: tripRows } = tripIds.length > 0
      ? await supabase.from("trip_records" as any).select("id, patient_id, run_date").in("id", tripIds)
      : { data: [] };
    const patientIds = [...new Set((tripRows ?? []).map((t: any) => t.patient_id).filter(Boolean))];
    const { data: pRows } = patientIds.length > 0
      ? await supabase.from("patients").select("id, first_name, last_name").in("id", patientIds)
      : { data: [] };

    const tripMap = new Map((tripRows ?? []).map((t: any) => [t.id, t]));
    const pMap = new Map((pRows ?? []).map((p: any) => [p.id, `${p.first_name} ${p.last_name}`]));

    setLogs((data as any[]).map((o: any) => {
      const trip = tripMap.get(o.trip_id) as any;
      return {
        ...o,
        patient_name: trip ? pMap.get(trip.patient_id) ?? "Unknown" : "Unknown",
        run_date: trip?.run_date ?? "—",
      };
    }));
  }, [simulationRunId]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">All Billing Overrides</p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Sort by:</span>
          {(["date", "user", "reason"] as const).map(s => (
            <Button
              key={s}
              variant={sort === s ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs capitalize"
              onClick={() => setSort(s)}
            >
              {s}
            </Button>
          ))}
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={fetchLogs}>
            <RefreshCw className="h-3 w-3 mr-1" />Refresh
          </Button>
        </div>
      </div>
      {logs.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <ShieldAlert className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No billing overrides recorded yet</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="border-b bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Patient / Trip</th>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Reason</th>
                <th className="px-4 py-3 text-left">Original Blockers</th>
              </tr>
            </thead>
            <tbody>
              {[...logs]
                .sort((a, b) => {
                  if (sort === "date") return new Date(b.created_at ?? b.overridden_at).getTime() - new Date(a.created_at ?? a.overridden_at).getTime();
                  if (sort === "user") return (a.user_id ?? a.overridden_by ?? "").localeCompare(b.user_id ?? b.overridden_by ?? "");
                  return (a.reason ?? a.override_reason ?? "").localeCompare(b.reason ?? b.override_reason ?? "");
                })
                .map((o: any) => (
                  <tr key={o.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {new Date(o.created_at ?? o.overridden_at).toLocaleDateString()}<br />
                      <span className="text-muted-foreground">{new Date(o.created_at ?? o.overridden_at).toLocaleTimeString()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium">{o.patient_name}</p>
                      <p className="text-[10px] text-muted-foreground">{o.run_date}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                      {(o.user_id ?? o.overridden_by)?.slice(0, 8) ?? "—"}…
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[200px] truncate">{o.reason ?? o.override_reason}</td>
                    <td className="px-4 py-3 text-[10px] text-muted-foreground max-w-[200px] truncate">
                      {(o.snapshot ?? o.previous_blockers_snapshot)
                        ? (((o.snapshot ?? o.previous_blockers_snapshot) as any)?.blockers?.join(", ") ||
                           ((o.snapshot ?? o.previous_blockers_snapshot) as any)?.missing?.join(", ") ||
                           (o.previous_blockers ?? []).join(", ") ||
                           "—")
                        : "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
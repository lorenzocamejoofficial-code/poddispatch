import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldCheck, AlertTriangle, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Report = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  scenario_seconds: number | null;
  tenant_count: number | null;
  summary: any;
  isolation_results: any;
  latency_results: any;
};

export function LoadTestHarnessPanel() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [scenarioSeconds, setScenarioSeconds] = useState(45);

  const load = async () => {
    setLoading(true);
    // Reap any zombies (workers that died past the ~150s wall-clock and left
    // a row stuck in 'running'). Safe to call repeatedly; it's a no-op when
    // nothing is stale.
    await supabase.rpc("reap_stale_loadtest_reports" as any).then(({ error }) => {
      if (error && !/Forbidden/i.test(error.message)) {
        console.warn("reap_stale_loadtest_reports:", error.message);
      }
    });
    const { data, error } = await supabase
      .from("loadtest_reports" as any)
      .select("*")
      .order("started_at", { ascending: false })
      .limit(20);
    if (error) toast.error(error.message);
    else setReports((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Poll while a run is in progress
  useEffect(() => {
    // Only poll for runs that are genuinely in flight (started within last 10 min).
    // Older "running" rows are stale workers that died — the janitor will fail them.
    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    const hasFreshRunning = reports.some(
      (r) => r.status === "running" && new Date(r.started_at).getTime() > tenMinAgo
    );
    if (!hasFreshRunning && !running) return;
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [reports, running]);

  const trigger = async () => {
    // Guard against double-launch: if a fresh run is already in flight, refuse.
    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    const hasFreshRunning = reports.some(
      (r) => r.status === "running" && new Date(r.started_at).getTime() > tenMinAgo
    );
    if (hasFreshRunning) {
      toast.error("A load test is already running. Wait for it to finish before starting another.");
      setConfirmOpen(false);
      setConfirmText("");
      return;
    }
    setConfirmOpen(false);
    setRunning(true);
    toast.info("Load test starting, runs in the background for ~" + (scenarioSeconds + 90) + "s. You can leave this page; results will appear here when finished.");
    try {
      const { data, error } = await supabase.functions.invoke("loadtest-harness", {
        body: { scenario_seconds: scenarioSeconds },
      });
      if (error) throw error;
      // Function returns immediately (202) with report_id; real status arrives via polling.
      const reportId = (data as any)?.report_id;
      if (reportId) toast.success("Load test queued — polling for results…");
      else toast.warning("Load test started but no report id was returned.");
      await load();
    } catch (e: any) {
      toast.error(`Failed to start load test: ${e?.message ?? "unknown"}`);
    } finally {
      // Stop the "running" button state once the kickoff returns; polling continues
      // for as long as any report row is still in 'running' status.
      setRunning(false);
      setConfirmText("");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Load Test & HIPAA Isolation Harness
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Seeds 10 disposable tenants with real auth users, runs a parallel scenario,
              probes every tenant-scoped table for cross-tenant leakage with real JWTs,
              then soft-archives the tenants.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
              Run Load Test
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            </div>
          ) : reports.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No load tests have been run yet.</p>
          ) : (
            <div className="space-y-3">
              {reports.map((r) => <ReportCard key={r.id} report={r} />)}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={(o) => { if (!o) { setConfirmOpen(false); setConfirmText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Load Test Harness</DialogTitle>
            <DialogDescription>
              This will create 10 disposable test tenants (LOADTEST-001 … LOADTEST-010) with real
              auth users, run a {scenarioSeconds}-second parallel scenario, probe every
              tenant-scoped table for cross-tenant leakage, then soft-archive the tenants.
              The tab must stay open for ~{scenarioSeconds + 60} seconds.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Scenario duration (15–90s)</label>
              <Input
                type="number" min={15} max={90} value={scenarioSeconds}
                onChange={(e) => setScenarioSeconds(Math.min(90, Math.max(15, Number(e.target.value) || 45)))}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Type <strong>RUN LOADTEST</strong> to confirm:</p>
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="RUN LOADTEST" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setConfirmOpen(false); setConfirmText(""); }}>Cancel</Button>
            <Button onClick={trigger} disabled={confirmText !== "RUN LOADTEST" || running}>
              {running && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReportCard({ report }: { report: Report }) {
  const s = report.summary ?? {};
  const violations: string[] = s.violations ?? [];
  const leaks: any[] = report.isolation_results ?? [];
  const pass = s.pass === true;
  const isRunning = report.status === "running";
  return (
    <div className="border rounded-md p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : pass ? (
            <ShieldCheck className="h-4 w-4 text-green-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          )}
          <span className="text-sm font-medium">
            {format(new Date(report.started_at), "MMM d, yyyy HH:mm:ss")}
          </span>
          <Badge variant={isRunning ? "secondary" : pass ? "default" : "destructive"}>
            {report.status}
          </Badge>
          {report.scenario_seconds && (
            <span className="text-xs text-muted-foreground">scenario {report.scenario_seconds}s</span>
          )}
        </div>
      </div>

      {!isRunning && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
            <Stat label="Tenants seeded" value={s.tenants_seeded ?? "—"} />
            <Stat label="Tenants archived" value={s.tenants_archived ?? "—"} />
            <Stat label="Probes run" value={s.probes_run ?? "—"} />
            <Stat
              label="Isolation leaks"
              value={s.isolation_leaks ?? "—"}
              danger={(s.isolation_leaks ?? 0) > 0}
            />
            <Stat label="Total ops" value={s.total_ops ?? "—"} />
            <Stat label="Op errors" value={s.op_errors ?? "—"} danger={(s.op_errors ?? 0) > 0} />
            <Stat label="Error rate" value={`${s.error_rate_pct ?? "—"}%`} danger={(s.error_rate_pct ?? 0) > 0.5} />
            <Stat label="Total runtime" value={`${Math.round(((s.seed_ms ?? 0) + (s.probe_ms ?? 0) + (s.load_ms ?? 0) + (s.archive_ms ?? 0)) / 100) / 10}s`} />
          </div>

          {report.latency_results && (
            <div className="mt-3">
              <p className="text-xs font-semibold mb-1">Latency (ms)</p>
              <table className="text-xs w-full">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="text-left py-1">op</th>
                    <th className="text-right">n</th>
                    <th className="text-right">p50</th>
                    <th className="text-right">p95</th>
                    <th className="text-right">p99</th>
                    <th className="text-right">max</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(report.latency_results).map(([op, v]: [string, any]) => (
                    <tr key={op}>
                      <td className="py-1">{op}</td>
                      <td className="text-right">{v.n}</td>
                      <td className="text-right">{v.p50}</td>
                      <td className="text-right">{v.p95}</td>
                      <td className="text-right">{v.p99}</td>
                      <td className="text-right">{v.max}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {violations.length > 0 && (
            <div className="mt-3 p-2 rounded bg-amber-500/10 border border-amber-500/30">
              <p className="text-xs font-semibold text-amber-700 mb-1">Threshold violations</p>
              <ul className="text-xs space-y-0.5">
                {violations.map((v, i) => <li key={i}>• {v}</li>)}
              </ul>
            </div>
          )}

          {leaks.length > 0 && (
            <div className="mt-3 p-2 rounded bg-destructive/10 border border-destructive/30">
              <p className="text-xs font-semibold text-destructive mb-1">⚠ HIPAA isolation leaks</p>
              <ul className="text-xs space-y-0.5 font-mono">
                {leaks.slice(0, 20).map((l, i) => (
                  <li key={i}>{l.tenant} → {l.table}: {l.visible_other_rows} row(s)</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: any; danger?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${danger ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}
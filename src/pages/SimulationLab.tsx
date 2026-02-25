import { useState, useCallback, useEffect } from "react";
import { CreatorLayout } from "@/components/layout/CreatorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  FlaskConical, Zap, ShieldCheck, Camera, RotateCcw, Loader2,
  CheckCircle2, XCircle, AlertTriangle, Truck, Users, Activity,
  Clock, Ban, UserX, Plus, Wrench, Play, ExternalLink,
  BarChart3, Flame,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { SimulationSummary } from "@/components/simulation/SimulationSummary";

type CheckResult = { name: string; category: string; pass: boolean; reason: string };
type SandboxStatus = { companyId: string; trucks: number; patients: number; trips: number; crews: number; recentRuns: any[] };

const SCENARIOS = [
  { key: "dialysis_heavy", label: "Dialysis Heavy Day", desc: "6 trucks, 40 patients, 30+ dialysis trips", group: "standard" },
  { key: "mixed_day", label: "Dialysis + Discharge Mix", desc: "Mixed IFT day with discharge volume", group: "standard" },
  { key: "stress_test", label: "Late Adds + Cancellations", desc: "50 patients, high chaos, missing fields", group: "standard" },
  { key: "billing_risk", label: "Billing Risk Day", desc: "Many missing PCS, auth, signatures", group: "standard" },
  { key: "facility_delay", label: "Facility Delay Day", desc: "B-leg timing pressure, late pickups", group: "standard" },
  { key: "dispatch_overload", label: "Dispatch Overload", desc: "4 trucks, 45 patients — cascade failure", group: "cascade" },
  { key: "crew_mismatch", label: "Crew Mismatch Day", desc: "Heavy patients + undertrained crews", group: "cascade" },
  { key: "revenue_leak", label: "Revenue Leak Day", desc: "PCR failures + billing cascade", group: "cascade" },
];

const EVENTS = [
  { key: "facility_behind", label: "Facility Running Behind", icon: Clock, desc: "Adds 30min to B-leg pickups" },
  { key: "crew_slow", label: "Crew Moving Slow", icon: Truck, desc: "Adds turnaround delay" },
  { key: "patient_not_ready", label: "Patient Not Ready", icon: UserX, desc: "Marks trips as not ready" },
  { key: "late_add_discharge", label: "Late Add Discharge", icon: Plus, desc: "Inserts mid-day discharge" },
  { key: "cancel_no_show", label: "Cancel / No Show", icon: Ban, desc: "Cancels scheduled trips" },
  { key: "truck_down", label: "Truck Down", icon: Wrench, desc: "Disables truck, unassigns runs" },
  { key: "cascade_pressure", label: "Cascade Pressure", icon: Flame, desc: "Combined: delay + slow + late add + PCR degrade" },
];

export default function SimulationLab() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState<string | null>(null);
  const [status, setStatus] = useState<SandboxStatus | null>(null);
  const [checks, setChecks] = useState<CheckResult[] | null>(null);
  const [snapshotName, setSnapshotName] = useState("");
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [seedResult, setSeedResult] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries();
    window.dispatchEvent(new CustomEvent("simulation-refresh"));
  }, [queryClient]);

  const callLab = useCallback(async (body: any) => {
    const { data, error } = await supabase.functions.invoke("simulation-lab", { body });
    if (error) throw new Error(error.message);
    if (!data?.ok) throw new Error(data?.error || "Unknown error");
    return data.result;
  }, []);

  const loadStatus = useCallback(async () => {
    setLoading("status");
    try {
      const result = await callLab({ action: "status" });
      setStatus(result);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoading(null);
  }, [callLab, toast]);

  const seedScenario = async (scenario: string) => {
    setLoading(`seed_${scenario}`);
    try {
      const result = await callLab({ action: "seed", scenario });
      setSeedResult(result);
      setSummary(null);
      toast({ title: "Scenario Seeded", description: `${result.scenario}: ${result.tripCount} trips across ${result.truckCount} trucks` });
      invalidateAll();
      loadStatus();
    } catch (e: any) {
      toast({ title: "Seed Failed", description: e.message, variant: "destructive" });
    }
    setLoading(null);
  };

  const injectEvent = async (eventType: string) => {
    setLoading(`inject_${eventType}`);
    try {
      const result = await callLab({ action: "inject", eventType });
      toast({ title: "Event Injected", description: result.description });
      setSummary(null);
      invalidateAll();
    } catch (e: any) {
      toast({ title: "Inject Failed", description: e.message, variant: "destructive" });
    }
    setLoading(null);
  };

  const runChecks = async () => {
    setLoading("checks");
    try {
      const result = await callLab({ action: "check" });
      setChecks(result);
    } catch (e: any) {
      toast({ title: "Check Failed", description: e.message, variant: "destructive" });
    }
    setLoading(null);
  };

  const runSummary = async () => {
    setLoading("summary");
    try {
      const result = await callLab({ action: "summary" });
      setSummary(result);
    } catch (e: any) {
      toast({ title: "Summary Failed", description: e.message, variant: "destructive" });
    }
    setLoading(null);
  };

  const resetSandbox = async () => {
    setLoading("reset");
    try {
      const result = await callLab({ action: "reset" });
      const totalDeleted = Object.values(result as Record<string, number>).reduce((a, b) => a + b, 0);
      toast({ title: "Sandbox Reset", description: `${totalDeleted} records removed` });
      setChecks(null);
      setSeedResult(null);
      setSummary(null);
      invalidateAll();
      loadStatus();
    } catch (e: any) {
      toast({ title: "Reset Failed", description: e.message, variant: "destructive" });
    }
    setLoading(null);
  };

  const saveSnapshot = async () => {
    if (!snapshotName.trim()) return;
    setLoading("snapshot");
    try {
      const result = await callLab({ action: "snapshot", name: snapshotName.trim() });
      toast({ title: "Snapshot Saved", description: `"${result.name}" saved` });
      setSnapshotName("");
      loadSnapshots();
    } catch (e: any) {
      toast({ title: "Snapshot Failed", description: e.message, variant: "destructive" });
    }
    setLoading(null);
  };

  const loadSnapshots = async () => {
    try {
      const result = await callLab({ action: "list_snapshots" });
      setSnapshots(result ?? []);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadStatus(); loadSnapshots(); }, []);

  const dispatchChecks = checks?.filter(c => c.category === "dispatch") ?? [];
  const billingChecks = checks?.filter(c => c.category === "billing") ?? [];
  const safetyChecks = checks?.filter(c => c.category === "safety") ?? [];

  const standardScenarios = SCENARIOS.filter(s => s.group === "standard");
  const cascadeScenarios = SCENARIOS.filter(s => s.group === "cascade");

  return (
    <CreatorLayout title="Simulation Lab">
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5">
            <FlaskConical className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">Simulation Lab</h1>
            <p className="text-xs text-muted-foreground">Seed scenarios, inject events, run regression checks, and analyze cascade failures.</p>
          </div>
          <Badge variant="outline" className="text-[10px]">CREATOR ONLY</Badge>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs ml-auto"
            onClick={() => navigate("/simulation")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open Live App Simulation
          </Button>
        </div>

        {/* Sandbox Status */}
        {status && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatusCard icon={Truck} label="Trucks" value={status.trucks} />
            <StatusCard icon={Users} label="Patients" value={status.patients} />
            <StatusCard icon={Activity} label="Trips" value={status.trips} />
            <StatusCard icon={Users} label="Crews" value={status.crews} />
            <StatusCard icon={FlaskConical} label="Runs" value={status.recentRuns.length} />
          </div>
        )}

        {/* Scenario Seeder */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Play className="h-4 w-4 text-primary" />
              Scenario Seeder
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Standard Scenarios */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Standard Scenarios</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {standardScenarios.map(s => (
                  <ScenarioButton key={s.key} scenario={s} loading={loading} onSeed={seedScenario} />
                ))}
              </div>
            </div>

            {/* Cascade Scenarios */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-destructive mb-2 flex items-center gap-1">
                <Flame className="h-3 w-3" /> Cascade Failure Scenarios
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {cascadeScenarios.map(s => (
                  <ScenarioButton key={s.key} scenario={s} loading={loading} onSeed={seedScenario} cascade />
                ))}
              </div>
            </div>

            {seedResult && (
              <div className="rounded-md bg-primary/5 border border-primary/20 p-3 text-xs text-foreground">
                <strong>Last Seed:</strong> {seedResult.scenario} — {seedResult.tripCount} trips, {seedResult.truckCount} trucks, {seedResult.patientCount} patients
              </div>
            )}
          </CardContent>
        </Card>

        {/* Event Injection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-[hsl(var(--status-yellow))]" />
              Event Injection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {EVENTS.map(e => (
                <Button
                  key={e.key}
                  variant={e.key === "cascade_pressure" ? "destructive" : "outline"}
                  size="sm"
                  className="h-auto py-2.5 px-3 flex flex-col items-start gap-1 text-left"
                  onClick={() => injectEvent(e.key)}
                  disabled={loading !== null}
                >
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    <e.icon className="h-3.5 w-3.5" />
                    {e.label}
                  </span>
                  <span className="text-[10px] opacity-70 font-normal">{e.desc}</span>
                  {loading === `inject_${e.key}` && <Loader2 className="h-3 w-3 animate-spin" />}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* End-of-Day Summary */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                End-of-Day Simulation Summary
              </CardTitle>
              <Button size="sm" onClick={runSummary} disabled={loading !== null} className="gap-1.5 text-xs">
                {loading === "summary" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5" />}
                Generate Summary
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {summary ? (
              <SimulationSummary data={summary} />
            ) : (
              <p className="text-xs text-muted-foreground">Seed a scenario, inject events, then generate a summary to see the dispatch → crew → billing cascade.</p>
            )}
          </CardContent>
        </Card>

        {/* Regression Checks */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Regression Checks
              </CardTitle>
              <Button size="sm" onClick={runChecks} disabled={loading !== null} className="gap-1.5 text-xs">
                {loading === "checks" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                Run Checks
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {checks === null ? (
              <p className="text-xs text-muted-foreground">No checks run yet. Seed a scenario first, then run checks.</p>
            ) : (
              <div className="space-y-4">
                <CheckSection title="Dispatch" checks={dispatchChecks} />
                <CheckSection title="Safety" checks={safetyChecks} />
                <CheckSection title="Billing" checks={billingChecks} />
                <div className="flex items-center gap-2 pt-2 border-t">
                  {checks.every(c => c.pass) ? (
                    <Badge className="bg-[hsl(var(--status-green))]/10 text-[hsl(var(--status-green))] border-0 text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> All Checks Passed
                    </Badge>
                  ) : (
                    <Badge className="bg-destructive/10 text-destructive border-0 text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" /> {checks.filter(c => !c.pass).length} Failed
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Snapshot + Reset */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" />
              Snapshot & Reset
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Snapshot name..."
                value={snapshotName}
                onChange={e => setSnapshotName(e.target.value)}
                className="max-w-xs text-sm"
              />
              <Button size="sm" onClick={saveSnapshot} disabled={loading !== null || !snapshotName.trim()} className="gap-1.5 text-xs">
                {loading === "snapshot" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                Save Snapshot
              </Button>
            </div>

            {snapshots.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Saved Snapshots</p>
                {snapshots.map(s => (
                  <div key={s.id} className="flex items-center justify-between rounded border p-2 text-xs">
                    <span className="font-medium text-foreground">{s.name}</span>
                    <span className="text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t">
              <Button variant="destructive" size="sm" onClick={resetSandbox} disabled={loading !== null} className="gap-1.5 text-xs">
                {loading === "reset" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                Reset Sandbox
              </Button>
              <Button variant="outline" size="sm" onClick={() => { loadStatus(); loadSnapshots(); }} disabled={loading !== null} className="text-xs">
                Refresh Status
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </CreatorLayout>
  );
}

function StatusCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-3 pb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <div>
            <p className="text-xl font-bold text-foreground">{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScenarioButton({ scenario, loading, onSeed, cascade }: {
  scenario: { key: string; label: string; desc: string };
  loading: string | null;
  onSeed: (key: string) => void;
  cascade?: boolean;
}) {
  return (
    <button
      onClick={() => onSeed(scenario.key)}
      disabled={loading !== null}
      className={`rounded-lg border p-3 text-left transition-colors disabled:opacity-50 ${
        cascade
          ? "bg-destructive/5 hover:bg-destructive/10 border-destructive/20 hover:border-destructive/40"
          : "bg-card hover:bg-accent/50 hover:border-primary/30"
      }`}
    >
      <p className={`text-sm font-semibold ${cascade ? "text-destructive" : "text-foreground"}`}>{scenario.label}</p>
      <p className="text-xs text-muted-foreground mt-1">{scenario.desc}</p>
      {loading === `seed_${scenario.key}` && (
        <div className="flex items-center gap-1 mt-2 text-xs text-primary">
          <Loader2 className="h-3 w-3 animate-spin" /> Seeding...
        </div>
      )}
    </button>
  );
}

function CheckSection({ title, checks }: { title: string; checks: CheckResult[] }) {
  if (checks.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
      <div className="space-y-1.5">
        {checks.map((c, i) => <CheckRow key={i} check={c} />)}
      </div>
    </div>
  );
}

function CheckRow({ check }: { check: CheckResult }) {
  return (
    <div className="flex items-start gap-2 rounded-md border p-2">
      {check.pass ? (
        <CheckCircle2 className="h-4 w-4 text-[hsl(var(--status-green))] shrink-0 mt-0.5" />
      ) : (
        <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">{check.name}</p>
        <p className="text-[10px] text-muted-foreground">{check.reason}</p>
      </div>
      <Badge variant={check.pass ? "secondary" : "destructive"} className="text-[9px] shrink-0">
        {check.pass ? "PASS" : "FAIL"}
      </Badge>
    </div>
  );
}

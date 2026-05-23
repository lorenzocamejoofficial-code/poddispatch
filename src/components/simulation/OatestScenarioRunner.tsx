import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Play, Send, Rocket, CheckCircle2, XCircle, AlertTriangle, FlaskConical, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getLocalToday } from "@/lib/local-date";

type Scenario = {
  id: string;
  slug: string;
  name: string;
  description: string;
  transport_type: string;
  payer_type: string;
  expected_hcpcs: string | null;
  expected_modifiers: string[] | null;
  enabled: boolean;
};

type Run = {
  id: string;
  scenario_id: string;
  status: string;
  failure_stage: string | null;
  failure_summary: string | null;
  filename: string | null;
  ack_999_status: string | null;
  ack_277ca_status: string | null;
  started_at: string;
  completed_at: string | null;
  oatest_scenarios?: { slug: string; name: string } | null;
};

type Preconditions = {
  today: string;
  companyId: string;
  trucks: number;
  crews: number;
  crewsAssignedToday: number;
  trucksWithCrewToday: number;
  templatePatients: number;
  facilities: number;
  enabledScenarios: number;
  npiOnFile: boolean;
  taxIdOnFile: boolean;
};

const STATUS_TONE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  seeding: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  ready: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  submitted: "bg-primary/10 text-primary",
  failed: "bg-destructive/10 text-destructive",
};

export function OatestScenarioRunner() {
  const { toast } = useToast();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [pre, setPre] = useState<Preconditions | null>(null);
  const [preLoading, setPreLoading] = useState(false);
  const [runsPage, setRunsPage] = useState(0);
  const RUNS_PER_PAGE = 10;

  const loadScenarios = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("oatest_scenarios").select("*").eq("enabled", true).order("transport_type").order("slug");
    if (error) toast({ title: "Failed to load OATEST scenarios", description: error.message, variant: "destructive" });
    else setScenarios(data ?? []);
  }, [toast]);

  const loadRuns = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("oatest_runs")
      .select("id,scenario_id,status,failure_stage,failure_summary,filename,ack_999_status,ack_277ca_status,started_at,completed_at,oatest_scenarios(slug,name)")
      .order("started_at", { ascending: false }).limit(200);
    if (!error) setRuns(data ?? []);
  }, []);

  const loadPreconditions = useCallback(async () => {
    setPreLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("oatest-run", {
        body: { action: "preconditions", local_date: getLocalToday() },
      });
      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error ?? "unknown");
      setPre(data.preconditions as Preconditions);
    } catch (e: any) {
      toast({ title: "Failed to load OATEST preconditions", description: e.message, variant: "destructive" });
    } finally {
      setPreLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    Promise.all([loadScenarios(), loadRuns(), loadPreconditions()]).finally(() => setBootstrapping(false));
  }, [loadScenarios, loadRuns, loadPreconditions]);

  const trigger = async (slug: string, action: "seed" | "submit" | "seed_and_submit") => {
    setLoading(`${slug}_${action}`);
    try {
      // Send the browser-local date so the runner's seeder preconditions
      // (active truck + crew assigned today) line up with what the user sees
      // in Sim Lab. Without this, UTC rollover reports "0 crews today".
      const { data, error } = await supabase.functions.invoke("oatest-run", {
        body: { action, scenario_slug: slug, local_date: getLocalToday() },
      });
      if (error) throw new Error(error.message);
      if (!data?.ok) {
        toast({
          title: `OATEST ${action} failed`,
          description: `${data?.stage ? `[${data.stage}] ` : ""}${data?.error ?? "unknown"}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: `OATEST ${action} ok`,
          description: action === "submit" || action === "seed_and_submit"
            ? `Queued ${data.filename}`
            : `Seeded scenario ${data.scenario}`,
        });
      }
      await loadRuns();
      await loadPreconditions();
    } catch (e: any) {
      toast({ title: "OATEST call failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const grouped = scenarios.reduce<Record<string, Scenario[]>>((acc, s) => {
    (acc[s.transport_type] ??= []).push(s);
    return acc;
  }, {});

  const totalPages = Math.max(1, Math.ceil(runs.length / RUNS_PER_PAGE));
  const currentPage = Math.min(runsPage, totalPages - 1);
  const pagedRuns = runs.slice(currentPage * RUNS_PER_PAGE, (currentPage + 1) * RUNS_PER_PAGE);

  return (
    <div className="space-y-4">
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Seeder preconditions ({pre?.today ?? "—"})</CardTitle>
            <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={loadPreconditions} disabled={preLoading}>
              {preLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {!pre ? (
            <p className="text-xs text-muted-foreground">Loading preconditions…</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              {[
                { label: "Active trucks", value: pre.trucks, ok: pre.trucks > 0 },
                { label: "Crews (total)", value: pre.crews, ok: pre.crews > 0 },
                { label: "Crews assigned today", value: pre.crewsAssignedToday, ok: pre.crewsAssignedToday > 0 },
                { label: "Trucks w/ crew today", value: pre.trucksWithCrewToday, ok: pre.trucksWithCrewToday > 0 },
                { label: "Template patients", value: pre.templatePatients, ok: pre.templatePatients > 0 },
                { label: "Facilities", value: pre.facilities, ok: pre.facilities > 0 },
                { label: "Enabled scenarios", value: pre.enabledScenarios, ok: pre.enabledScenarios > 0 },
                { label: "Provider NPI + EIN", value: pre.npiOnFile && pre.taxIdOnFile ? "yes" : "no", ok: pre.npiOnFile && pre.taxIdOnFile },
              ].map(s => (
                <div key={s.label} className={`rounded-md border p-2 ${s.ok ? "" : "border-destructive/40 bg-destructive/5"}`}>
                  <p className="text-muted-foreground">{s.label}</p>
                  <p className={`font-semibold ${s.ok ? "text-foreground" : "text-destructive"}`}>{String(s.value)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-primary" />
              OATEST Scenario Runner
            </CardTitle>
            <Badge variant="outline" className="text-[10px]">{scenarios.length} enabled</Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Each scenario drives the same dispatch → PCR → claim pipeline a tenant uses. <strong>Seed</strong> creates the
            trip + completes the PCR; <strong>Submit</strong> generates a real 837P (OATEST envelope) and queues it for
            Office Ally. Provider NPI/EIN are read from Lorenzo Test Company's company profile. Failures show the exact
            pipeline stage that broke — that's a real software gap.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {bootstrapping ? (
            <div className="text-center py-6 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : Object.keys(grouped).length === 0 ? (
            <p className="text-xs text-muted-foreground">No enabled OATEST scenarios.</p>
          ) : (
            Object.entries(grouped).map(([transport, list]) => (
              <div key={transport}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{transport}</p>
                <div className="space-y-2">
                  {list.map(s => (
                    <div key={s.id} className="rounded-md border p-2.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{s.name}</p>
                          <p className="text-[10px] text-muted-foreground">{s.description}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <Badge variant="secondary" className="text-[9px]">{s.payer_type}</Badge>
                            {s.expected_hcpcs && <Badge variant="outline" className="text-[9px]">{s.expected_hcpcs}</Badge>}
                            {(s.expected_modifiers ?? []).map(m => (
                              <Badge key={m} variant="outline" className="text-[9px]">{m}</Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" disabled={loading !== null}
                                  onClick={() => trigger(s.slug, "seed")}>
                            {loading === `${s.slug}_seed` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                            Seed
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" disabled={loading !== null}
                                  onClick={() => trigger(s.slug, "seed_and_submit")}>
                            {loading === `${s.slug}_seed_and_submit` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />}
                            Seed + Submit
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              Recent OATEST Runs
            </CardTitle>
            <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={loadRuns}>Refresh</Button>
          </div>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No runs yet. Click Seed or Seed + Submit on a scenario above.</p>
          ) : (
            <div className="space-y-1.5">
              {runs.map(r => {
                const isFail = r.status === "failed";
                const isOk = r.status === "submitted" || r.status === "ready";
                return (
                  <div key={r.id} className="flex items-start gap-2 rounded-md border p-2 text-xs">
                    {isOk ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" /> :
                     isFail ? <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" /> :
                     <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{r.oatest_scenarios?.name ?? r.scenario_id}</span>
                        <Badge className={`text-[9px] border-0 ${STATUS_TONE[r.status] ?? ""}`}>{r.status}</Badge>
                        {r.failure_stage && <Badge variant="destructive" className="text-[9px]">stage: {r.failure_stage}</Badge>}
                        {r.ack_999_status && <Badge variant="outline" className="text-[9px]">999: {r.ack_999_status}</Badge>}
                        {r.ack_277ca_status && <Badge variant="outline" className="text-[9px]">277CA: {r.ack_277ca_status}</Badge>}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {formatDistanceToNow(new Date(r.started_at), { addSuffix: true })}
                        </span>
                      </div>
                      {r.failure_summary && <p className="text-[10px] text-destructive mt-0.5">{r.failure_summary}</p>}
                      {r.filename && <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{r.filename}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
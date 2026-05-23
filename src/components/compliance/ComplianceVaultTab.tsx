import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { Download, ShieldCheck, FileLock2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getLocalToday } from "@/lib/local-date";

type Regime = {
  id: string;
  label: string;
  years: number;
  blurb: string;
};

const REGIMES: Regime[] = [
  { id: "medicare_cms",   label: "Medicare / CMS audit",        years: 7,  blurb: "42 CFR §424.516(f) — 7-year retention." },
  { id: "medicaid_state", label: "State Medicaid",              years: 6,  blurb: "State-specific (default 6 yrs — Georgia DCH)." },
  { id: "hipaa",          label: "HIPAA records request",       years: 6,  blurb: "45 CFR §164.530(j) — 6-year PHI documentation." },
  { id: "false_claims",   label: "False Claims Act / OIG",      years: 10, blurb: "31 USC §3729 — up to 10-year lookback." },
  { id: "subpoena",       label: "Subpoena / litigation hold",  years: 0,  blurb: "Custom date range, all data included." },
  { id: "daily_ops",      label: "Daily operations reconciliation", years: 0, blurb: "Single day — replaces the spreadsheet you send owners." },
  { id: "custom",         label: "Custom",                       years: 0,  blurb: "Pick your own range and filters." },
];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function presetRange(regime: Regime): { from: string; to: string } {
  const today = getLocalToday();
  if (regime.id === "daily_ops") return { from: today, to: today };
  if (regime.id === "subpoena" || regime.id === "custom") return { from: today, to: today };
  const d = new Date();
  d.setFullYear(d.getFullYear() - regime.years);
  return { from: ymd(d), to: today };
}

interface AuditExportRow {
  id: string;
  regime: string;
  date_from: string;
  date_to: string;
  generated_at: string;
  generated_by_email: string | null;
  file_path: string;
  file_size_bytes: number | null;
  sha256: string;
  row_counts: Record<string, number>;
  include_test_data: boolean;
}

export function ComplianceVaultTab() {
  const { role, isSystemCreator } = useAuth();
  const allowed = role === "owner" || role === "creator" || role === "manager" || isSystemCreator;
  const canGenerate = role === "owner" || role === "creator" || isSystemCreator;

  const [selectedRegime, setSelectedRegime] = useState<Regime>(REGIMES[0]);
  const [range, setRange] = useState(() => presetRange(REGIMES[0]));
  const [includeTest, setIncludeTest] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState<AuditExportRow[]>([]);
  const [earliestRunDate, setEarliestRunDate] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from("audit_exports" as any)
      .select("*")
      .order("generated_at", { ascending: false })
      .limit(50);
    setHistory((data as any[]) ?? []);
  }, []);

  const loadEarliest = useCallback(async () => {
    const { data } = await supabase
      .from("trip_records")
      .select("run_date")
      .order("run_date", { ascending: true })
      .limit(1);
    setEarliestRunDate(data?.[0]?.run_date ?? null);
  }, []);

  useEffect(() => {
    if (!allowed) return;
    loadHistory();
    loadEarliest();
  }, [allowed, loadHistory, loadEarliest]);

  const onPickRegime = (r: Regime) => {
    setSelectedRegime(r);
    setRange(presetRange(r));
  };

  const onGenerate = async () => {
    if (!canGenerate) return;
    if (range.from > range.to) {
      toast.error("Start date must be before end date");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-audit-export", {
        body: {
          regime: selectedRegime.label,
          date_from: range.from,
          date_to: range.to,
          include_test_data: includeTest,
          filters: {},
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Sealed export generated");
      if (data?.signed_url) {
        window.open(data.signed_url, "_blank", "noopener,noreferrer");
      }
      await loadHistory();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to generate export");
    } finally {
      setGenerating(false);
    }
  };

  const onDownload = async (row: AuditExportRow) => {
    const { data, error } = await supabase.storage
      .from("audit-exports")
      .createSignedUrl(row.file_path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Could not generate download link");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const retentionStatus = useMemo(() => {
    if (!earliestRunDate) return null;
    const earliest = new Date(earliestRunDate);
    const today = new Date();
    const yearsCovered = (today.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return REGIMES.filter((r) => r.years > 0).map((r) => ({
      regime: r.label,
      required: r.years,
      covered: yearsCovered,
      ok: yearsCovered >= r.years || earliest >= new Date(today.getFullYear() - r.years, today.getMonth(), today.getDate()),
      // "ok" means you have data going back at least as far as required — for newer companies,
      // not having 7 years of data is expected and not a violation.
    }));
  }, [earliestRunDate]);

  if (!allowed) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Compliance Vault is restricted to Owners, Managers, and Creators.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Builder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileLock2 className="h-5 w-5" /> Generate a sealed export
          </CardTitle>
          <CardDescription>
            Produces a tamper-evident ZIP (SHA-256 sealed and immutably recorded). Use this for
            regulator requests, audits, subpoenas, or owner reconciliation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Regime</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {REGIMES.map((r) => {
                const active = selectedRegime.id === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onPickRegime(r)}
                    className={`text-left rounded-lg border p-3 transition ${
                      active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="font-medium text-sm">{r.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{r.blurb}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="from">Date from</Label>
              <Input id="from" type="date" value={range.from}
                onChange={(e) => setRange((p) => ({ ...p, from: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="to">Date to</Label>
              <Input id="to" type="date" value={range.to}
                onChange={(e) => setRange((p) => ({ ...p, to: e.target.value }))} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Include test/simulated data</div>
              <div className="text-xs text-muted-foreground">
                Off by default. If on, the cover sheet is stamped "NOT FOR REGULATORY USE".
              </div>
            </div>
            <Switch checked={includeTest} onCheckedChange={setIncludeTest} />
          </div>

          <div className="flex items-center justify-end gap-3">
            {!canGenerate && (
              <span className="text-xs text-muted-foreground">
                Managers can view history. Only Owners can seal new exports.
              </span>
            )}
            <Button onClick={onGenerate} disabled={!canGenerate || generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {generating ? "Sealing export…" : "Generate sealed export"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Retention calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Retention coverage</CardTitle>
          <CardDescription>
            How far back your trip records currently go vs. each regime's retention requirement.
            This is informational — nothing is auto-purged.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {earliestRunDate ? (
            <div className="text-sm">
              <div className="mb-3 text-muted-foreground">
                Earliest trip on file: <span className="font-medium text-foreground">{earliestRunDate}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {retentionStatus?.map((r) => (
                  <div key={r.regime} className="flex items-center justify-between rounded border p-2.5">
                    <div className="text-sm">{r.regime}</div>
                    <Badge variant={r.ok ? "secondary" : "outline"} className="text-xs">
                      {r.ok ? "Covered" : `Needs ${r.required} yrs`}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No trip records yet.</div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export history</CardTitle>
          <CardDescription>
            Every export ever sealed for this company. Hash never changes — old exports remain
            verifiable years from now.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Generated</TableHead>
                  <TableHead>Regime</TableHead>
                  <TableHead>Range</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead>SHA-256</TableHead>
                  <TableHead className="text-right">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                      No sealed exports yet.
                    </TableCell>
                  </TableRow>
                )}
                {history.map((row) => {
                  const totalRows = Object.values(row.row_counts ?? {}).reduce((a, b) => a + (b || 0), 0);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(row.generated_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.regime}
                        {row.include_test_data && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            <AlertTriangle className="h-3 w-3 mr-1" />TEST DATA
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {row.date_from} → {row.date_to}
                      </TableCell>
                      <TableCell className="text-xs">{row.generated_by_email ?? "—"}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{totalRows}</TableCell>
                      <TableCell className="font-mono text-[10px] truncate max-w-[180px]" title={row.sha256}>
                        {row.sha256.slice(0, 16)}…
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => onDownload(row)}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ResponsiveTable>
        </CardContent>
      </Card>
    </div>
  );
}

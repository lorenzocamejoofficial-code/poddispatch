import { useCallback, useEffect, useState } from "react";
import { CreatorLayout } from "@/components/layout/CreatorLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, KeyRound, Send, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { NemsisValidationPanel } from "@/components/nemsis/NemsisValidationPanel";
import { decideFinalization, findingsKey, type ValidationResult } from "@/lib/nemsis/validation";

interface Row {
  id: string; created_at: string; test_case: string; operation: string;
  status_code: number | null; status_label: string | null; request_handle: string | null;
  limit_value: number | null; http_status: number | null; error_message: string | null;
  response_xml: string | null;
  total_error_count: number | null; validation_errors: VErr[] | null; sent_timestamp: string | null;
}
interface VErr { kind: string; level: string | null; path: string | null; message: string; line: number | null; rule: string | null }

function ErrorList({ errors }: { errors: VErr[] }) {
  if (!errors.length) return null;
  return (
    <div className="mt-2 space-y-1">
      <p className="text-xs font-medium">Validation errors ({errors.length})</p>
      <ul className="max-h-96 space-y-1 overflow-auto rounded border border-border p-2 text-xs">
        {errors.map((e, i) => (
          <li key={i} className="border-b border-border pb-1 last:border-0">
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline">{e.kind === "schema" ? "Schema" : e.kind === "rule" ? "Rule" : "Server"}</Badge>
              {e.level && <Badge variant="secondary">{e.level}</Badge>}
              {e.line !== null && <span className="text-muted-foreground">line {e.line}</span>}
              {e.rule && <span className="text-muted-foreground">rule {e.rule}</span>}
            </div>
            {e.path && <code className="block break-all font-mono text-muted-foreground">{e.path}</code>}
            <span>{e.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function variant(code: number | null, op: string): "default" | "destructive" | "secondary" {
  if (code === null) return "destructive";
  if (op === "QueryLimit") return code > 0 ? "default" : "destructive";
  if (code >= 1) return "default";
  if (code === 0) return "secondary";
  return "destructive";
}

export default function CreatorNemsisCta() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [lastDem, setLastDem] = useState<Row | null>(null);
  const [records, setRecords] = useState<{ id: string; kind: string; case_key: string; label: string; updated_at: string; last_auto_submit_at: string | null; finalized_at: string | null }[]>([]);
  const [validation, setValidation] = useState<Record<string, { result: ValidationResult; ackKey: string | null }>>({});

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("nemsis_cta_submissions" as never)
      .select("id, created_at, test_case, operation, status_code, status_label, request_handle, limit_value, http_status, error_message, response_xml, total_error_count, validation_errors, sent_timestamp")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) { toast.error(`Could not load CTA log: ${error.message}`); return; }
    setRows((data ?? []) as unknown as Row[]);
    // Certification records are creator-only by policy and can exist only on the certification company.
    const { data: recs, error: recErr } = await supabase
      .from("nemsis_cert_records")
      .select("id, kind, case_key, label, updated_at, last_auto_submit_at, finalized_at")
      .order("case_key");
    if (recErr) toast.error(`Could not load certification records: ${recErr.message}`);
    else setRecords(recs ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const call = async (key: string, body: Record<string, unknown>) => {
    setBusy(key);
    try {
      const { data, error } = await supabase.functions.invoke("nemsis-cta-submit", { body });
      if (error) {
        let msg = error.message;
        try { const ctx = await (error as { context?: Response }).context?.json(); if (ctx?.error) msg = typeof ctx.error === "string" ? ctx.error : JSON.stringify(ctx.error); } catch { /* ignore */ }
        toast.error(msg);
      } else {
        const d = data as { status_code: number | null; status_label: string; limit: number | null };
        if (body.test_case === "DEM1" || body.test_case === "EMS1" || body.test_case === "EMS2" || body.test_case === "EMS3" || body.test_case === "EMS4" || body.test_case === "EMS5") setLastDem({ ...(data as Row), test_case: body.test_case as string, operation: "SubmitData", limit_value: null, response_xml: null, created_at: new Date().toISOString(), error_message: (data as { error: string | null }).error });
        toast.message(`CTA: ${d.status_label}${d.status_code !== null ? ` (code ${d.status_code})` : ""}${d.limit !== null ? ` — limit ${d.limit}` : ""}`);
      }
    } finally {
      setBusy(null);
      load();
    }
  };

  /** Validate (XSD + all Schematron) then finalize: errors block, warnings need one acknowledgement. */
  const finalizeRecord = async (id: string) => {
    setBusy(`fin-${id}`);
    try {
      const invoke = async (action: "validate_record" | "finalize_record") => {
        const { data, error } = await supabase.functions.invoke("nemsis-validate", { body: { action, record_id: id } });
        if (error) {
          const ctx = await (error as { context?: Response }).context?.json().catch(() => null);
          if (ctx?.result) return ctx as { finalized: boolean; result: ValidationResult };
          throw new Error(typeof ctx?.error === "string" ? ctx.error : error.message);
        }
        return data as { finalized: boolean; result: ValidationResult };
      };
      const prev = validation[id];
      const v = await invoke("validate_record");
      const key = findingsKey(v.result);
      const decision = decideFinalization(v.result, prev?.ackKey === key);
      if (decision === "block") {
        setValidation((m) => ({ ...m, [id]: { result: v.result, ackKey: null } }));
        toast.error(`Not finalized: ${v.result.error_count} validation error(s) must be fixed.`);
        return;
      }
      if (decision === "confirm_warnings") {
        setValidation((m) => ({ ...m, [id]: { result: v.result, ackKey: key } }));
        toast.warning(`${v.result.warning_count} warning(s). Review them, then click Finalize again to finalize.`);
        return;
      }
      const f = await invoke("finalize_record");
      setValidation((m) => ({ ...m, [id]: { result: f.result, ackKey: null } }));
      if (f.finalized) toast.success("Record finalized.");
      else toast.error("Not finalized — the record changed or new errors appeared. Review the results.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      load();
    }
  };

  return (
    <CreatorLayout title="NEMSIS CTA">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>NEMSIS Compliance Testing (CTA)</CardTitle>
            <CardDescription>
              Regression buttons below send the built-in test files. Real company, patient or claim data is never sent.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={() => call("ping", { action: "ping" })} disabled={!!busy}>
              {busy === "ping" ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Check login
            </Button>
            <Button variant="outline" onClick={() => call("probe", { action: "submit", test_case: "TRANSPORT_PROBE" })} disabled={!!busy}>
              {busy === "probe" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send transport probe
            </Button>
            <Button onClick={() => call("dem1", { action: "submit", test_case: "DEM1" })} disabled={!!busy}>
              {busy === "dem1" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit DEM 1
            </Button>
            <Button onClick={() => call("ems1", { action: "submit", test_case: "EMS1" })} disabled={!!busy}>
              {busy === "ems1" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit EMS 1
            </Button>
            <Button onClick={() => call("ems2", { action: "submit", test_case: "EMS2" })} disabled={!!busy}>
              {busy === "ems2" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit EMS 2
            </Button>
            <Button onClick={() => call("ems3", { action: "submit", test_case: "EMS3" })} disabled={!!busy}>
              {busy === "ems3" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit EMS 3
            </Button>
            <Button onClick={() => call("ems4", { action: "submit", test_case: "EMS4" })} disabled={!!busy}>
              {busy === "ems4" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit EMS 4
            </Button>
            <Button onClick={() => call("ems5", { action: "submit", test_case: "EMS5" })} disabled={!!busy}>
              {busy === "ems5" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit EMS 5
            </Button>
            <Button variant="ghost" onClick={load} disabled={!!busy}><RefreshCw className="h-4 w-4" /> Refresh</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Certification records (entered data)</CardTitle>
            <CardDescription>
              Builds the XML from records saved for the NEMSIS certification company and sends it. Any other company is refused by the server. Changing a DEM record resends it automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {records.length === 0 && <p className="text-muted-foreground">No certification records yet.</p>}
            {records.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 rounded border p-2">
                <Badge variant="outline">{r.kind}</Badge>
                <span className="font-medium">{r.case_key}</span>
                <span className="text-muted-foreground">{r.label}</span>
                <span className="text-xs text-muted-foreground">Edited {new Date(r.updated_at).toLocaleString()}{r.last_auto_submit_at ? ` · auto-sent ${new Date(r.last_auto_submit_at).toLocaleString()}` : ""}</span>
                {r.finalized_at
                  ? <Badge>Finalized {new Date(r.finalized_at).toLocaleString()}</Badge>
                  : <Badge variant="secondary">Not finalized</Badge>}
                <Button size="sm" variant="outline" className="ml-auto" onClick={() => finalizeRecord(r.id)} disabled={!!busy}>
                  {busy === `fin-${r.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {validation[r.id]?.ackKey ? "Finalize with warnings" : "Validate & finalize"}
                </Button>
                <Button size="sm" onClick={() => call(`rec-${r.id}`, { action: "submit_record", record_id: r.id })} disabled={!!busy}>
                  {busy === `rec-${r.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit / resubmit
                </Button>
                {validation[r.id] && <div className="w-full"><NemsisValidationPanel result={validation[r.id].result} title={`${r.case_key} validation`} /></div>}
              </div>
            ))}
          </CardContent>
        </Card>

        {lastDem && (
          <Card>
            <CardHeader><CardTitle>{lastDem.test_case === "EMS1" ? "EMS 1 result" : lastDem.test_case === "EMS2" ? "EMS 2 result" : lastDem.test_case === "EMS3" ? "EMS 3 result" : lastDem.test_case === "EMS4" ? "EMS 4 result" : lastDem.test_case === "EMS5" ? "EMS 5 result" : "DEM 1 result"}</CardTitle>
              <CardDescription>{lastDem.test_case.startsWith("EMS") ? "Sent as committed (EMS schema 61, no timestamp change)" : `Sent with timeStamp ${lastDem.sent_timestamp ?? "—"}`}</CardDescription></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={variant(lastDem.status_code, "SubmitData")}>
                  {lastDem.status_code !== null ? `code ${lastDem.status_code}` : `HTTP ${lastDem.http_status ?? "—"}`}
                </Badge>
                <span className="font-medium">{lastDem.status_label}</span>
                <span className="text-muted-foreground">totalErrorCount: {lastDem.total_error_count ?? "not reported"}</span>
                {lastDem.request_handle && <span className="text-muted-foreground">handle {lastDem.request_handle}</span>}
              </div>
              {lastDem.error_message && <p className="text-destructive">{lastDem.error_message}</p>}
              <ErrorList errors={lastDem.validation_errors ?? []} />
              {(lastDem.validation_errors ?? []).length === 0 && (lastDem.status_code ?? 0) < 0 && (
                <p className="text-muted-foreground">No element-level errors were itemized — open the full response in the log below.</p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Recent CTA calls</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {rows.length === 0 && <p className="text-sm text-muted-foreground">No calls yet.</p>}
            {rows.map((r) => (
              <div key={r.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                  <Badge variant="outline">{r.test_case}</Badge>
                  <Badge variant="outline">{r.operation}</Badge>
                  <Badge variant={variant(r.status_code, r.operation)}>
                    {r.status_code !== null ? `code ${r.status_code}` : `HTTP ${r.http_status ?? "—"}`}
                  </Badge>
                  <span className="font-medium">{r.status_label}</span>
                  {r.limit_value !== null && <span className="text-muted-foreground">limit {r.limit_value}</span>}
                  {r.total_error_count !== null && <span className="text-muted-foreground">errors {r.total_error_count}</span>}
                  {r.request_handle && <span className="text-muted-foreground">handle {r.request_handle}</span>}
                  {r.status_code === 0 && r.request_handle && (
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => call(r.id, { action: "status", request_handle: r.request_handle })}>
                      Check status
                    </Button>
                  )}
                  {r.response_xml && (
                    <Button size="sm" variant="ghost" onClick={() => setOpen(open === r.id ? null : r.id)}>
                      {open === r.id ? "Hide response" : "Show response"}
                    </Button>
                  )}
                </div>
                {r.error_message && <p className="mt-1 text-destructive">{r.error_message}</p>}
                {r.validation_errors && r.validation_errors.length > 0 && <ErrorList errors={r.validation_errors} />}
                {open === r.id && r.response_xml && (
                  <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-xs">{r.response_xml}</pre>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </CreatorLayout>
  );
}

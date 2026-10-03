import { useCallback, useEffect, useState } from "react";
import { CreatorLayout } from "@/components/layout/CreatorLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, KeyRound, Send, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Row {
  id: string; created_at: string; test_case: string; operation: string;
  status_code: number | null; status_label: string | null; request_handle: string | null;
  limit_value: number | null; http_status: number | null; error_message: string | null;
  response_xml: string | null;
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

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("nemsis_cta_submissions" as never)
      .select("id, created_at, test_case, operation, status_code, status_label, request_handle, limit_value, http_status, error_message, response_xml")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) { toast.error(`Could not load CTA log: ${error.message}`); return; }
    setRows((data ?? []) as unknown as Row[]);
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
        toast.message(`CTA: ${d.status_label}${d.status_code !== null ? ` (code ${d.status_code})` : ""}${d.limit !== null ? ` — limit ${d.limit}` : ""}`);
      }
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
              Sends only built-in test data to the NEMSIS testing service. No company, patient or claim data is ever sent.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={() => call("ping", { action: "ping" })} disabled={!!busy}>
              {busy === "ping" ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Check login
            </Button>
            <Button variant="outline" onClick={() => call("probe", { action: "submit", test_case: "TRANSPORT_PROBE" })} disabled={!!busy}>
              {busy === "probe" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send transport probe
            </Button>
            <Button variant="ghost" onClick={load} disabled={!!busy}><RefreshCw className="h-4 w-4" /> Refresh</Button>
          </CardContent>
        </Card>

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

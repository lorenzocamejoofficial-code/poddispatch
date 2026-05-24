import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, RefreshCw, FileText, CheckCircle2, XCircle, Clock } from "lucide-react";
import { TablePagination } from "@/components/ui/table-pagination";

interface AckRow {
  id: string;
  filename: string;
  submitted_filename: string | null;
  file_type: string;
  claims_matched: number;
  claims_updated: number;
  unmatched_count: number;
  parsed_summary: any;
  parse_error: string | null;
  received_at: string;
  raw_content: string;
}

function ackBadge(row: AckRow) {
  const label = row.parsed_summary?.parsed?.label || row.parsed_summary?.label || "";
  const ak9 = row.parsed_summary?.parsed?.ak9 || row.parsed_summary?.ak9 || "";
  if (row.parse_error) {
    return <Badge variant="destructive" className="text-[10px]">Parse Error</Badge>;
  }
  if (ak9 === "R" || ak9 === "X" || /reject/i.test(label)) {
    return <Badge variant="destructive" className="text-[10px] gap-1"><XCircle className="h-2.5 w-2.5" />Rejected</Badge>;
  }
  if (ak9 === "E" || /error/i.test(label)) {
    return <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-700 dark:text-amber-300 gap-1">Accepted w/ Errors</Badge>;
  }
  if (ak9 === "A" || ak9 === "P" || /accept/i.test(label)) {
    return <Badge variant="secondary" className="text-[10px] gap-1"><CheckCircle2 className="h-2.5 w-2.5" />Accepted</Badge>;
  }
  return <Badge variant="outline" className="text-[10px]">{label || ak9 || "?"}</Badge>;
}

function fileTypeBadge(t: string) {
  if (t === "999") return <Badge variant="outline" className="text-[10px] font-mono">999</Badge>;
  if (t === "277ca") return <Badge variant="outline" className="text-[10px] font-mono">277CA</Badge>;
  if (t === "277ca_summary") return <Badge variant="outline" className="text-[10px] font-mono">277CA summary</Badge>;
  return <Badge variant="outline" className="text-[10px] font-mono">{t}</Badge>;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function AcknowledgmentsPanel() {
  const [rows, setRows] = useState<AckRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await supabase
      .from("clearinghouse_ack_files" as any)
      .select("id, filename, submitted_filename, file_type, claims_matched, claims_updated, unmatched_count, parsed_summary, parse_error, received_at, raw_content", { count: "exact" })
      .order("received_at", { ascending: false })
      .range(from, to);
    if (!error && data) {
      setRows(data as unknown as AckRow[]);
      setTotalCount(count ?? 0);
    }
    setLoading(false);
  }, [page, pageSize]);

  useEffect(() => { load(); }, [load]);

  const pollOA = async () => {
    setPolling(true);
    try {
      await supabase.functions.invoke("retrieve-remittance-officeally", { body: { fetch_acks: true } });
      await new Promise(r => setTimeout(r, 1500));
      await load();
    } finally {
      setPolling(false);
    }
  };

  // Group: each row is a single ack file; group by submitted_filename so 999 + 277CA
  // for the same batch sit together.
  const grouped: Record<string, AckRow[]> = {};
  rows.forEach(r => {
    const k = r.submitted_filename || r.filename;
    grouped[k] = grouped[k] || [];
    grouped[k].push(r);
  });
  const batches = Object.entries(grouped).sort(([, a], [, b]) =>
    new Date(b[0].received_at).getTime() - new Date(a[0].received_at).getTime()
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Clearinghouse Acknowledgments
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            999 / 277CA files received from Office Ally. Round-trip status for every submitted batch (real and OATEST).
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={pollOA} disabled={polling} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${polling ? "animate-spin" : ""}`} /> Poll OA Now
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        ) : batches.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center space-y-1">
            <Clock className="h-5 w-5 mx-auto text-muted-foreground/60" />
            <p>No acknowledgments received yet.</p>
            <p className="text-xs">Submitted batches typically get a 999 within minutes and a 277CA within a few hours.</p>
          </div>
        ) : (
          batches.map(([batch, files]) => {
            const has999 = files.some(f => f.file_type === "999");
            const has277 = files.some(f => f.file_type.startsWith("277ca"));
            return (
              <Collapsible key={batch} className="rounded-md border bg-card">
                <CollapsibleTrigger className="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
                    <span className="font-mono text-xs truncate text-foreground">{batch}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {files.map(f => (
                      <span key={f.id} className="flex items-center gap-1">
                        {fileTypeBadge(f.file_type)}
                        {ackBadge(f)}
                      </span>
                    ))}
                    {!has277 && has999 && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">277CA pending</Badge>
                    )}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t px-3 py-2 space-y-3 bg-muted/20">
                    {files.map(f => {
                      const codes = (f.parsed_summary?.parsed?.raw_codes || f.parsed_summary?.raw_codes || []) as string[];
                      return (
                        <div key={f.id} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                            <span className="font-mono truncate">{f.filename}</span>
                            <span>{timeAgo(f.received_at)}</span>
                          </div>
                          <div className="flex gap-3 text-[11px] text-foreground">
                            <span>Matched: <strong>{f.claims_matched}</strong></span>
                            <span>Updated: <strong>{f.claims_updated}</strong></span>
                            {f.unmatched_count > 0 && (
                              <span className="text-amber-600 dark:text-amber-400">Unmatched: <strong>{f.unmatched_count}</strong></span>
                            )}
                          </div>
                          {codes.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {codes.map((c, i) => (
                                <Badge key={i} variant="destructive" className="text-[10px] font-mono">{c}</Badge>
                              ))}
                            </div>
                          )}
                          {f.parse_error && (
                            <p className="text-[11px] text-destructive">Parse error: {f.parse_error}</p>
                          )}
                          <details className="text-[10px]">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Raw EDI</summary>
                            <pre className="mt-1 max-h-48 overflow-auto rounded bg-background border p-2 font-mono whitespace-pre-wrap break-all">{f.raw_content}</pre>
                          </details>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

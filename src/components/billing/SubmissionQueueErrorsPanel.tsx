import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

interface QueueRow {
  id: string;
  filename: string;
  claim_ids: string[];
  status: string;
  attempts: number;
  error_message: string | null;
  updated_at: string;
}

interface Props { companyId: string | null; }

export function SubmissionQueueErrorsPanel({ companyId }: Props) {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    // Surface rows that are failed OR pending with attempts >= 3 (worker has retried)
    const { data, error } = await supabase
      .from("claim_submission_queue" as any)
      .select("id, filename, claim_ids, status, attempts, error_message, updated_at")
      .eq("company_id", companyId)
      .or("status.eq.failed,and(status.eq.pending,attempts.gte.3)")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) console.error(error);
    setRows((data ?? []) as any);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const forceRetry = async (row: QueueRow) => {
    setBusyId(row.id);
    const { data, error } = await supabase.rpc("force_retry_submission_queue" as any, { p_queue_id: row.id });
    setBusyId(null);
    if (error || !(data as any)?.ok) {
      toast.error("Retry failed: " + (error?.message || (data as any)?.error || "unknown"));
      return;
    }
    toast.success("Submission queued for retry");
    fetchRows();
  };

  const cancel = async (row: QueueRow) => {
    if (!confirm(`Cancel submission ${row.filename}? Claims will remain ready_to_bill and must be re-queued.`)) return;
    setBusyId(row.id);
    const { error } = await supabase.rpc("cancel_submission_queue" as any, { p_queue_id: row.id });
    setBusyId(null);
    if (error) { toast.error("Cancel failed: " + error.message); return; }
    toast.success("Submission cancelled");
    fetchRows();
  };

  if (loading || rows.length === 0) return null;

  return (
    <Card className="border-destructive/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Submission Queue Errors
          <Badge variant="destructive" className="ml-1">{rows.length}</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Claim batches the SFTP worker could not deliver. Force a retry, or cancel permanently.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Batch</th>
                <th className="text-left px-4 py-2"># Claims</th>
                <th className="text-left px-4 py-2">Status / Attempts</th>
                <th className="text-left px-4 py-2">Last Error</th>
                <th className="text-left px-4 py-2">Last Attempt</th>
                <th className="text-right px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t align-top">
                  <td className="px-4 py-2 font-mono text-xs">{r.filename}</td>
                  <td className="px-4 py-2 text-xs">{r.claim_ids?.length ?? 0}</td>
                  <td className="px-4 py-2 text-xs">
                    <Badge variant={r.status === "failed" ? "destructive" : "outline"} className="text-[10px]">
                      {r.status}
                    </Badge>
                    <span className="ml-2 text-muted-foreground">{r.attempts} attempts</span>
                  </td>
                  <td className="px-4 py-2 text-xs max-w-sm">
                    {r.error_message ?? <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.updated_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <Button size="sm" variant="outline" className="h-7 text-xs mr-1"
                      disabled={busyId === r.id} onClick={() => forceRetry(r)}>
                      <RefreshCw className="h-3 w-3 mr-1" />Force retry
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs"
                      disabled={busyId === r.id} onClick={() => cancel(r)}>
                      <X className="h-3 w-3 mr-1" />Cancel
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
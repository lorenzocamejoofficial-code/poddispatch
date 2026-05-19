import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertOctagon, RefreshCw, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface FailureRow {
  id: string;
  trip_id: string;
  error_message: string;
  sqlstate: string | null;
  created_at: string;
}

export function ClaimCreationFailuresPanel() {
  const [rows, setRows] = useState<FailureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("claim_creation_failures" as any)
      .select("id, trip_id, error_message, sqlstate, created_at")
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      console.error(error);
      toast.error("Failed to load claim creation failures");
    }
    setRows((data ?? []) as any);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const retry = async (row: FailureRow) => {
    setBusyId(row.id);
    const { data, error } = await supabase.rpc("retry_claim_creation" as any, { p_trip_id: row.trip_id });
    setBusyId(null);
    if (error || !(data as any)?.ok) {
      toast.error("Retry failed: " + (error?.message || (data as any)?.error || "unknown"));
      return;
    }
    toast.success("Claim creation retried");
    fetchRows();
  };

  const dismiss = async (row: FailureRow) => {
    setBusyId(row.id);
    const { error } = await supabase.rpc("dismiss_claim_creation_failure" as any, { p_failure_id: row.id });
    setBusyId(null);
    if (error) { toast.error("Dismiss failed: " + error.message); return; }
    toast.success("Dismissed");
    fetchRows();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertOctagon className="h-4 w-4 text-destructive" />
          Claim Creation Failures
          {rows.length > 0 && <Badge variant="destructive" className="ml-1">{rows.length}</Badge>}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Trips whose PCR was submitted but the claim record was never created. Retry to re-fire the
          claim-create trigger, or dismiss after investigation.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No unresolved failures. ✓</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2">Trip</th>
                  <th className="text-left px-4 py-2">Reason</th>
                  <th className="text-left px-4 py-2">Failed At</th>
                  <th className="text-right px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2 font-mono text-xs">
                      <a href={`/trips-and-clinical?trip=${r.trip_id}`}
                         className="inline-flex items-center gap-1 hover:underline text-primary">
                        {r.trip_id.substring(0, 8)}<ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                    <td className="px-4 py-2 max-w-md">
                      <div className="text-xs">{r.error_message}</div>
                      {r.sqlstate && (
                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">SQLSTATE {r.sqlstate}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <Button size="sm" variant="outline" className="h-7 text-xs mr-1"
                        disabled={busyId === r.id} onClick={() => retry(r)}>
                        <RefreshCw className="h-3 w-3 mr-1" />Retry
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs"
                        disabled={busyId === r.id} onClick={() => dismiss(r)}>
                        <X className="h-3 w-3 mr-1" />Dismiss
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
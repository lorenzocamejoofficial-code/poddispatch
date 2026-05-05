import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, AlertTriangle, CheckCircle2, FileDown, Inbox } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Props {
  companyId: string;
  refreshKey?: number;
}

interface RemittanceFile {
  id: string;
  file_name: string | null;
  file_identifier: string | null;
  imported_at: string;
  claims_matched: number | null;
  claims_updated: number | null;
  total_paid: number | null;
  status: string | null;
}

interface ClearinghouseSnapshot {
  last_receive_at: string | null;
  last_error: string | null;
  test_mode: boolean | null;
  is_active: boolean | null;
  auto_receive_enabled: boolean | null;
}

export function RemittanceActivityPanel({ companyId, refreshKey }: Props) {
  const [files, setFiles] = useState<RemittanceFile[]>([]);
  const [snapshot, setSnapshot] = useState<ClearinghouseSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const [{ data: filesData }, { data: chData }] = await Promise.all([
      supabase
        .from("remittance_files" as any)
        .select("id, file_name, file_identifier, imported_at, claims_matched, claims_updated, total_paid, status")
        .eq("company_id", companyId)
        .order("imported_at", { ascending: false })
        .limit(10),
      supabase
        .from("clearinghouse_settings")
        .select("last_receive_at, last_error, is_active, auto_receive_enabled")
        .eq("company_id", companyId)
        .maybeSingle(),
    ]);
    setFiles((filesData as unknown as RemittanceFile[]) ?? []);
    setSnapshot((chData as unknown as ClearinghouseSnapshot) ?? null);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (!snapshot) return null;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Remittance Activity</h3>
          {snapshot.test_mode && (
            <Badge variant="outline" className="text-[10px] uppercase">Test Mode</Badge>
          )}
          {snapshot.auto_receive_enabled ? (
            <Badge variant="secondary" className="text-[10px]">Auto-receive on</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">Auto-receive off</Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            Last check:{" "}
            {snapshot.last_receive_at
              ? `${formatDistanceToNow(new Date(snapshot.last_receive_at))} ago`
              : "Never"}
          </span>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {snapshot.last_error && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <span className="font-medium">Last retrieval error:</span> {snapshot.last_error}
          </AlertDescription>
        </Alert>
      )}

      {files.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          No 835 payment files have been imported yet. Click <span className="font-medium">Check for Payments</span> above to retrieve any available remittance from Office Ally.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-1.5 pr-3 font-medium">File</th>
                <th className="py-1.5 pr-3 font-medium">Imported</th>
                <th className="py-1.5 pr-3 font-medium text-right">Matched</th>
                <th className="py-1.5 pr-3 font-medium text-right">Updated</th>
                <th className="py-1.5 pr-3 font-medium text-right">Total Paid</th>
                <th className="py-1.5 pr-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => {
                const status = f.status ?? "imported";
                const statusColor =
                  status === "imported"
                    ? "text-emerald-600"
                    : status === "unmatched"
                    ? "text-amber-600"
                    : status === "no_claims"
                    ? "text-muted-foreground"
                    : "text-foreground";
                return (
                  <tr key={f.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-3 font-mono truncate max-w-[200px]" title={f.file_name ?? ""}>
                      <FileDown className="inline h-3 w-3 mr-1 text-muted-foreground" />
                      {f.file_name ?? f.file_identifier ?? "—"}
                    </td>
                    <td className="py-1.5 pr-3 text-muted-foreground">
                      {formatDistanceToNow(new Date(f.imported_at))} ago
                    </td>
                    <td className="py-1.5 pr-3 text-right">{f.claims_matched ?? 0}</td>
                    <td className="py-1.5 pr-3 text-right">{f.claims_updated ?? 0}</td>
                    <td className="py-1.5 pr-3 text-right">
                      ${Number(f.total_paid ?? 0).toFixed(2)}
                    </td>
                    <td className={`py-1.5 pr-3 capitalize ${statusColor}`}>
                      {status === "imported" && <CheckCircle2 className="inline h-3 w-3 mr-1" />}
                      {status.replace("_", " ")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
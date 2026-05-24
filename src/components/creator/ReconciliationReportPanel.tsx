import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, ScrollText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { TablePagination } from "@/components/ui/table-pagination";

type CompanyRow = {
  company_id: string;
  company_name: string;
  npi: string | null;
  claims_submitted: number;
  claims_paid: number;
  claims_denied: number;
  files_received: number;
  files_quarantined: number;
  quarantine_pending: number;
  total_paid: number;
  unreconciled_variance: number;
};

const PERIODS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last year" },
];

export function ReconciliationReportPanel() {
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - parseInt(period, 10));
      const sinceIso = since.toISOString();

      const [companiesRes, claimsRes, filesRes, qRes] = await Promise.all([
        supabase
          .from("companies")
          .select("id, name, npi_number")
          .eq("creator_test_tenant", false)
          .eq("is_sandbox", false)
          .is("deleted_at", null),
        supabase
          .from("claim_records")
          .select("company_id, status, amount_paid")
          .gte("submitted_at", sinceIso)
          .eq("is_simulated", false),
        supabase
          .from("remittance_files" as any)
          .select("company_id, status, reconciled, reconciliation_variance")
          .gte("imported_at", sinceIso),
        supabase
          .from("remittance_quarantine" as any)
          .select("importing_company_id, status")
          .gte("created_at", sinceIso),
      ]);

      if (companiesRes.error) throw companiesRes.error;
      if (claimsRes.error) throw claimsRes.error;
      if (filesRes.error) throw filesRes.error;
      if (qRes.error) throw qRes.error;

      const companies = companiesRes.data ?? [];
      const map = new Map<string, CompanyRow>();
      companies.forEach(c => {
        map.set(c.id, {
          company_id: c.id,
          company_name: c.name,
          npi: c.npi_number,
          claims_submitted: 0,
          claims_paid: 0,
          claims_denied: 0,
          files_received: 0,
          files_quarantined: 0,
          quarantine_pending: 0,
          total_paid: 0,
          unreconciled_variance: 0,
        });
      });

      (claimsRes.data ?? []).forEach((c: any) => {
        const row = map.get(c.company_id);
        if (!row) return;
        row.claims_submitted++;
        if (c.status === "paid") {
          row.claims_paid++;
          row.total_paid += Number(c.amount_paid ?? 0);
        } else if (c.status === "denied") {
          row.claims_denied++;
        }
      });

      (filesRes.data ?? []).forEach((f: any) => {
        const row = map.get(f.company_id);
        if (!row) return;
        row.files_received++;
        if (f.status === "quarantined") row.files_quarantined++;
        // Source variance directly from the persisted column (Pass 1A).
        // Do NOT re-parse file_content.
        if (f.reconciled === false) {
          row.unreconciled_variance += Math.abs(Number(f.reconciliation_variance ?? 0));
        }
      });

      (qRes.data ?? []).forEach((q: any) => {
        const row = map.get(q.importing_company_id);
        if (!row) return;
        if (q.status === "pending_review") row.quarantine_pending++;
      });

      const list = Array.from(map.values())
        .filter(r => r.claims_submitted > 0 || r.files_received > 0 || r.quarantine_pending > 0)
        .sort((a, b) => b.claims_submitted - a.claims_submitted);
      setRows(list);
    } catch (e: any) {
      toast.error("Failed to load reconciliation: " + e.message);
    }
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [period]);
  const pagedRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const totalQuarantined = rows.reduce((s, r) => s + r.quarantine_pending, 0);
  const totalVariance = rows.reduce((s, r) => s + r.unreconciled_variance, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Reconciliation Report
            {totalQuarantined > 0 ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> {totalQuarantined} pending review
              </Badge>
            ) : (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> Clean
              </Badge>
            )}
            {totalVariance > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> ${totalVariance.toFixed(2)} unreconciled
              </Badge>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Per-company submission vs. payment activity. Use this to confirm every company's money is flowing back correctly.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-12 text-center text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">No claim activity in this period.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>NPI</TableHead>
                <TableHead className="text-right">Submitted</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Denied</TableHead>
                <TableHead className="text-right">835 Files</TableHead>
                <TableHead className="text-right">Quarantined</TableHead>
                <TableHead className="text-right">Unreconciled $</TableHead>
                <TableHead className="text-right">Total $ Posted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRows.map(r => (
                <TableRow key={r.company_id}>
                  <TableCell className="font-medium">{r.company_name}</TableCell>
                  <TableCell className="text-xs font-mono">{r.npi ?? "—"}</TableCell>
                  <TableCell className="text-right">{r.claims_submitted}</TableCell>
                  <TableCell className="text-right">{r.claims_paid}</TableCell>
                  <TableCell className="text-right">{r.claims_denied}</TableCell>
                  <TableCell className="text-right">{r.files_received}</TableCell>
                  <TableCell className="text-right">
                    {r.quarantine_pending > 0 ? (
                      <Badge variant="destructive">{r.quarantine_pending}</Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {r.unreconciled_variance > 0 ? (
                      <span className="text-destructive font-medium">${r.unreconciled_variance.toFixed(2)}</span>
                    ) : (
                      <span className="text-muted-foreground">$0.00</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">${r.total_paid.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!loading && rows.length > 0 && (
          <TablePagination
            page={page}
            pageSize={pageSize}
            totalItems={rows.length}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        )}
      </CardContent>
    </Card>
  );
}
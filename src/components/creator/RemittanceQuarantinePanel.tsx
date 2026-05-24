import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, ShieldAlert, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { TablePagination } from "@/components/ui/table-pagination";

type QuarantineRow = {
  id: string;
  remittance_file_id: string | null;
  importing_company_id: string | null;
  matched_company_id: string | null;
  patient_control_number: string | null;
  payer_claim_control_number: string | null;
  billing_npi_in_file: string | null;
  expected_billing_npi: string | null;
  paid_amount: number | null;
  patient_responsibility: number | null;
  claim_status_code: string | null;
  file_name: string | null;
  raw_clp_segment: string | null;
  quarantine_reason: string;
  status: string;
  file_type: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolution_notes: string | null;
  posted_to_claim_id: string | null;
  created_at: string;
  importing_company_name?: string;
  matched_company_name?: string;
};

const STATUS_LABELS: Record<string, { label: string; variant: "destructive" | "secondary" | "default" | "outline" }> = {
  pending_review: { label: "Pending Review", variant: "destructive" },
  resolved_posted: { label: "Posted", variant: "default" },
  resolved_ignored: { label: "Ignored", variant: "secondary" },
  resolved_reassigned: { label: "Reassigned", variant: "outline" },
};

const FILE_TYPE_LABELS: Record<string, { label: string; variant: "destructive" | "secondary" | "default" | "outline" }> = {
  "835":   { label: "835 Payment", variant: "outline" },
  "999":   { label: "999 Syntax", variant: "secondary" },
  "277ca": { label: "277CA Claim", variant: "secondary" },
};

export function RemittanceQuarantinePanel() {
  const [rows, setRows] = useState<QuarantineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending_review");
  const [fileTypeFilter, setFileTypeFilter] = useState<string>("all");
  const [reviewing, setReviewing] = useState<QuarantineRow | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<string>("resolved_ignored");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("remittance_quarantine" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    if (fileTypeFilter !== "all") q = q.eq("file_type", fileTypeFilter);
    const { data, error } = await q;
    if (error) {
      toast.error("Failed to load quarantine: " + error.message);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as unknown as QuarantineRow[];

    // Resolve company names
    const ids = new Set<string>();
    list.forEach(r => {
      if (r.importing_company_id) ids.add(r.importing_company_id);
      if (r.matched_company_id) ids.add(r.matched_company_id);
    });
    if (ids.size > 0) {
      const { data: companies } = await supabase
        .from("companies")
        .select("id, name")
        .in("id", Array.from(ids));
      const nameMap = new Map((companies ?? []).map(c => [c.id, c.name]));
      list.forEach(r => {
        if (r.importing_company_id) r.importing_company_name = nameMap.get(r.importing_company_id);
        if (r.matched_company_id) r.matched_company_name = nameMap.get(r.matched_company_id);
      });
    }
    setRows(list);
    setLoading(false);
  }, [statusFilter, fileTypeFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [statusFilter, fileTypeFilter]);
  const pagedRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const pendingCount = rows.filter(r => r.status === "pending_review").length;

  const submitResolution = async () => {
    if (!reviewing) return;
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("remittance_quarantine" as any)
      .update({
        status: resolutionStatus,
        resolution_notes: resolutionNotes.trim() || null,
        reviewed_by: auth.user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", reviewing.id);
    setSaving(false);
    if (error) {
      toast.error("Failed to save: " + error.message);
      return;
    }
    toast.success("Quarantine record resolved");
    setReviewing(null);
    setResolutionNotes("");
    setResolutionStatus("resolved_ignored");
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Remittance Quarantine
            {pendingCount > 0 && (
              <Badge variant="destructive">{pendingCount} pending</Badge>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Inbound 835 payment lines that failed NPI verification or could not be matched. Nothing here has been posted to any company's claims.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={fileTypeFilter} onValueChange={setFileTypeFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All file types</SelectItem>
              <SelectItem value="835">835 Payment</SelectItem>
              <SelectItem value="999">999 Syntax</SelectItem>
              <SelectItem value="277ca">277CA Claim</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending_review">Pending Review</SelectItem>
              <SelectItem value="resolved_ignored">Ignored</SelectItem>
              <SelectItem value="resolved_posted">Posted</SelectItem>
              <SelectItem value="resolved_reassigned">Reassigned</SelectItem>
              <SelectItem value="all">All</SelectItem>
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
          <div className="py-12 text-center text-muted-foreground">
            No quarantined remittances. Payment routing is clean.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Importing Company</TableHead>
                <TableHead>NPI in File</TableHead>
                <TableHead>Likely Owner</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{format(new Date(r.created_at), "MMM d, HH:mm")}</TableCell>
                  <TableCell className="text-xs">
                    <Badge variant={FILE_TYPE_LABELS[r.file_type ?? "835"]?.variant ?? "outline"} className="text-[10px]">
                      {FILE_TYPE_LABELS[r.file_type ?? "835"]?.label ?? (r.file_type ?? "835")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{r.file_name}</TableCell>
                  <TableCell className="text-xs">{r.importing_company_name ?? "—"}</TableCell>
                  <TableCell className="text-xs font-mono">{r.billing_npi_in_file ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {r.matched_company_name ? (
                      <span className="text-foreground font-medium">{r.matched_company_name}</span>
                    ) : (
                      <span className="text-muted-foreground italic">unknown</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs">${(r.paid_amount ?? 0).toFixed(2)}</TableCell>
                  <TableCell className="text-xs max-w-md">
                    <div className="flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                      <span>{r.quarantine_reason}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_LABELS[r.status]?.variant ?? "secondary"}>
                      {STATUS_LABELS[r.status]?.label ?? r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {r.status === "pending_review" && (
                      <Button size="sm" variant="outline" onClick={() => { setReviewing(r); setResolutionNotes(""); setResolutionStatus("resolved_ignored"); }}>
                        Review
                      </Button>
                    )}
                  </TableCell>
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

      <Dialog open={!!reviewing} onOpenChange={(o) => { if (!o) setReviewing(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Quarantined Remittance</DialogTitle>
            <DialogDescription>{reviewing?.quarantine_reason}</DialogDescription>
          </DialogHeader>
          {reviewing && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">File:</span> <span className="font-mono text-xs">{reviewing.file_name}</span></div>
                <div><span className="text-muted-foreground">Patient Control #:</span> <span className="font-mono text-xs">{reviewing.patient_control_number ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Payer Control #:</span> <span className="font-mono text-xs">{reviewing.payer_claim_control_number ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Status Code:</span> {reviewing.claim_status_code ?? "—"}</div>
                <div><span className="text-muted-foreground">NPI in File:</span> <span className="font-mono text-xs">{reviewing.billing_npi_in_file ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Expected NPI:</span> <span className="font-mono text-xs">{reviewing.expected_billing_npi ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Importing Company:</span> {reviewing.importing_company_name ?? "—"}</div>
                <div><span className="text-muted-foreground">Likely Owner:</span> {reviewing.matched_company_name ?? "unknown"}</div>
                <div><span className="text-muted-foreground">Paid Amount:</span> ${(reviewing.paid_amount ?? 0).toFixed(2)}</div>
                <div><span className="text-muted-foreground">Patient Resp:</span> ${(reviewing.patient_responsibility ?? 0).toFixed(2)}</div>
              </div>
              {reviewing.raw_clp_segment && (
                <div className="bg-muted p-2 rounded text-xs font-mono break-all">{reviewing.raw_clp_segment}</div>
              )}
              <div>
                <label className="text-xs text-muted-foreground">Resolution</label>
                <Select value={resolutionStatus} onValueChange={setResolutionStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resolved_ignored">Ignore — not actionable</SelectItem>
                    <SelectItem value="resolved_reassigned">Reassigned manually outside the system</SelectItem>
                    <SelectItem value="resolved_posted">Posted manually to correct claim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Notes (required)</label>
                <Textarea value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} placeholder="Describe what you did and why…" rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewing(null)} disabled={saving}>Cancel</Button>
            <Button onClick={submitResolution} disabled={saving || resolutionNotes.trim().length < 5}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Resolution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
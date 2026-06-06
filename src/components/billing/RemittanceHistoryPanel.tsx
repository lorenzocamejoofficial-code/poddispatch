import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Loader2, RefreshCw, FileText, Eye, CheckCircle2, AlertTriangle, ChevronDown, Info } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { parseEDI835, type ParsedRemittanceItem } from "@/lib/edi-835-parser";

type FileRow = {
  id: string;
  file_name: string;
  file_content: string;
  imported_at: string;
  claims_matched: number;
  claims_updated: number;
  total_paid: number;
  status: string;
  bpr_total_paid: number | null;
  payment_date: string | null;
  payer_name: string | null;
  eft_trace_number: string | null;
  reconciled: boolean;
  reconciliation_variance: number;
};

type PaymentRow = {
  id: string;
  claim_record_id: string;
  event_type: string;
  amount: number;
  patient_responsibility: number;
  applied_at: string;
  payer_claim_control_number: string | null;
  adjustment_codes: string[] | null;
};

type PlbRow = {
  id: string;
  reason_code: string;
  reference_id: string | null;
  amount: number;
};

type ClaimMeta = {
  id: string;
  run_date: string | null;
  total_charge: number | null;
  patient_id: string | null;
  patient_name?: string;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  imported: "default",
  unmatched: "secondary",
  quarantined: "destructive",
  no_claims: "outline",
  processing: "secondary",
  routed_pending: "secondary",
  completed: "default",
  completed_with_variance: "secondary",
};

const STATUS_LABEL: Record<string, string> = {
  routed_pending: "Sent by Support",
  completed_with_variance: "Completed (variance)",
};

const PLB_REASONS: Record<string, string> = {
  WO: "Overpayment recovery",
  L6: "Interest paid",
  FC: "Forwarding balance / Fund carry",
  CS: "Adjustment / Cost settlement",
  J1: "Non-reimbursable",
  "72": "Authorized return",
  B2: "Rebate",
  B3: "Recovery allowance",
};

const EVENT_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  payment: "default",
  reversal: "destructive",
  correction: "default",
  secondary_payment: "secondary",
  adjustment: "outline",
};

function ReconciliationBadge({ reconciled, variance }: { reconciled: boolean; variance: number }) {
  if (reconciled) {
    return (
      <Badge variant="default" className="gap-1">
        <CheckCircle2 className="h-3 w-3" /> Reconciled
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="gap-1">
      <AlertTriangle className="h-3 w-3" /> Variance ${Math.abs(Number(variance ?? 0)).toFixed(2)}
    </Badge>
  );
}

export function RemittanceHistoryPanel() {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingFile, setViewingFile] = useState<FileRow | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [plb, setPlb] = useState<PlbRow[]>([]);
  const [claimMeta, setClaimMeta] = useState<Record<string, ClaimMeta>>({});
  const [legacyParsed, setLegacyParsed] = useState<ParsedRemittanceItem[] | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [plbOpen, setPlbOpen] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("remittance_files" as any)
      .select("id, file_name, file_content, imported_at, claims_matched, claims_updated, total_paid, status, bpr_total_paid, payment_date, payer_name, eft_trace_number, reconciled, reconciliation_variance")
      .order("imported_at", { ascending: false })
      .limit(100);
    if (error) {
      toast.error("Failed to load: " + error.message);
    } else {
      setFiles(((data ?? []) as unknown) as FileRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const open = useCallback(async (f: FileRow) => {
    setViewingFile(f);
    setPayments([]);
    setPlb([]);
    setClaimMeta({});
    setLegacyParsed(null);
    setDialogLoading(true);
    try {
      const [{ data: payRows }, { data: plbRows }] = await Promise.all([
        supabase
          .from("claim_payments" as any)
          .select("id, claim_record_id, event_type, amount, patient_responsibility, applied_at, payer_claim_control_number, adjustment_codes")
          .eq("remittance_file_id", f.id)
          .order("applied_at", { ascending: true }),
        supabase
          .from("plb_adjustments" as any)
          .select("id, reason_code, reference_id, amount")
          .eq("remittance_file_id", f.id)
          .order("created_at", { ascending: true }),
      ]);

      const pays = (payRows ?? []) as unknown as PaymentRow[];
      setPayments(pays);
      setPlb(((plbRows ?? []) as unknown) as PlbRow[]);

      // Legacy fallback when no ledger rows exist for this file.
      if (pays.length === 0 && f.file_content) {
        try {
          setLegacyParsed(parseEDI835(f.file_content));
        } catch {
          setLegacyParsed([]);
        }
      }

      // Resolve claim → patient name for ledger rows.
      const claimIds = [...new Set(pays.map(p => p.claim_record_id).filter(Boolean))];
      if (claimIds.length > 0) {
        const { data: claims } = await supabase
          .from("claim_records" as any)
          .select("id, run_date, total_charge, patient_id")
          .in("id", claimIds);
        const claimList = ((claims ?? []) as unknown) as ClaimMeta[];
        const patientIds = [...new Set(claimList.map(c => c.patient_id).filter(Boolean) as string[])];
        const { data: pats } = patientIds.length > 0
          ? await supabase.from("patients").select("id, first_name, last_name").in("id", patientIds)
          : { data: [] };
        const pMap = new Map((pats ?? []).map((p: any) => [p.id, `${p.first_name} ${p.last_name}`]));
        const meta: Record<string, ClaimMeta> = {};
        claimList.forEach(c => {
          meta[c.id] = { ...c, patient_name: c.patient_id ? (pMap.get(c.patient_id) ?? "Unknown") : "Unknown" };
        });
        setClaimMeta(meta);
      }
    } catch (e: any) {
      toast.error("Failed to load file detail: " + e.message);
    }
    setDialogLoading(false);
  }, []);

  const totals = files.reduce(
    (acc, f) => ({
      received: acc.received + 1,
      matched: acc.matched + (f.claims_matched ?? 0),
      paid: acc.paid + Number(f.total_paid ?? 0),
    }),
    { received: 0, matched: 0, paid: 0 }
  );

  const sumClp04 = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const sumPlb = plb.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const isLegacy = !dialogLoading && payments.length === 0 && legacyParsed !== null && legacyParsed.length > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Remittance History
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            All 835 payment files received from the clearinghouse for this company.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          <div className="p-3 bg-muted rounded">
            <div className="text-2xl font-bold">{totals.received}</div>
            <div className="text-xs text-muted-foreground">Files Received</div>
          </div>
          <div className="p-3 bg-muted rounded">
            <div className="text-2xl font-bold">{totals.matched}</div>
            <div className="text-xs text-muted-foreground">Claims Matched</div>
          </div>
          <div className="p-3 bg-muted rounded">
            <div className="text-2xl font-bold">${totals.paid.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Total Paid</div>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">Loading…</div>
        ) : files.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">No remittance files received yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reconciliation</TableHead>
                <TableHead className="text-right">Matched</TableHead>
                <TableHead className="text-right">Updated</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map(f => (
                <TableRow key={f.id}>
                  <TableCell className="text-xs">{format(new Date(f.imported_at), "MMM d, HH:mm")}</TableCell>
                  <TableCell className="text-xs font-mono">
                    {f.file_name}
                    {f.status === "routed_pending" && (
                      <div className="mt-1 text-[10px] font-sans text-muted-foreground italic">
                        PodDispatch support routed this 835 to you — open it and import like a normal remittance.
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[f.status] ?? "secondary"}>
                      {STATUS_LABEL[f.status] ?? f.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ReconciliationBadge reconciled={f.reconciled} variance={f.reconciliation_variance} />
                  </TableCell>
                  <TableCell className="text-right text-xs">{f.claims_matched}</TableCell>
                  <TableCell className="text-right text-xs">{f.claims_updated}</TableCell>
                  <TableCell className="text-right text-xs">${Number(f.total_paid ?? 0).toFixed(2)}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => open(f)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!viewingFile} onOpenChange={(o) => { if (!o) { setViewingFile(null); setLegacyParsed(null); } }}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">{viewingFile?.file_name}</DialogTitle>
          </DialogHeader>
          {viewingFile && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-3 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                <div className="md:col-span-3 flex items-center gap-2">
                  <ReconciliationBadge reconciled={viewingFile.reconciled} variance={viewingFile.reconciliation_variance} />
                  {isLegacy && (
                    <Badge variant="outline" className="gap-1">
                      <Info className="h-3 w-3" /> Legacy file from before payment ledger — limited detail.
                    </Badge>
                  )}
                </div>
                <div><span className="text-muted-foreground">BPR Total:</span> <span className="font-medium">${Number(viewingFile.bpr_total_paid ?? 0).toFixed(2)}</span></div>
                <div><span className="text-muted-foreground">EFT Trace:</span> <span className="font-mono">{viewingFile.eft_trace_number ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Payer:</span> <span>{viewingFile.payer_name ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Payment Date:</span> <span>{viewingFile.payment_date ?? "—"}</span></div>
                <div><span className="text-muted-foreground">Sum CLP04:</span> <span className="font-medium">${sumClp04.toFixed(2)}</span></div>
                <div><span className="text-muted-foreground">Sum PLB:</span> <span className="font-medium">${sumPlb.toFixed(2)}</span></div>
              </div>

              {dialogLoading ? (
                <div className="py-8 text-center text-muted-foreground text-sm">Loading file detail…</div>
              ) : isLegacy ? (
                <div>
                  <div className="text-xs text-muted-foreground mb-2">
                    {legacyParsed!.length} claim line{legacyParsed!.length !== 1 ? "s" : ""} (parsed from raw 835)
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient</TableHead>
                        <TableHead>DOS</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Charged</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Pt Resp</TableHead>
                        <TableHead>Denials</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {legacyParsed!.map((c, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{c.patient_name || c.patient_member_id}</TableCell>
                          <TableCell className="text-xs">{c.date_of_service}</TableCell>
                          <TableCell className="text-xs">{c.claim_status_label}</TableCell>
                          <TableCell className="text-right text-xs">${c.charged_amount.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-xs">${c.paid_amount.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-xs">${c.patient_responsibility.toFixed(2)}</TableCell>
                          <TableCell className="text-xs">{c.raw_denial_codes.join(", ") || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div>
                  <div className="text-xs text-muted-foreground mb-2">
                    {payments.length} payment event{payments.length !== 1 ? "s" : ""} in this file
                  </div>
                  {payments.length === 0 ? (
                    <div className="py-6 text-center text-muted-foreground text-sm">No claim payment events recorded for this file.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Patient</TableHead>
                          <TableHead>DOS</TableHead>
                          <TableHead>Event</TableHead>
                          <TableHead className="text-right">Charged</TableHead>
                          <TableHead className="text-right">Paid</TableHead>
                          <TableHead className="text-right">Pt Resp</TableHead>
                          <TableHead>Codes</TableHead>
                          <TableHead>ICN</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map(p => {
                          const cm = claimMeta[p.claim_record_id];
                          const amt = Number(p.amount ?? 0);
                          const sign = amt < 0 ? "-" : "";
                          return (
                            <TableRow key={p.id}>
                              <TableCell className="text-xs">{cm?.patient_name ?? "—"}</TableCell>
                              <TableCell className="text-xs">{cm?.run_date ?? "—"}</TableCell>
                              <TableCell>
                                <Badge variant={EVENT_VARIANT[p.event_type] ?? "outline"} className="text-[10px] uppercase">{p.event_type}</Badge>
                              </TableCell>
                              <TableCell className="text-right text-xs">${Number(cm?.total_charge ?? 0).toFixed(2)}</TableCell>
                              <TableCell className={`text-right text-xs font-mono ${amt < 0 ? "text-destructive" : "text-[hsl(var(--status-green))]"}`}>{sign}${Math.abs(amt).toFixed(2)}</TableCell>
                              <TableCell className="text-right text-xs">${Number(p.patient_responsibility ?? 0).toFixed(2)}</TableCell>
                              <TableCell className="text-xs">
                                <div className="flex flex-wrap gap-1">
                                  {(p.adjustment_codes ?? []).map((c, i) => (
                                    <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">{c}</span>
                                  ))}
                                  {!(p.adjustment_codes ?? []).length && <span className="text-muted-foreground">—</span>}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs font-mono">{p.payer_claim_control_number ?? "—"}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}

              {plb.length > 0 && (
                <Collapsible open={plbOpen} onOpenChange={setPlbOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2 hover:text-foreground transition-colors">
                    PLB Adjustments ({plb.length})
                    <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${plbOpen ? "rotate-180" : ""}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Reason Code</TableHead>
                          <TableHead>Reference (FCN)</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {plb.map(row => {
                          const amt = Number(row.amount ?? 0);
                          const sign = amt < 0 ? "-" : "+";
                          return (
                            <TableRow key={row.id}>
                              <TableCell className="text-xs font-mono">{row.reason_code}</TableCell>
                              <TableCell className="text-xs font-mono">{row.reference_id ?? "—"}</TableCell>
                              <TableCell className={`text-right text-xs font-mono ${amt < 0 ? "text-destructive" : "text-[hsl(var(--status-green))]"}`}>{sign}${Math.abs(amt).toFixed(2)}</TableCell>
                              <TableCell className="text-xs">{PLB_REASONS[row.reason_code] ?? row.reason_code}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

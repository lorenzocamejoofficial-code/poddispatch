import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown, History, Receipt, RotateCcw, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Adjustment {
  id: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  created_at: string;
  changed_by: string;
}

interface PaymentEvent {
  id: string;
  event_type: string;
  amount: number;
  applied_at: string;
  payer_claim_control_number: string | null;
  adjustment_codes: string[] | null;
  remittance_file_id: string | null;
  clp_status_code: string | null;
}

interface ClaimRecordSummary {
  amount_paid: number | null;
  status: string | null;
}

const EVENT_META: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Receipt }> = {
  payment: { label: "PAYMENT", variant: "default", icon: Receipt },
  reversal: { label: "REVERSAL", variant: "destructive", icon: RotateCcw },
  correction: { label: "CORRECTION", variant: "default", icon: Receipt },
  secondary_payment: { label: "SECONDARY", variant: "secondary", icon: Receipt },
  adjustment: { label: "ADJUSTMENT", variant: "outline", icon: Receipt },
};

function formatSigned(amt: number) {
  const sign = amt < 0 ? "-" : "+";
  return `${sign}$${Math.abs(amt).toFixed(2)}`;
}

export function ClaimAdjustmentHistory({ tripId, claimRecordId }: { tripId: string; claimRecordId?: string }) {
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [payments, setPayments] = useState<PaymentEvent[]>([]);
  const [claim, setClaim] = useState<ClaimRecordSummary | null>(null);
  const [open, setOpen] = useState(false);
  const [paymentsOpen, setPaymentsOpen] = useState(true);

  useEffect(() => {
    if (!tripId) return;
    supabase
      .from("claim_adjustments" as any)
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setAdjustments((data as any[]) ?? []));
  }, [tripId]);

  useEffect(() => {
    if (!claimRecordId) return;
    supabase
      .from("claim_payments" as any)
      .select("id, event_type, amount, applied_at, payer_claim_control_number, adjustment_codes, remittance_file_id, clp_status_code")
      .eq("claim_record_id", claimRecordId)
      .order("applied_at", { ascending: true })
      .then(({ data }) => setPayments((data as any[]) ?? []));
    supabase
      .from("claim_records" as any)
      .select("amount_paid, status")
      .eq("id", claimRecordId)
      .maybeSingle()
      .then(({ data }) => setClaim((data as any) ?? null));
  }, [claimRecordId]);

  if (adjustments.length === 0 && payments.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic py-3">
        No payment events or manual adjustments on this claim yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {payments.length > 0 && (
        <Collapsible open={paymentsOpen} onOpenChange={setPaymentsOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2 hover:text-foreground transition-colors">
            <Receipt className="h-3.5 w-3.5" />
            Payment Events ({payments.length})
            <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${paymentsOpen ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            {payments.map(p => {
              const meta = EVENT_META[p.event_type] ?? EVENT_META.adjustment;
              const isNegative = Number(p.amount) < 0;
              return (
                <div key={p.id} className="rounded-md border bg-muted/30 p-2.5 text-xs space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={meta.variant} className="text-[10px]">{meta.label}</Badge>
                    <span
                      className={`font-mono font-semibold ${
                        isNegative ? "text-destructive" : "text-[hsl(var(--status-green))]"
                      }`}
                    >
                      {formatSigned(Number(p.amount))}
                    </span>
                    <span className="text-muted-foreground ml-auto">
                      {new Date(p.applied_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {p.payer_claim_control_number && (
                      <span className="font-mono">ICN: {p.payer_claim_control_number}</span>
                    )}
                    {p.remittance_file_id && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-1 text-muted-foreground/80">
                              <FileText className="h-3 w-3" />
                              835
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Source 835: {p.remittance_file_id.slice(0, 8)}…</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  {p.adjustment_codes && p.adjustment_codes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.adjustment_codes.map((c, i) => (
                        <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">{c}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {claim && (
              <div className="flex items-center justify-between rounded-md border-t pt-2 px-2.5 text-xs">
                <span className="font-semibold text-foreground">
                  Net: ${Number(claim.amount_paid ?? 0).toFixed(2)}
                </span>
                {claim.status && (
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {claim.status.replace(/_/g, " ")}
                  </Badge>
                )}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      {adjustments.length > 0 && (
        <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2 hover:text-foreground transition-colors">
        <History className="h-3.5 w-3.5" />
        Adjustment History ({adjustments.length})
        <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pt-2">
        {adjustments.map(adj => (
          <div key={adj.id} className="rounded-md border bg-muted/30 p-2.5 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground capitalize">{adj.field_changed.replace(/_/g, " ")}</span>
              <span className="text-muted-foreground">{new Date(adj.created_at).toLocaleString()}</span>
            </div>
            <div className="flex gap-3">
              <span className="text-destructive/70 line-through">{adj.old_value ?? "—"}</span>
              <span>→</span>
              <span className="text-[hsl(var(--status-green))] font-medium">{adj.new_value ?? "—"}</span>
            </div>
            {adj.reason && <p className="text-muted-foreground italic">Reason: {adj.reason}</p>}
          </div>
        ))}
      </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

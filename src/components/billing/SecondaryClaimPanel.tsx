import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowRight, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { logAuditEvent } from "@/lib/audit-logger";

interface SecondaryClaimPanelProps {
  claimId: string;
  tripId: string;
  patientId: string;
  status: string;
  amountPaid: number | null;
  patientResponsibilityAmount: number | null;
  totalCharge: number;
  secondaryClaimGenerated: boolean;
  runDate: string;
  hcpcsCodes: string[] | null;
  hcpcsModifiers: string[] | null;
  originType: string | null;
  destinationType: string | null;
  icd10Codes: string[] | null;
  // Patient secondary insurance info
  secondaryPayer: string | null;
  secondaryMemberId: string | null;
  secondaryPayerId: string | null;
  onGenerated?: () => void;
}

export function SecondaryClaimPanel({
  claimId,
  tripId,
  patientId,
  status,
  amountPaid,
  patientResponsibilityAmount,
  totalCharge,
  secondaryClaimGenerated,
  runDate,
  hcpcsCodes,
  hcpcsModifiers,
  originType,
  destinationType,
  icd10Codes,
  secondaryPayer,
  secondaryMemberId,
  secondaryPayerId,
  onGenerated,
}: SecondaryClaimPanelProps) {
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  // Only show when: claim is paid, patient has secondary payer, not already generated
  const isPaid = status === "paid";
  const hasSecondary = !!secondaryPayer;
  const patResp = patientResponsibilityAmount ?? 0;

  if (!isPaid || !hasSecondary || secondaryClaimGenerated || generated) {
    if (generated) {
      return (
        <div className="rounded-md border border-[hsl(var(--status-green))]/30 bg-[hsl(var(--status-green))]/5 p-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-[hsl(var(--status-green))]" />
            <span className="font-medium text-foreground">Secondary claim generated successfully</span>
          </div>
        </div>
      );
    }
    return null;
  }

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const secondaryCharge = patResp > 0 ? patResp : totalCharge;

      // Create secondary claim
      const { data: newClaimData, error: insertError } = await supabase
        .from("claim_records" as any)
        .insert({
          trip_id: tripId,
          patient_id: patientId,
          run_date: runDate,
          payer_type: secondaryPayer,
          payer_name: secondaryPayer,
          member_id: secondaryMemberId || null,
          total_charge: secondaryCharge,
          base_charge: secondaryCharge,
          mileage_charge: 0,
          extras_charge: 0,
          status: "ready_to_bill",
          hcpcs_codes: hcpcsCodes,
          hcpcs_modifiers: hcpcsModifiers,
          origin_type: originType,
          destination_type: destinationType,
          icd10_codes: icd10Codes,
          original_claim_id: claimId,
          notes: `Secondary claim — primary paid $${(amountPaid ?? 0).toFixed(2)}, patient responsibility $${patResp.toFixed(2)}`,
        } as any)
        .select("id")
        .single();

      if (insertError) throw insertError;
      const newClaimId = (newClaimData as any)?.id;

      // Update primary claim
      await supabase
        .from("claim_records" as any)
        .update({
          secondary_claim_generated: true,
          secondary_claim_id: newClaim.id,
        } as any)
        .eq("id", claimId);

      await logAuditEvent({
        action: "edit",
        tableName: "claim_records",
        recordId: claimId,
        notes: `Generated secondary claim for ${secondaryPayer} — $${secondaryCharge.toFixed(2)}`,
        newData: { secondary_claim_id: newClaim.id, secondary_payer: secondaryPayer },
      });

      setGenerated(true);
      toast.success(`Secondary claim created for ${secondaryPayer}`);
      onGenerated?.();
    } catch (err: any) {
      toast.error("Failed to generate secondary claim: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="rounded-md border border-[hsl(var(--status-yellow))]/40 bg-[hsl(var(--status-yellow-bg))] p-3 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-yellow))] mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Secondary insurance opportunity
          </p>
          <p className="text-xs text-muted-foreground">
            This patient has{" "}
            <Badge variant="outline" className="text-[10px] px-1 py-0 capitalize">
              {secondaryPayer}
            </Badge>{" "}
            secondary coverage that may recover the remaining patient responsibility.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Primary Paid</p>
          <p className="font-semibold font-mono">${(amountPaid ?? 0).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Patient Resp.</p>
          <p className="font-semibold font-mono">${patResp.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Secondary Payer</p>
          <p className="font-semibold capitalize">{secondaryPayer}</p>
        </div>
      </div>

      <Button
        onClick={handleGenerate}
        disabled={generating}
        size="sm"
        className="w-full gap-1.5"
      >
        {generating ? (
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
        ) : (
          <ArrowRight className="h-3.5 w-3.5" />
        )}
        Generate Secondary Claim
      </Button>
    </div>
  );
}

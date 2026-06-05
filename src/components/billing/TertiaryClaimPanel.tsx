import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Loader2, Sparkles } from "lucide-react";
import { createTertiaryClaim } from "@/lib/create-secondary-claim";
import { useToast } from "@/hooks/use-toast";

interface TertiaryClaimPanelProps {
  secondaryClaimId: string;
  status: string;
  amountPaid: number | null;
  patientResponsibilityAmount: number | null;
  tertiaryClaimGenerated: boolean;
  tertiaryPayer: string | null;
  tertiaryMemberId: string | null;
  onGenerated?: () => void;
}

/**
 * Mirrors SecondaryClaimPanel but spawns a tertiary claim from a paid
 * secondary. Surfaces when: secondary is paid, patient has a tertiary
 * payer, and no tertiary has been generated yet.
 */
export function TertiaryClaimPanel({
  secondaryClaimId,
  status,
  amountPaid,
  patientResponsibilityAmount,
  tertiaryClaimGenerated,
  tertiaryPayer,
  tertiaryMemberId,
  onGenerated,
}: TertiaryClaimPanelProps) {
  const [generated, setGenerated] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const isPaid = status === "paid";
  const hasTertiary = !!tertiaryPayer && !!tertiaryMemberId;
  const patResp = patientResponsibilityAmount ?? 0;

  if (!isPaid || !hasTertiary || tertiaryClaimGenerated || generated) {
    if (generated) {
      return (
        <div className="rounded-md border border-[hsl(var(--status-green))]/30 bg-[hsl(var(--status-green))]/5 p-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-[hsl(var(--status-green))]" />
            <span className="font-medium text-foreground">Tertiary claim generated successfully</span>
          </div>
        </div>
      );
    }
    return null;
  }

  const handleGenerate = async () => {
    setBusy(true);
    const res = await createTertiaryClaim(secondaryClaimId);
    setBusy(false);
    if (!res.ok) {
      toast({ title: "Could not create tertiary claim", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Tertiary claim created", description: "Queued in Billing & Claims as ready_to_bill." });
    setGenerated(true);
    onGenerated?.();
  };

  return (
    <div className="rounded-md border border-[hsl(var(--status-yellow))]/40 bg-[hsl(var(--status-yellow-bg))] p-3 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-yellow))] mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Tertiary insurance opportunity</p>
          <p className="text-xs text-muted-foreground">
            This patient has{" "}
            <Badge variant="outline" className="text-[10px] px-1 py-0 capitalize">
              {tertiaryPayer}
            </Badge>{" "}
            tertiary coverage that may recover the remaining patient responsibility after secondary.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Secondary Paid</p>
          <p className="font-semibold font-mono">${(amountPaid ?? 0).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Patient Resp.</p>
          <p className="font-semibold font-mono">${patResp.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Tertiary Payer</p>
          <p className="font-semibold capitalize">{tertiaryPayer}</p>
        </div>
      </div>

      <Button size="sm" className="w-full gap-1.5" onClick={handleGenerate} disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        Generate Tertiary Claim
      </Button>
      <p className="text-[10px] text-muted-foreground leading-snug">
        Spawns a new claim chained off the secondary (Loop 2320/2330 COB from the secondary's remittance).
      </p>
    </div>
  );
}
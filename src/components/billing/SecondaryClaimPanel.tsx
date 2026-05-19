import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

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
  const [generated] = useState(false);

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

      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="block">
              <Button disabled size="sm" className="w-full gap-1.5 cursor-not-allowed">
                <Lock className="h-3.5 w-3.5" />
                Generate Secondary Claim
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            Coordination of benefits EDI (Loop 2320) is not yet implemented. Submit secondary
            claims via your clearinghouse portal until this ships.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <p className="text-[10px] text-muted-foreground leading-snug">
        We're tracking this opportunity so you can recover it manually. EDI COB support is on the
        roadmap.
      </p>
    </div>
  );
}

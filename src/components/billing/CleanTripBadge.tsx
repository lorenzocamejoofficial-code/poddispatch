import { computeCleanTripStatus, type CleanTripResult } from "@/lib/billing-utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

interface CleanTripBadgeProps {
  trip: Parameters<typeof computeCleanTripStatus>[0];
  payerRules?: Parameters<typeof computeCleanTripStatus>[1];
  authInfo?: Parameters<typeof computeCleanTripStatus>[2];
  size?: "sm" | "md";
}

const BADGE_CONFIG: Record<CleanTripResult["level"], {
  label: string;
  icon: typeof CheckCircle;
  className: string;
}> = {
  clean: {
    label: "CLEAN",
    icon: CheckCircle,
    className: "bg-[hsl(var(--status-green))]/15 text-[hsl(var(--status-green))] border-[hsl(var(--status-green))]/30",
  },
  review: {
    label: "REVIEW",
    icon: AlertTriangle,
    className: "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))] border-[hsl(var(--status-yellow))]/30",
  },
  blocked: {
    label: "BLOCKED",
    icon: XCircle,
    className: "bg-destructive/10 text-destructive border-destructive/30",
  },
};

export function CleanTripBadge({ trip, payerRules, authInfo, size = "sm" }: CleanTripBadgeProps) {
  const result = computeCleanTripStatus(trip, payerRules, authInfo);
  const config = BADGE_CONFIG[result.level];
  const Icon = config.icon;

  const badge = (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold ${config.className} ${
      size === "sm" ? "text-[10px]" : "text-xs"
    }`}>
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {config.label}
    </span>
  );

  if (result.issues.length === 0) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <ul className="text-xs space-y-0.5">
            {result.issues.map((issue, i) => (
              <li key={i}>• {issue}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";

export type RevenueStrength = "strong" | "balanced" | "weak" | "underutilized";

interface RevenueStrengthBadgeProps {
  strength: RevenueStrength;
  tripCount: number;
  medicareCount: number;
  facilityCount: number;
}

const CONFIG: Record<RevenueStrength, {
  label: string;
  icon: typeof TrendingUp;
  className: string;
  desc: string;
}> = {
  strong: {
    label: "Strong",
    icon: TrendingUp,
    className: "text-[hsl(var(--status-green))] bg-[hsl(var(--status-green-bg))]",
    desc: "High-value payer mix with good trip density",
  },
  balanced: {
    label: "Balanced",
    icon: Minus,
    className: "text-primary bg-primary/10",
    desc: "Average payer mix and trip load",
  },
  weak: {
    label: "Weak",
    icon: TrendingDown,
    className: "text-[hsl(var(--status-yellow))] bg-[hsl(var(--status-yellow-bg))]",
    desc: "Low trip count or mostly low-value payers",
  },
  underutilized: {
    label: "Underutilized",
    icon: AlertTriangle,
    className: "text-muted-foreground bg-muted",
    desc: "Too few trips assigned — capacity wasted",
  },
};

export function computeRevenueStrength(
  tripCount: number,
  medicareCount: number,
  facilityContractCount: number,
): RevenueStrength {
  if (tripCount === 0) return "underutilized";
  if (tripCount <= 2) return "weak";

  const highValueRatio = (medicareCount + facilityContractCount) / tripCount;
  if (tripCount >= 6 && highValueRatio >= 0.5) return "strong";
  if (tripCount >= 4) return "balanced";
  return "weak";
}

export function RevenueStrengthBadge({ strength, tripCount, medicareCount, facilityCount }: RevenueStrengthBadgeProps) {
  const config = CONFIG[strength];
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${config.className}`}>
            <Icon className="h-3 w-3" />
            {config.label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs font-medium mb-1">{config.desc}</p>
          <div className="text-[10px] text-muted-foreground space-y-0.5">
            <p>{tripCount} trips · {medicareCount} Medicare · {facilityCount} facility contract</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

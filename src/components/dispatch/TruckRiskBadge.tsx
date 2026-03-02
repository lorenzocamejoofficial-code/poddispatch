import { memo } from "react";
import { AlertTriangle, Shield, TrendingUp } from "lucide-react";

interface TruckRiskBadgeProps {
  riskColor: string;
  lateProbability: number;
  reasonCodes?: string[];
  collapseIndex?: number;
}

export const TruckRiskBadge = memo(function TruckRiskBadge({
  riskColor,
  lateProbability,
  reasonCodes = [],
  collapseIndex = 0,
}: TruckRiskBadgeProps) {
  const pct = Math.round(lateProbability * 100);
  const isGreen = riskColor === "green";
  const isYellow = riskColor === "yellow";
  const isRed = riskColor === "red";

  const colorClasses = isRed
    ? "border-[hsl(var(--status-red))]/40 bg-[hsl(var(--status-red))]/8 text-[hsl(var(--status-red))]"
    : isYellow
    ? "border-[hsl(var(--status-yellow))]/40 bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]"
    : "border-[hsl(var(--status-green))]/30 bg-[hsl(var(--status-green-bg))] text-[hsl(var(--status-green))]";

  const Icon = isRed ? AlertTriangle : isYellow ? TrendingUp : Shield;

  const reasons = reasonCodes.slice(0, 2).map(r =>
    r.replace(/_/g, " ").replace(/WAIT /i, "⏱ ").toLowerCase()
  );

  return (
    <div className={`flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[9px] font-semibold ${colorClasses}`}>
      <Icon className="h-3 w-3 shrink-0" />
      <span>{pct}%</span>
      {reasons.length > 0 && (
        <span className="hidden sm:inline truncate max-w-[80px] opacity-80" title={reasonCodes.join(", ")}>
          {reasons[0]}
        </span>
      )}
    </div>
  );
});

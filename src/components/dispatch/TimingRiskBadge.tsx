import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock } from "lucide-react";

export type TimingRisk = "on_time" | "tight" | "at_risk" | "late";

const CONFIG: Record<TimingRisk, { label: string; className: string }> = {
  on_time: {
    label: "On Time",
    className: "text-[hsl(var(--status-green))]",
  },
  tight: {
    label: "Tight",
    className: "text-[hsl(var(--status-yellow))]",
  },
  at_risk: {
    label: "At Risk",
    className: "text-[hsl(var(--status-red))] animate-pulse-status",
  },
  late: {
    label: "Late",
    className: "text-destructive",
  },
};

/**
 * Compute timing risk for a dialysis B-leg.
 * chairTime = e.g. "09:00", bLegPickup = e.g. "12:30", currentTime = now
 * Assumes B-leg pickup is ~3.5h after chair time.
 * If no pickup time, we can't assess.
 */
export function computeTimingRisk(
  pickupTime: string | null,
  currentStatus: string,
  nowMinutes?: number,
): TimingRisk | null {
  if (!pickupTime || currentStatus === "completed") return null;

  const [h, m] = pickupTime.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;

  const pickupMinutes = h * 60 + m;
  const now = nowMinutes ?? (() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  })();

  const diff = pickupMinutes - now;

  if (diff < -15) return "late";
  if (diff < 0) return "at_risk";
  if (diff < 20) return "tight";
  return "on_time";
}

export function TimingRiskBadge({ risk, pickupTime }: { risk: TimingRisk; pickupTime: string }) {
  const config = CONFIG[risk];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-0.5 ${config.className}`}>
            <Clock className="h-3 w-3" />
            <span className="text-[10px] font-semibold">{config.label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p className="text-xs">Pickup scheduled: {pickupTime} — {config.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

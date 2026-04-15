import { memo, useState, useEffect } from "react";
import { Timer } from "lucide-react";

interface HoldTimerIndicatorProps {
  startedAt: string;
  holdType: string;
  currentLevel: string;
}

export const HoldTimerIndicator = memo(function HoldTimerIndicator({
  startedAt,
  holdType,
  currentLevel,
}: HoldTimerIndicatorProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const update = () => setElapsed(Math.floor((Date.now() - start) / 60000));
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const colorClasses =
    currentLevel === "red"
      ? "border-[hsl(var(--status-red))]/50 bg-[hsl(var(--status-red))]/10 text-[hsl(var(--status-red))]"
      : currentLevel === "orange"
      ? "border-[hsl(var(--status-yellow))]/60 bg-[hsl(var(--status-yellow))]/15 text-[hsl(var(--status-yellow))]"
      : currentLevel === "yellow"
      ? "border-[hsl(var(--status-yellow))]/40 bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]"
      : "border-[hsl(var(--status-green))]/30 bg-[hsl(var(--status-green-bg))] text-[hsl(var(--status-green))]";

  const label = (holdType === "wait_patient" || holdType === "patient_not_ready") ? "Patient Wait" : "Facility Delay";

  return (
    <div className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-bold ${colorClasses} animate-pulse`}>
      <Timer className="h-3 w-3 shrink-0" />
      <span>{label}</span>
      <span>{elapsed}m</span>
    </div>
  );
});

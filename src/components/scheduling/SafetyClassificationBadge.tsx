import { ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, UserCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { SafetyStatus } from "@/lib/safety-rules";

interface SafetyClassificationBadgeProps {
  status: SafetyStatus;
  reasons: string[];
  missingFields: string[];
  isOneoff?: boolean;
}

const STATUS_CONFIG = {
  OK: { icon: ShieldCheck, color: "text-[hsl(var(--status-green))]", label: "SAFE", bg: "bg-[hsl(var(--status-green))]/10 border-[hsl(var(--status-green))]/30" },
  WARNING: { icon: ShieldAlert, color: "text-[hsl(var(--status-yellow))]", label: "CAUTION", bg: "bg-[hsl(var(--status-yellow-bg))] border-[hsl(var(--status-yellow))]/30" },
  BLOCKED: { icon: ShieldX, color: "text-destructive", label: "BLOCKED", bg: "bg-destructive/10 border-destructive/30" },
};

export function SafetyClassificationBadge({ status, reasons, missingFields, isOneoff }: SafetyClassificationBadgeProps) {
  // One-off runs with no safety concerns: show neutral indicator instead of INCOMPLETE
  if (isOneoff && status === "OK" && missingFields.length > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold bg-accent/60 border-accent text-accent-foreground">
              <UserCircle className="h-2.5 w-2.5" /> ONE-OFF
            </span>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs">
            <p className="text-xs font-semibold mb-0.5">One-Off — No Safety Data</p>
            <p className="text-[10px] text-muted-foreground">This is a one-off run. Safety fields are optional.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // If missing fields on a regular patient, show INCOMPLETE status
  if (missingFields.length > 0 && status === "OK") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold bg-[hsl(var(--status-yellow-bg))] border-[hsl(var(--status-yellow))]/30 text-[hsl(var(--status-yellow))]`}>
              <AlertTriangle className="h-2.5 w-2.5" /> INCOMPLETE
            </span>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs">
            <p className="text-xs font-semibold mb-0.5">Missing Patient Data</p>
            <ul className="text-[10px] space-y-0.5">
              {missingFields.map((m, i) => <li key={i}>• {m}</li>)}
            </ul>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${config.bg} ${config.color}`}>
            <Icon className="h-2.5 w-2.5" /> {config.label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          <p className="text-xs font-semibold mb-0.5">{config.label}</p>
          {reasons.length > 0 ? (
            <ul className="text-[10px] space-y-0.5">
              {reasons.map((r, i) => <li key={i}>• {r}</li>)}
            </ul>
          ) : (
            <p className="text-[10px] text-muted-foreground">No safety concerns detected</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

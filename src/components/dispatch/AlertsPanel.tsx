import { AlertTriangle, Clock, Timer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

interface Alert {
  id: string;
  message: string;
  severity: "yellow" | "red";
  created_at: string;
  /** If set, this alert is a live hold-timer alert */
  hold_timer_started_at?: string | null;
}

interface AlertsPanelProps {
  alerts: Alert[];
  onDismiss: (id: string) => void;
}

function LiveElapsed({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const update = () => setElapsed(Math.floor((Date.now() - start) / 60000));
    update();
    const interval = setInterval(update, 15000);
    return () => clearInterval(interval);
  }, [startedAt]);
  return <span className="font-mono font-semibold">{elapsed}m</span>;
}

export function AlertsPanel({ alerts, onDismiss }: AlertsPanelProps) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        No active alerts
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const isHoldTimer = !!alert.hold_timer_started_at;
        const isActiveEmergency = alert.message.includes("EMERGENCY UPGRADE") && !alert.message.includes("EMERGENCY RESOLVED") && !alert.message.includes("FALSE TRIGGER VOIDED");
        const _isResolvedEmergency = alert.message.includes("EMERGENCY RESOLVED") || alert.message.includes("FALSE TRIGGER VOIDED");
        const isDismissBlocked = isActiveEmergency;

        return (
          <div
            key={alert.id}
            className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${
              isActiveEmergency
                ? "border-2 border-destructive bg-destructive/10 ring-1 ring-destructive/20"
                : alert.severity === "red"
                ? "border-[hsl(var(--status-red))]/30 bg-[hsl(var(--status-red))]/5"
                : "border-[hsl(var(--status-yellow))]/30 bg-[hsl(var(--status-yellow-bg))]"
            }`}
          >
            {isHoldTimer ? (
              <Timer className={`mt-0.5 h-4 w-4 shrink-0 animate-pulse ${
                alert.severity === "red" ? "text-[hsl(var(--status-red))]" : "text-[hsl(var(--status-yellow))]"
              }`} />
            ) : (
              <AlertTriangle
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  isActiveEmergency ? "text-destructive animate-pulse" :
                  alert.severity === "red" ? "text-[hsl(var(--status-red))]" : "text-[hsl(var(--status-yellow))]"
                }`}
              />
            )}
            <div className="flex-1 min-w-0">
              <span className="text-foreground">
                {alert.message}
                {isHoldTimer && alert.hold_timer_started_at && (
                  <span className="ml-2 text-muted-foreground">
                    (<LiveElapsed startedAt={alert.hold_timer_started_at} /> elapsed)
                  </span>
                )}
              </span>
              {isDismissBlocked && (
                <p className="text-[10px] font-semibold text-destructive mt-1">Waiting for crew resolution</p>
              )}
            </div>
            {isDismissBlocked ? (
              <span className="shrink-0 text-[10px] font-medium text-destructive/60 px-1">🔒</span>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => onDismiss(alert.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

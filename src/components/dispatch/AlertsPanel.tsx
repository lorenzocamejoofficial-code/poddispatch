import { AlertTriangle, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Alert {
  id: string;
  message: string;
  severity: "yellow" | "red";
  created_at: string;
}

interface AlertsPanelProps {
  alerts: Alert[];
  onDismiss: (id: string) => void;
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
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${
            alert.severity === "red"
              ? "border-status-red/30 bg-status-red-bg"
              : "border-status-yellow/30 bg-status-yellow-bg"
          }`}
        >
          <AlertTriangle
            className={`mt-0.5 h-4 w-4 shrink-0 ${
              alert.severity === "red" ? "text-status-red" : "text-status-yellow"
            }`}
          />
          <span className="flex-1 text-foreground">{alert.message}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => onDismiss(alert.id)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}

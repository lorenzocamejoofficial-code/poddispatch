import { memo } from "react";
import { AlertCircle, X, Clock, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface OperationalAlert {
  id: string;
  truck_id: string;
  leg_id: string;
  note: string | null;
  created_at: string;
  status: string;
  run_date: string;
  // Joined
  truck_name?: string;
  patient_name?: string;
  pickup_time?: string | null;
  slot_order?: number | null;
  next_pickup_time?: string | null;
}

interface OperationalAlertsPanelProps {
  alerts: OperationalAlert[];
  onResolve: (id: string) => void;
}

function formatTime(t: string | null | undefined) {
  if (!t) return null;
  try {
    const [h, m] = t.split(":").map(Number);
    const dt = new Date();
    dt.setHours(h, m);
    return format(dt, "h:mm a");
  } catch { return t; }
}

export const OperationalAlertsPanel = memo(function OperationalAlertsPanel({
  alerts,
  onResolve,
}: OperationalAlertsPanelProps) {
  const openAlerts = alerts.filter((a) => a.status === "open");

  if (openAlerts.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-card p-3 text-xs text-muted-foreground">
        <AlertCircle className="h-3.5 w-3.5" />
        No open patient alerts
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {openAlerts.map((alert) => (
        <div
          key={alert.id}
          className="flex items-start gap-3 rounded-lg border border-[hsl(var(--status-red))]/40 bg-[hsl(var(--status-red))]/8 p-3 text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--status-red))]" />
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[hsl(var(--status-red))] text-xs uppercase tracking-wide">
                Patient Not Ready
              </span>
              <span className="text-[10px] text-muted-foreground">
                {format(new Date(alert.created_at), "h:mm a")}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-foreground flex-wrap">
              <Truck className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="font-medium">{alert.truck_name ?? "Unknown Truck"}</span>
              {alert.patient_name && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span>{alert.patient_name}</span>
                </>
              )}
              {alert.slot_order != null && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">Run #{alert.slot_order + 1}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
              {alert.pickup_time && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Pickup: <span className="font-medium text-foreground">{formatTime(alert.pickup_time)}</span>
                </span>
              )}
              {alert.next_pickup_time && (
                <span>
                  Next run: <span className="font-medium text-foreground">{formatTime(alert.next_pickup_time)}</span>
                </span>
              )}
            </div>
            {alert.note && (
              <p className="text-xs text-foreground italic">"{alert.note}"</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 text-[10px] font-medium text-muted-foreground hover:text-foreground"
            onClick={() => onResolve(alert.id)}
          >
            <X className="h-3 w-3 mr-1" />
            Resolve
          </Button>
        </div>
      ))}
    </div>
  );
});

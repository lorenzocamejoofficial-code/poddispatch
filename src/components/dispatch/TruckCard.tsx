import { StatusBadge, StatusDot } from "./StatusBadge";
import { Truck, Users, Zap, WrenchIcon, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/integrations/supabase/types";

type RunStatus = Database["public"]["Enums"]["run_status"];

interface RunInfo {
  id: string;
  patient_name: string;
  pickup_time: string | null;
  status: RunStatus;
  trip_type: string;
  is_current: boolean;
  patient_weight?: number | null;
}

interface TruckCardProps {
  truckName: string;
  crewNames: string[];
  scheduledLegsCount?: number;
  runs: RunInfo[];
  overallStatus: "green" | "yellow" | "red";
  downStatus?: "down_maintenance" | "down_out_of_service" | null;
  downReason?: string | null;
}

export function TruckCard({ truckName, crewNames, scheduledLegsCount = 0, runs, overallStatus, downStatus, downReason }: TruckCardProps) {
  const hasHeavy = runs.some((r) => (r.patient_weight ?? 0) > 200);
  const isDown = !!downStatus;
  const hasRunsWhileDown = isDown && runs.length > 0;

  return (
    <div className={`rounded-lg border bg-card p-4 shadow-sm ${isDown ? "border-destructive/40 bg-destructive/5" : ""}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusDot status={isDown ? "red" : overallStatus} />
          <div className="flex items-center gap-1.5">
            <Truck className={`h-4 w-4 ${isDown ? "text-destructive" : "text-muted-foreground"}`} />
            <span className={`font-semibold ${isDown ? "text-destructive" : "text-card-foreground"}`}>{truckName}</span>
          </div>
          {isDown && (
            <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
              {downStatus === "down_maintenance" ? "MAINT" : "OUT OF SVC"}
            </Badge>
          )}
          {hasHeavy && !isDown && (
            <span className="text-[hsl(var(--status-yellow))]" title="Electric stretcher required">
              <Zap className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>

      {/* Down warning banner */}
      {isDown && (
        <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <div className="flex items-center gap-1.5 font-semibold">
            <WrenchIcon className="h-3.5 w-3.5" />
            Truck unavailable{downReason ? ` — ${downReason}` : ""}
          </div>
          {hasRunsWhileDown && (
            <div className="mt-1 flex items-center gap-1 text-[hsl(var(--status-yellow))] font-medium">
              <AlertTriangle className="h-3 w-3" />
              {runs.length} run(s) still assigned — reassign to another truck.
            </div>
          )}
        </div>
      )}

      <div className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        <span>{crewNames.length > 0 ? crewNames.join(" & ") : "No crew assigned"}</span>
      </div>

      {scheduledLegsCount > 0 && (
        <p className="mb-2 text-xs text-muted-foreground">{scheduledLegsCount} scheduled leg{scheduledLegsCount !== 1 ? "s" : ""}</p>
      )}

      {runs.length === 0 && scheduledLegsCount === 0 ? (
        <p className="text-sm text-muted-foreground italic">{isDown ? "Truck is down — no runs" : "No runs scheduled"}</p>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => (
            <div
              key={run.id}
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                run.is_current ? "border-primary/30 bg-primary/5" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {run.is_current && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      CURRENT
                    </span>
                  )}
                  <span className="truncate font-medium text-card-foreground">
                    {run.patient_name}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  {run.pickup_time && <span>{run.pickup_time}</span>}
                  <span className="capitalize">{run.trip_type}</span>
                </div>
              </div>
              <StatusBadge status={run.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

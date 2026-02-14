import { StatusBadge, StatusDot } from "./StatusBadge";
import { Truck, Users, Zap } from "lucide-react";
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
}

export function TruckCard({ truckName, crewNames, scheduledLegsCount = 0, runs, overallStatus }: TruckCardProps) {
  const hasHeavy = runs.some((r) => (r.patient_weight ?? 0) > 200);
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusDot status={overallStatus} />
          <div className="flex items-center gap-1.5">
            <Truck className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-card-foreground">{truckName}</span>
          </div>
          {hasHeavy && (
            <span className="text-[hsl(var(--status-yellow))]" title="Electric stretcher required">
              <Zap className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>

      <div className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        <span>{crewNames.length > 0 ? crewNames.join(" & ") : "No crew assigned"}</span>
      </div>

      {scheduledLegsCount > 0 && (
        <p className="mb-2 text-xs text-muted-foreground">{scheduledLegsCount} scheduled leg{scheduledLegsCount !== 1 ? "s" : ""}</p>
      )}

      {runs.length === 0 && scheduledLegsCount === 0 ? (
        <p className="text-sm text-muted-foreground italic">No runs scheduled</p>
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

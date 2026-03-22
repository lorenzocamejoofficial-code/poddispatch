import { StatusBadge, StatusDot } from "./StatusBadge";
import { Truck, Users, Zap, WrenchIcon, AlertTriangle, CheckCircle, XCircle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useState } from "react";
import type { Database } from "@/integrations/supabase/types";
import { RevenueStrengthBadge, type RevenueStrength } from "./RevenueStrengthBadge";
import { TimingRiskBadge, computeTimingRisk } from "./TimingRiskBadge";
import { BillingReadinessSummary } from "./BillingReadinessSummary";
import { SafetyBadge, PatientNeedsWarning } from "./SafetyBadge";
import { evaluateSafetyRules, hasCompletePatientNeeds, type PatientNeeds, type CrewCapability, type TruckEquipment, type SafetyStatus } from "@/lib/safety-rules";

type RunStatus = Database["public"]["Enums"]["run_status"];

type BillingStatus = "clean" | "missing_pcs" | "blocked_auth" | "blocked_other" | "not_ready" | null;

interface RunInfo {
  id: string;
  patient_name: string;
  pickup_time: string | null;
  status: RunStatus;
  trip_type: string;
  is_current: boolean;
  patient_weight?: number | null;
  billing_status?: BillingStatus;
  billing_issues?: string[];
  hcpcs_codes?: string[];
  hcpcs_modifiers?: string[];
  loaded_miles?: number | null;
  estimated_charge?: number | null;
  // Safety fields
  patient_needs?: PatientNeeds;
  safety_status?: SafetyStatus;
  safety_reasons?: string[];
  needs_missing?: string[];
  is_oneoff?: boolean;
}

interface TruckCardProps {
  truckName: string;
  crewNames: string[];
  scheduledLegsCount?: number;
  runs: RunInfo[];
  overallStatus: "green" | "yellow" | "red";
  downStatus?: "down_maintenance" | "down_out_of_service" | null;
  downReason?: string | null;
  revenueStrength?: RevenueStrength;
  medicareCount?: number;
  facilityContractCount?: number;
  onRestoreRun?: (slotId: string) => void;
  readOnly?: boolean;
}

function BillingStatusDot({ status, issues }: { status: BillingStatus; issues?: string[] }) {
  if (!status || status === "not_ready") return null;

  const config = {
    clean: { icon: CheckCircle, color: "text-[hsl(var(--status-green))]", label: "Clean Claim Ready" },
    missing_pcs: { icon: AlertTriangle, color: "text-[hsl(var(--status-yellow))]", label: "Missing PCS" },
    blocked_auth: { icon: XCircle, color: "text-destructive", label: "Blocked – Auth Expired" },
    blocked_other: { icon: XCircle, color: "text-destructive", label: "Blocked – Fix Required" },
  }[status];

  if (!config) return null;
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={config.color}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          <p className="text-xs font-semibold mb-0.5">{config.label}</p>
          {issues && issues.length > 0 && (
            <ul className="text-[10px] space-y-0.5">
              {issues.map((issue, i) => <li key={i}>• {issue}</li>)}
            </ul>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function BillingPreviewDialog({ run, open, onOpenChange }: { run: RunInfo; open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Billing Preview — {run.patient_name}</DialogTitle>
          <DialogDescription>{run.trip_type} · {run.pickup_time ?? "—"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {/* HCPCS */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">HCPCS Codes</p>
            <div className="flex flex-wrap gap-1.5">
              {(run.hcpcs_codes ?? []).length > 0 ? run.hcpcs_codes!.map(c => (
                <span key={c} className="rounded bg-primary/10 text-primary text-xs font-mono px-2 py-0.5">{c}</span>
              )) : <span className="text-xs text-muted-foreground">Not assigned yet</span>}
              {(run.hcpcs_modifiers ?? []).map(m => (
                <span key={m} className="rounded bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))] text-xs font-mono px-2 py-0.5">{m}</span>
              ))}
            </div>
          </div>

          {/* Mileage */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Loaded Miles</p>
              <p className="text-sm font-medium">{run.loaded_miles ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Est. Charge</p>
              <p className="text-sm font-medium">{run.estimated_charge != null ? `$${run.estimated_charge.toFixed(2)}` : "—"}</p>
            </div>
          </div>

          {/* Blockers */}
          {run.billing_issues && run.billing_issues.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-destructive mb-1">Missing / Blocked</p>
              <ul className="text-xs text-destructive space-y-0.5">
                {run.billing_issues.map((issue, i) => <li key={i}>• {issue}</li>)}
              </ul>
            </div>
          )}

          {run.billing_status === "clean" && (
            <div className="rounded-md border border-[hsl(var(--status-green))]/30 bg-[hsl(var(--status-green))]/5 p-3 text-center">
              <span className="text-sm font-semibold text-[hsl(var(--status-green))]">🟢 Clean Claim Ready</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TruckCard({ truckName, crewNames, scheduledLegsCount = 0, runs, overallStatus, downStatus, downReason, revenueStrength, medicareCount = 0, facilityContractCount = 0, onRestoreRun, readOnly = false }: TruckCardProps) {
  const hasHeavy = runs.some((r) => (r.patient_weight ?? 0) > 200);
  const isDown = !!downStatus;
  const hasRunsWhileDown = isDown && runs.length > 0;
  const [previewRun, setPreviewRun] = useState<RunInfo | null>(null);

  return (
    <>
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
          {!isDown && revenueStrength && (
            <RevenueStrengthBadge
              strength={revenueStrength}
              tripCount={runs.length}
              medicareCount={medicareCount}
              facilityCount={facilityContractCount}
            />
          )}
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
            {runs.map((run) => {
              const isCancelled = run.status === "cancelled";
              return (
              <div
                key={run.id}
                className={`rounded-md border px-3 py-2 text-sm ${
                  isCancelled ? "border-destructive/40 bg-destructive/5 opacity-75" :
                  run.is_current ? "border-primary/30 bg-primary/5" : ""
                }`}
              >
                {/* Row 1: name + status */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {run.is_current && !isCancelled && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary shrink-0">
                        CURRENT
                      </span>
                    )}
                    {isCancelled && (
                      <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[9px] font-bold text-destructive shrink-0">CANCELLED</span>
                    )}
                    <span className={`truncate font-medium ${isCancelled ? "line-through text-muted-foreground" : "text-card-foreground"}`}>
                      {run.patient_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isCancelled && onRestoreRun && !readOnly && (
                      <Button variant="ghost" size="sm" className="h-5 text-[10px] text-primary hover:text-primary px-1.5" onClick={() => onRestoreRun(run.id)} title="Restore this run">
                        Undo
                      </Button>
                    )}
                    <StatusBadge status={run.status} />
                  </div>
                </div>
                {/* Row 2: time + type */}
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  {run.pickup_time && <span>{run.pickup_time}</span>}
                  {(run as any).destination_name && <span className="truncate">→ {(run as any).destination_name}</span>}
                  <span className="capitalize">{run.trip_type}</span>
                </div>
                {/* Row 3: badges — stacked to prevent overlap (issue #5) */}
                {!isCancelled && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {run.is_oneoff && (
                      <span className="rounded-full bg-accent/80 text-accent-foreground px-1.5 py-0.5 text-[9px] font-bold shrink-0">ONE-OFF</span>
                    )}
                    {/* Safety badge */}
                    {readOnly && run.safety_status === "BLOCKED" ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[9px] font-bold text-destructive cursor-default">
                              BLOCKED
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="text-xs max-w-xs">
                            <p className="font-semibold mb-1">Safety Block</p>
                            {(run.safety_reasons ?? []).map((r, i) => <p key={i}>• {r}</p>)}
                            <p className="mt-1 text-muted-foreground italic">Go to Patient Runs/Scheduling to resolve this.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : run.is_oneoff ? (
                      run.safety_status && run.safety_status !== "OK" ? (
                        <SafetyBadge status={run.safety_status} reasons={run.safety_reasons ?? []} slotId={run.id} />
                      ) : run.needs_missing && run.needs_missing.length > 0 ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-accent/60 border border-accent text-accent-foreground px-1.5 py-0.5 text-[9px] font-semibold">
                                One-Off Run
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="text-xs">Safety fields optional for one-off runs</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : null
                    ) : (
                      <>
                        {run.safety_status && run.safety_status !== "OK" && (
                          <SafetyBadge status={run.safety_status} reasons={run.safety_reasons ?? []} slotId={run.id} />
                        )}
                        {run.safety_status === "OK" && run.needs_missing && run.needs_missing.length > 0 && (
                          <PatientNeedsWarning missing={run.needs_missing} />
                        )}
                      </>
                    )}
                    {run.trip_type === "dialysis" && run.pickup_time && run.status !== "completed" && (() => {
                      const risk = computeTimingRisk(run.pickup_time, run.status);
                      return risk ? <TimingRiskBadge risk={risk} pickupTime={run.pickup_time} /> : null;
                    })()}
                    {!readOnly && <BillingStatusDot status={run.billing_status ?? null} issues={run.billing_issues} />}
                    {!readOnly && run.billing_status && run.billing_status !== "not_ready" && (
                      <button
                        onClick={() => setPreviewRun(run)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="View Billing Preview"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}

        {/* Billing readiness summary */}
        <BillingReadinessSummary runs={runs} />
      </div>

      {previewRun && (
        <BillingPreviewDialog run={previewRun} open={!!previewRun} onOpenChange={v => { if (!v) setPreviewRun(null); }} />
      )}
    </>
  );
}

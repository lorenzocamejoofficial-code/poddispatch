import { StatusDot } from "./StatusBadge";
import { Shield } from "lucide-react";
import { Truck, Users, Zap, WrenchIcon, AlertTriangle, CheckCircle, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { RevenueStrengthBadge, type RevenueStrength } from "./RevenueStrengthBadge";
import { TimingRiskBadge, computeTimingRisk } from "./TimingRiskBadge";
import { BillingReadinessSummary } from "./BillingReadinessSummary";
import { SafetyBadge, PatientNeedsWarning } from "./SafetyBadge";
import { evaluateSafetyRules, hasCompletePatientNeeds, type PatientNeeds, type CrewCapability, type TruckEquipment, type SafetyStatus } from "@/lib/safety-rules";
import { TimeTapRow } from "./TimeTapRow";
import { PCRStatusIndicator } from "./PCRStatusIndicator";
import { deriveRunStatus } from "@/lib/trip-status";

type RunStatus = Database["public"]["Enums"]["run_status"];

type BillingStatus = "clean" | "missing_pcs" | "blocked_auth" | "blocked_other" | "not_ready" | null;

interface RunInfo {
  id: string;
  patient_name: string;
  pickup_time: string | null;
  status: string;
  trip_type: string;
  is_current: boolean;
  patient_weight?: number | null;
  billing_status?: BillingStatus;
  billing_issues?: string[];
  /** Pre-trip readiness for scheduled / not-yet-completed runs. */
  pre_trip_readiness?: "ready" | "needs_attention" | null;
  pre_trip_reasons?: string[];
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
  // PCR time taps
  dispatch_time?: string | null;
  arrived_pickup_at?: string | null;
  at_scene_time?: string | null;
  patient_contact_time?: string | null;
  left_scene_time?: string | null;
  arrived_dropoff_at?: string | null;
  in_service_time?: string | null;
  pcr_status?: string | null;
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
  overriddenLegIds?: Set<string>;
  forceExpanded?: boolean;
}

/**
 * Dispatcher-grade billing readiness chip. Always renders for non-cancelled runs.
 * - Completed/ready runs → "Clean — ready to bill" or short blocker reason.
 * - In-progress / scheduled runs → neutral "Not ready to bill yet".
 * The full HCPCS/modifier preview lives on the biller's page, not here.
 */
function BillingReadinessChip({ status, issues }: { status: BillingStatus; issues?: string[] }) {
  const config = (() => {
    switch (status) {
      case "clean":
        return { icon: CheckCircle, label: "Clean — ready to bill",
          className: "bg-[hsl(var(--status-green))]/10 text-[hsl(var(--status-green))] border-[hsl(var(--status-green))]/30" };
      case "missing_pcs":
        return { icon: AlertTriangle, label: "Blocked — needs PCS",
          className: "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))] border-[hsl(var(--status-yellow))]/30" };
      case "blocked_auth":
        return { icon: XCircle, label: "Blocked — auth expired",
          className: "bg-destructive/10 text-destructive border-destructive/30" };
      case "blocked_other":
        return { icon: XCircle, label: "Blocked — fix required",
          className: "bg-destructive/10 text-destructive border-destructive/30" };
      default:
        return { icon: Clock, label: "Not ready to bill yet",
          className: "bg-muted text-muted-foreground border-border" };
    }
  })();
  const Icon = config.icon;
  const chip = (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${config.className}`}>
      <Icon className="h-2.5 w-2.5" />
      {config.label}
    </span>
  );
  if (!issues || issues.length === 0) return chip;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{chip}</TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          <ul className="text-[10px] space-y-0.5">
            {issues.map((issue, i) => <li key={i}>• {issue}</li>)}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Pre-trip readiness chip — shown ONLY on scheduled / not-yet-completed runs.
 * Separate from BillingReadinessChip (which evaluates completed claims).
 */
function PreTripReadinessChip({ reasons }: { reasons: string[] }) {
  const label = `Won't bill yet: ${reasons[0]}`;
  const chip = (
    <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))] border-[hsl(var(--status-yellow))]/30">
      <AlertTriangle className="h-2.5 w-2.5" />
      {label}
    </span>
  );
  if (reasons.length <= 1) return chip;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{chip}</TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          <ul className="text-[10px] space-y-0.5">
            {reasons.map((r, i) => <li key={i}>• {r}</li>)}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function TruckCard({ truckName, crewNames, scheduledLegsCount = 0, runs, overallStatus, downStatus, downReason, revenueStrength, medicareCount = 0, facilityContractCount = 0, onRestoreRun, readOnly = false, overriddenLegIds = new Set(), forceExpanded = false }: TruckCardProps) {
  const hasHeavy = runs.some((r) => (r.patient_weight ?? 0) > 200);
  const isDown = !!downStatus;
  const hasRunsWhileDown = isDown && runs.length > 0;
  const [localExpanded, setLocalExpanded] = useState(false);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const VISIBLE_COUNT = 3;

  // Sort: completed/cancelled runs sink to bottom, active runs stay in slot order
  const TERMINAL_STATUSES = new Set(["completed", "cancelled", "no_show"]);
  const sortedRuns = [...runs].sort((a, b) => {
    const aTerminal = TERMINAL_STATUSES.has(a.status) ? 1 : 0;
    const bTerminal = TERMINAL_STATUSES.has(b.status) ? 1 : 0;
    return aTerminal - bTerminal;
  });

  const isExpanded = localExpanded || forceExpanded;
  const visibleRuns = isExpanded ? sortedRuns : sortedRuns.slice(0, VISIBLE_COUNT);
  const hiddenCount = sortedRuns.length - VISIBLE_COUNT;
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
          {crewNames.length === 0 && !isDown && (
            <Badge variant="destructive" className="text-[9px] px-1.5 py-0 ml-1">No Crew</Badge>
          )}
        </div>

        {scheduledLegsCount > 0 && (
          <p className="mb-2 text-xs text-muted-foreground">{scheduledLegsCount} scheduled leg{scheduledLegsCount !== 1 ? "s" : ""}</p>
        )}

        {runs.length === 0 && scheduledLegsCount === 0 ? (
          <p className="text-sm text-muted-foreground italic">{isDown ? "Truck is down — no runs" : "No runs scheduled"}</p>
        ) : (
          <div className="space-y-2">
            {visibleRuns.map((run) => {
              const isCancelled = run.status === "cancelled" || run.status === "pending_cancellation";
              const isRunExpanded = expandedRunId === run.id;
              return (
              <div
                key={run.id}
                className={`rounded-md border px-3 py-2 text-sm cursor-pointer transition-shadow ${
                  isCancelled ? "border-destructive/40 bg-destructive/5 opacity-75" :
                  run.is_current ? "border-primary/30 bg-primary/5" : ""
                } ${isRunExpanded ? "ring-1 ring-primary/20 shadow-sm" : ""}`}
                style={isRunExpanded ? { minWidth: 0 } : undefined}
                onClick={() => setExpandedRunId(isRunExpanded ? null : run.id)}
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
                    {/* Run progress badge */}
                    {!isCancelled && (() => {
                      const rs = deriveRunStatus(run);
                      const colorMap: Record<string, string> = {
                        gray: "bg-muted text-muted-foreground",
                        amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400",
                        blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
                        green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400",
                      };
                      return (
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold shrink-0 ${colorMap[rs.color] ?? colorMap.gray}`}>
                          {rs.label}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isCancelled && onRestoreRun && !readOnly && (
                      <Button variant="ghost" size="sm" className="h-5 text-[10px] text-primary hover:text-primary px-1.5" onClick={(e) => { e.stopPropagation(); onRestoreRun(run.id); }} title="Restore this run">
                        Undo
                      </Button>
                    )}
                  </div>
                </div>
                {/* Row 2: time + type */}
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  {run.pickup_time && <span className="shrink-0">{run.pickup_time}</span>}
                  {(run as any).destination_name && <span className="break-words">→ {(run as any).destination_name}</span>}
                  <span className="capitalize shrink-0">{run.trip_type}</span>
                  {!isCancelled && (
                    <BillingReadinessChip status={run.billing_status ?? null} issues={run.billing_issues} />
                  )}
                </div>
                {/* Expanded details */}
                {isRunExpanded && !isCancelled && (
                  <>
                    {/* Row 3: badges */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {run.is_oneoff && (
                        <span className="rounded-full bg-accent/80 text-accent-foreground px-1.5 py-0.5 text-[9px] font-bold shrink-0">ONE-OFF</span>
                      )}
                      {/* Safety badge */}
                      {(() => {
                        const legId = (run as any).leg_id;
                        const isOverridden = legId && overriddenLegIds.has(legId);

                        if (run.safety_status === "BLOCKED" && isOverridden) {
                          return (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center gap-0.5 rounded-full bg-[hsl(var(--status-yellow-bg))] border border-[hsl(var(--status-yellow))]/30 px-1.5 py-0.5 text-[9px] font-bold text-[hsl(var(--status-yellow))] cursor-default">
                                    <Shield className="h-2.5 w-2.5" /> CAUTION · Overridden
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="text-xs max-w-xs">
                                  <p className="font-semibold mb-1">CAUTION — Dispatcher Override</p>
                                  <p className="text-muted-foreground mb-1">A dispatcher reviewed and approved this blocked run.</p>
                                  {(run.safety_reasons ?? []).map((r, i) => <p key={i}>• {r}</p>)}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        }

                        if (readOnly && run.safety_status === "BLOCKED") {
                          return (
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
                          );
                        }

                        if (run.is_oneoff) {
                          if (run.safety_status && run.safety_status !== "OK") {
                            return <SafetyBadge status={run.safety_status} reasons={run.safety_reasons ?? []} slotId={run.id} />;
                          }
                          if (run.needs_missing && run.needs_missing.length > 0) {
                            return (
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
                            );
                          }
                          return null;
                        }

                        return (
                          <>
                            {run.safety_status && run.safety_status !== "OK" && (
                              <SafetyBadge status={run.safety_status} reasons={run.safety_reasons ?? []} slotId={run.id} />
                            )}
                            {run.safety_status === "OK" && run.needs_missing && run.needs_missing.length > 0 && (
                              <PatientNeedsWarning missing={run.needs_missing} />
                            )}
                          </>
                        );
                      })()}
                      {run.trip_type === "dialysis" && run.pickup_time && run.status !== "completed" && (() => {
                        const risk = computeTimingRisk(run.pickup_time, run.status);
                        return risk ? <TimingRiskBadge risk={risk} pickupTime={run.pickup_time} /> : null;
                      })()}
                    </div>
                  </>
                )}
                {!isCancelled && (
                  <>
                    <TimeTapRow
                      dispatch_time={run.dispatch_time}
                      arrived_pickup_at={run.arrived_pickup_at}
                      at_scene_time={run.at_scene_time}
                      patient_contact_time={run.patient_contact_time}
                      left_scene_time={run.left_scene_time}
                      arrived_dropoff_at={run.arrived_dropoff_at}
                      in_service_time={run.in_service_time}
                    />
                    <PCRStatusIndicator pcr_status={run.pcr_status} />
                  </>
                )}
              </div>
              );
            })}
            {hiddenCount > 0 && !forceExpanded && (
              <button
                onClick={() => setLocalExpanded(!localExpanded)}
                className="w-full flex items-center justify-center gap-1.5 rounded-md border border-dashed border-muted-foreground/30 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors"
              >
                <ChevronDown className={`h-3 w-3 transition-transform ${localExpanded ? "rotate-180" : ""}`} />
                {localExpanded ? "Show less" : `Show ${hiddenCount} more`}
              </button>
            )}
          </div>
        )}

        {/* Billing readiness summary */}
        <BillingReadinessSummary runs={runs} />
      </div>
    </>
  );
}

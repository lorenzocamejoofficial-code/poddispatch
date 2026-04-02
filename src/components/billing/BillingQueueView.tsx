import { useState, useEffect, useCallback } from "react";
import { CheckCircle, AlertTriangle, XCircle, DollarSign, ChevronRight, ShieldAlert, Clock, User, FileText, Pencil, RotateCcw, ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { KickbackDialog } from "@/components/billing/KickbackDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BlockerExplanationPanel } from "@/components/billing/BlockerExplanationPanel";
import { PreSubmitChecklist } from "@/components/billing/PreSubmitChecklist";
import { BillingReadinessBar } from "@/components/billing/BillingReadinessBar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  evaluatePcrCompleteness,
  computeCleanTripStatus,
  getPcrRules,
  PCR_TYPES,
  type BillingQueueStatus,
  computeBillingQueueStatus,
  type BillingOverrideLike,
} from "@/lib/billing-utils";
import { BillerPCROverridePanel } from "@/components/billing/BillerPCROverridePanel";

interface TripForQueue {
  id: string;
  run_date: string;
  status: string;
  trip_type: string | null;
  pcr_type: string | null;
  loaded_miles: number | null;
  loaded_at: string | null;
  dropped_at: string | null;
  dispatch_time: string | null;
  origin_type: string | null;
  destination_type: string | null;
  signature_obtained: boolean;
  pcs_attached: boolean;
  necessity_notes: string | null;
  clinical_note: string | null;
  bed_confined: boolean;
  cannot_transfer_safely: boolean;
  requires_monitoring: boolean;
  oxygen_during_transport: boolean;
  expected_revenue: number;
  claim_ready: boolean;
  blockers: string[];
  billing_blocked_reason: string | null;
  patient_name?: string;
  truck_name?: string;
  payer?: string;
  auth_required?: boolean;
  auth_expiration?: string | null;
}

interface BillingOverrideRecord extends BillingOverrideLike {
  id: string;
  reason?: string | null;
  override_reason?: string | null;
  user_id?: string | null;
  overridden_by?: string | null;
  created_at?: string;
  overridden_at?: string;
  is_active?: boolean;
  snapshot?: any;
  previous_blockers?: string[] | null;
  previous_blockers_snapshot?: any;
}

interface BillingQueueViewProps {
  trips: TripForQueue[];
  payerRulesMap: Map<string, any>;
  onRefresh: () => void;
}

function computeQueueDetails(
  trip: TripForQueue,
  payerRules: any,
  overrideMap?: Map<string, BillingOverrideRecord>,
): {
  status: BillingQueueStatus;
  missing: string[];
  blockers: string[];
} {
  const status = computeBillingQueueStatus(trip, payerRules, overrideMap);
  if (status === "ready") {
    return { status, missing: [], blockers: [] };
  }

  if (!['completed', 'ready_for_billing'].includes(trip.status)) {
    return { status: "blocked", missing: [], blockers: ["Trip not completed"] };
  }

  const pcrResult = evaluatePcrCompleteness(trip);
  const cleanResult = computeCleanTripStatus(
    trip,
    payerRules,
    { auth_required: trip.auth_required, auth_expiration: trip.auth_expiration }
  );

  const missing = pcrResult.missing.map(m => m.label);
  const blockers = [...(trip.blockers ?? [])];

  if (cleanResult.level === "blocked") {
    return { status: "blocked", missing, blockers: [...blockers, ...cleanResult.issues] };
  }
  if (!pcrResult.passed || cleanResult.level === "review") {
    return { status: "review", missing, blockers };
  }
  return { status: "ready", missing: [], blockers: [] };
}

const QUEUE_CONFIG: Record<BillingQueueStatus, {
  label: string;
  icon: typeof CheckCircle;
  className: string;
  headerClass: string;
}> = {
  ready: {
    label: "Billing Ready",
    icon: CheckCircle,
    className: "border-[hsl(var(--status-green))]/30 bg-[hsl(var(--status-green))]/5",
    headerClass: "text-[hsl(var(--status-green))]",
  },
  review: {
    label: "Review",
    icon: AlertTriangle,
    className: "border-[hsl(var(--status-yellow))]/30 bg-[hsl(var(--status-yellow-bg))]",
    headerClass: "text-[hsl(var(--status-yellow))]",
  },
  blocked: {
    label: "Blocked",
    icon: XCircle,
    className: "border-destructive/30 bg-destructive/5",
    headerClass: "text-destructive",
  },
};

export function BillingQueueView({ trips, payerRulesMap, onRefresh }: BillingQueueViewProps) {
  const [selectedTrip, setSelectedTrip] = useState<TripForQueue | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [overriding, setOverriding] = useState(false);
  const [overrideHistory, setOverrideHistory] = useState<Map<string, BillingOverrideRecord>>(new Map());
  const [overrideHistoryLoaded, setOverrideHistoryLoaded] = useState(false);
  const [tripAuditLog, setTripAuditLog] = useState<any[] | null>(null);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [correctTrip, setCorrectTrip] = useState<TripForQueue | null>(null);
  const [kickbackTripId, setKickbackTripId] = useState<string | null>(null);
  const [kickbackPatientName, setKickbackPatientName] = useState<string | undefined>(undefined);
  const [readinessFilter, setReadinessFilter] = useState<string | null>(null);
  const [preSubmitTripId, setPreSubmitTripId] = useState<string | null>(null);
  const [preSubmitPatientId, setPreSubmitPatientId] = useState<string | null>(null);

  const fetchOverrideHistory = useCallback(async () => {
    const tripIds = trips.map(t => t.id);
    if (tripIds.length === 0) {
      setOverrideHistory(new Map());
      setOverrideHistoryLoaded(true);
      return;
    }

    setOverrideHistoryLoaded(false);
    const { data } = await supabase
      .from("billing_overrides" as any)
      .select("*")
      .eq("is_active", true)
      .in("trip_id", tripIds)
      .order("created_at", { ascending: false });

    const map = new Map<string, BillingOverrideRecord>();
    for (const row of (data ?? []) as any[]) {
      if (!map.has(row.trip_id)) map.set(row.trip_id, row);
    }
    setOverrideHistory(map);
    setOverrideHistoryLoaded(true);
  }, [trips]);

  useEffect(() => { fetchOverrideHistory(); }, [fetchOverrideHistory]);

  const completedTrips = trips.filter(t => ["completed", "ready_for_billing"].includes(t.status) || t.claim_ready);
  const queueDataReady = overrideHistoryLoaded || completedTrips.length === 0;

  const grouped: Record<BillingQueueStatus, Array<TripForQueue & { queueMissing: string[]; queueBlockers: string[] }>> = {
    ready: [],
    review: [],
    blocked: [],
  };

  if (queueDataReady) {
    for (const trip of completedTrips) {
      const payerRules = payerRulesMap.get(trip.payer ?? "") ?? null;
      const { status, missing, blockers } = computeQueueDetails(trip, payerRules, overrideHistory);
      grouped[status].push({ ...trip, queueMissing: missing, queueBlockers: blockers });
    }
  }

  const selectedQueueInfo = selectedTrip && queueDataReady
    ? computeQueueDetails(selectedTrip, payerRulesMap.get(selectedTrip.payer ?? "") ?? null, overrideHistory)
    : null;

  const pcrRules = selectedTrip ? getPcrRules(selectedTrip.pcr_type) : [];
  const pcrResult = selectedTrip ? evaluatePcrCompleteness(selectedTrip) : null;
  const selectedOverride = selectedTrip ? overrideHistory.get(selectedTrip.id) : null;

  const handleOverride = async () => {
    if (!selectedTrip || !overrideReason.trim()) {
      toast.error("Override reason is required");
      return;
    }

    setOverriding(true);
    try {
      const { data, error } = await supabase.rpc("apply_billing_override", {
        p_trip_id: selectedTrip.id,
        p_reason: overrideReason.trim(),
      });

      // Handle transport-level errors (network, etc.)
      if (error) {
        toast.error(`Override failed: ${error.message}`);
        return;
      }

      // Handle structured error responses from the RPC
      const result = data as any;
      if (result && result.ok === false) {
        const msg = result.message || "Unknown error";
        const code = result.error_code || "";
        if (code === "SIMULATION_RUN_MISMATCH") {
          toast.error("Stale data — sandbox was reset. Refreshing…");
          onRefresh();
        } else {
          toast.error(`Override failed: ${msg}`);
        }
        return;
      }

      // Success path
      const overrideRecord = result?.override as BillingOverrideRecord | undefined;
      if (overrideRecord) {
        setOverrideHistory(prev => {
          const next = new Map(prev);
          next.set(selectedTrip.id, { ...overrideRecord, is_active: true });
          return next;
        });
      }

      setSelectedTrip(prev => (prev ? { ...prev, claim_ready: true, status: "ready_for_billing" } : prev));
      toast.success("Override applied — trip moved to Ready for Billing");
      setOverrideReason("");
      onRefresh();
    } catch (e: any) {
      toast.error(`Override failed: ${e.message}`);
    } finally {
      setOverriding(false);
    }
  };

  const viewTripAuditLog = async (tripId: string) => {
    const [{ data: overrides }, { data: audits }] = await Promise.all([
      supabase.from("billing_overrides" as any).select("*").eq("trip_id", tripId).order("created_at", { ascending: false }),
      supabase.from("audit_logs" as any).select("*").eq("record_id", tripId).eq("action", "billing_override").order("created_at", { ascending: false }),
    ]);

    const combined = [
      ...((overrides ?? []) as any[]).map((o: any) => ({
        type: "override" as const,
        timestamp: o.created_at ?? o.overridden_at,
        user: o.user_id ?? o.overridden_by,
        reason: o.reason ?? o.override_reason,
        blockers: o.snapshot ?? o.previous_blockers_snapshot,
      })),
      ...((audits ?? []) as any[]).map((a: any) => ({
        type: "audit" as const,
        timestamp: a.created_at,
        user: a.actor_user_id || a.actor_email,
        reason: a.notes,
        blockers: a.new_data,
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Deduplicate by timestamp (within 2 seconds)
    const deduped: typeof combined = [];
    for (const entry of combined) {
      const dup = deduped.find(d => Math.abs(new Date(d.timestamp).getTime() - new Date(entry.timestamp).getTime()) < 2000);
      if (!dup) deduped.push(entry);
    }

    setTripAuditLog(deduped);
    setShowAuditLog(true);
  };

  const totalRevenue = completedTrips.reduce((s, t) => s + (t.expected_revenue ?? 0), 0);
  const readyRevenue = grouped.ready.reduce((s, t) => s + (t.expected_revenue ?? 0), 0);
  const blockedRevenue = grouped.blocked.reduce((s, t) => s + (t.expected_revenue ?? 0), 0);

  return (
    <div className="space-y-4">
      {!queueDataReady ? (
        <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          Loading billing overrides…
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-lg border bg-card p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Trips</p>
              <p className="text-xl font-bold text-foreground">{completedTrips.length}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ready</p>
              <p className="text-xl font-bold text-[hsl(var(--status-green))]">{grouped.ready.length}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">At Risk Revenue</p>
              <p className="text-xl font-bold text-destructive">${blockedRevenue.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Clean Rate</p>
              <p className="text-xl font-bold text-foreground">
                {completedTrips.length > 0 ? Math.round((grouped.ready.length / completedTrips.length) * 100) : 0}%
              </p>
            </div>
          </div>

          {/* Queue columns */}
          <div className="grid gap-4 md:grid-cols-3">
            {(["ready", "review", "blocked"] as BillingQueueStatus[]).map(queueStatus => {
              const config = QUEUE_CONFIG[queueStatus];
              const Icon = config.icon;
              const items = grouped[queueStatus];
              return (
                <div key={queueStatus} className={`rounded-lg border p-3 space-y-2 ${config.className}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`h-4 w-4 ${config.headerClass}`} />
                    <span className={`text-xs font-semibold uppercase tracking-wider ${config.headerClass}`}>{config.label}</span>
                    <span className="ml-auto rounded-full bg-background/60 px-2 py-0.5 text-xs font-bold">{items.length}</span>
                  </div>
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">None</p>
                  ) : (
                    items.map(trip => {
                      const hasOverride = overrideHistory.has(trip.id);
                      return (
                        <button
                          key={trip.id}
                          onClick={() => setSelectedTrip(trip)}
                          className="w-full rounded-md border bg-card p-3 text-left hover:border-primary/40 hover:shadow-sm transition-all"
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <p className="text-xs font-semibold text-foreground truncate">{trip.patient_name}</p>
                            <div className="flex items-center gap-1">
                              {hasOverride && (
                                <Badge variant="outline" className="text-[9px] border-[hsl(var(--status-yellow))]/40 text-[hsl(var(--status-yellow))]">
                                  <ShieldAlert className="h-2.5 w-2.5 mr-0.5" />Override
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-[9px]">
                                {PCR_TYPES.find(p => p.value === trip.pcr_type)?.label ?? trip.pcr_type ?? "—"}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{trip.run_date} · {trip.truck_name}</p>
                          {trip.queueMissing.length > 0 && (
                            <p className="text-[10px] text-destructive mt-1 truncate">
                              Missing: {trip.queueMissing.join(", ")}
                            </p>
                          )}
                          <div className="mt-1.5 flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground">${(trip.expected_revenue ?? 0).toLocaleString()}</span>
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Detail panel */}
      <Dialog open={!!selectedTrip} onOpenChange={o => { if (!o) { setSelectedTrip(null); setOverrideReason(""); } }}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTrip?.patient_name} — Billing Detail</DialogTitle>
            <DialogDescription>
              {selectedTrip?.run_date} · {selectedTrip?.trip_type} · {selectedTrip?.truck_name}
            </DialogDescription>
          </DialogHeader>

          {selectedTrip && selectedQueueInfo && (
            <div className="space-y-4 py-2">
              {/* Override Banner — shown when this trip was overridden */}
              {selectedOverride && (
                <div className="rounded-md border border-[hsl(var(--status-yellow))]/40 bg-[hsl(var(--status-yellow-bg))] p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-[hsl(var(--status-yellow))]" />
                    <span className="text-sm font-semibold text-[hsl(var(--status-yellow))]">Billing Override Applied</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(selectedOverride.created_at ?? selectedOverride.overridden_at ?? Date.now()).toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <User className="h-3 w-3" />
                      {(selectedOverride.user_id ?? selectedOverride.overridden_by)?.slice(0, 8) ?? "System"}…
                    </div>
                  </div>
                  <p className="text-xs text-foreground"><span className="font-medium">Reason:</span> {selectedOverride.reason ?? selectedOverride.override_reason}</p>
                  {(selectedOverride.snapshot ?? selectedOverride.previous_blockers_snapshot) && (
                    <div className="text-[10px] text-muted-foreground">
                      <span className="font-medium">Original blockers:</span>{" "}
                      {((selectedOverride.snapshot ?? selectedOverride.previous_blockers_snapshot) as any)?.blockers?.join(", ") ||
                       ((selectedOverride.snapshot ?? selectedOverride.previous_blockers_snapshot) as any)?.missing?.join(", ") ||
                       (selectedOverride.previous_blockers ?? []).join(", ") ||
                       "None recorded"}
                    </div>
                  )}
                </div>
              )}

              {/* Status banner */}
              <div className={`rounded-md border p-3 ${QUEUE_CONFIG[selectedQueueInfo.status].className}`}>
                <div className="flex items-center gap-2">
                  {(() => {
                    const Icon = QUEUE_CONFIG[selectedQueueInfo.status].icon;
                    return <Icon className={`h-4 w-4 ${QUEUE_CONFIG[selectedQueueInfo.status].headerClass}`} />;
                  })()}
                  <span className={`text-sm font-semibold ${QUEUE_CONFIG[selectedQueueInfo.status].headerClass}`}>
                    {QUEUE_CONFIG[selectedQueueInfo.status].label}
                  </span>
                  <span className="ml-auto text-xs font-bold text-foreground">
                    ${(selectedTrip.expected_revenue ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* PCR required fields checklist */}
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  PCR Requirements ({PCR_TYPES.find(p => p.value === selectedTrip.pcr_type)?.label ?? "Other"})
                </p>
                <div className="space-y-1">
                  {pcrRules.map(rule => {
                    const present = pcrResult ? !pcrResult.missing.find(m => m.field === rule.field) : false;
                    return (
                      <div key={rule.field} className="flex items-center gap-2 text-xs">
                        {present ? (
                          <CheckCircle className="h-3 w-3 text-[hsl(var(--status-green))] shrink-0" />
                        ) : rule.required ? (
                          <XCircle className="h-3 w-3 text-destructive shrink-0" />
                        ) : (
                          <AlertTriangle className="h-3 w-3 text-muted-foreground shrink-0" />
                        )}
                        <span className={present ? "text-foreground" : rule.required ? "text-destructive" : "text-muted-foreground"}>
                          {rule.label}
                        </span>
                        {rule.required && (
                          <span className="text-[9px] text-muted-foreground ml-auto">required</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Blockers */}
              {selectedQueueInfo.blockers.length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-destructive">Blockers</p>
                  {selectedQueueInfo.blockers.map((b, i) => (
                    <p key={i} className="text-xs text-destructive flex items-center gap-1.5">
                      <XCircle className="h-3 w-3 shrink-0" /> {b}
                    </p>
                  ))}
                </div>
              )}

              {/* Override section - only for review/blocked */}
              {selectedQueueInfo.status !== "ready" && (
                <div className="rounded-md border p-3 space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Override to Billing Ready</p>
                  <p className="text-xs text-muted-foreground">
                    This will mark the trip as billing-ready despite missing items. The override will be logged to the audit trail and billing_overrides table.
                  </p>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Override Reason (required)</Label>
                    <Textarea
                      value={overrideReason}
                      onChange={e => setOverrideReason(e.target.value)}
                      placeholder="Why is this override being applied?"
                      rows={2}
                    />
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    disabled={!overrideReason.trim() || overriding}
                    onClick={handleOverride}
                  >
                    {overriding ? "Processing…" : "Override & Mark Billing Ready"}
                  </Button>
                </div>
              )}
              {/* View Override Log button */}
              {selectedOverride && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={() => viewTripAuditLog(selectedTrip.id)}
                >
                  <FileText className="h-3.5 w-3.5" />
                  View Override Log
                </Button>
              )}
              {/* Correct PCR button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                onClick={() => {
                  setCorrectTrip(selectedTrip);
                  setSelectedTrip(null);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Correct PCR
              </Button>
              {/* Kick Back to Crew button — only for submitted PCRs */}
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/5"
                onClick={() => {
                  setKickbackTripId(selectedTrip.id);
                  setKickbackPatientName(selectedTrip.patient_name);
                  setSelectedTrip(null);
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Kick Back to Crew
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Trip Audit Log Dialog */}
      <Dialog open={showAuditLog} onOpenChange={o => { if (!o) { setShowAuditLog(false); setTripAuditLog(null); } }}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Override Audit Trail
            </DialogTitle>
            <DialogDescription>
              {selectedTrip?.patient_name} — {selectedTrip?.run_date}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {tripAuditLog === null ? (
              <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>
            ) : tripAuditLog.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No override records found</p>
            ) : (
              tripAuditLog.map((entry, i) => (
                <div key={i} className="rounded-md border p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-3.5 w-3.5 text-[hsl(var(--status-yellow))]" />
                      <span className="text-xs font-semibold text-foreground capitalize">{entry.type}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs space-y-0.5">
                    <p><span className="text-muted-foreground">User:</span> {entry.user?.slice(0, 8) ?? "System"}…</p>
                    <p><span className="text-muted-foreground">Reason:</span> {entry.reason}</p>
                    {entry.blockers && (
                      <p className="text-[10px] text-muted-foreground">
                        <span className="font-medium">Snapshot:</span>{" "}
                        {JSON.stringify(entry.blockers).slice(0, 200)}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Biller PCR Correction Panel */}
      {correctTrip && (
        <BillerPCROverridePanel
          trip={{
            id: correctTrip.id,
            loaded_miles: correctTrip.loaded_miles,
            origin_type: correctTrip.origin_type,
            destination_type: correctTrip.destination_type,
            service_level: (correctTrip as any).service_level ?? null,
            stretcher_placement: (correctTrip as any).stretcher_placement ?? null,
            patient_mobility: (correctTrip as any).patient_mobility ?? null,
            odometer_at_scene: (correctTrip as any).odometer_at_scene ?? null,
            odometer_at_destination: (correctTrip as any).odometer_at_destination ?? null,
            odometer_in_service: (correctTrip as any).odometer_in_service ?? null,
            dispatch_time: correctTrip.dispatch_time,
            at_scene_time: (correctTrip as any).at_scene_time ?? null,
            left_scene_time: (correctTrip as any).left_scene_time ?? null,
            arrived_dropoff_at: (correctTrip as any).arrived_dropoff_at ?? null,
            in_service_time: (correctTrip as any).in_service_time ?? null,
            hcpcs_codes: (correctTrip as any).hcpcs_codes ?? null,
            vehicle_id: (correctTrip as any).vehicle_id ?? null,
            patient_name: correctTrip.patient_name,
          }}
          open={!!correctTrip}
          onOpenChange={(open) => { if (!open) setCorrectTrip(null); }}
          onSaved={() => { setCorrectTrip(null); onRefresh(); }}
        />
      )}

      {/* Kickback Dialog */}
      {kickbackTripId && (
        <KickbackDialog
          open={!!kickbackTripId}
          onOpenChange={(open) => { if (!open) setKickbackTripId(null); }}
          tripId={kickbackTripId}
          patientName={kickbackPatientName}
          onKickedBack={() => { setKickbackTripId(null); onRefresh(); }}
        />
      )}
    </div>
  );
}
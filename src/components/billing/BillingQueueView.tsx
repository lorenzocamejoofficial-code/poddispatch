import { useState, useEffect } from "react";
import { CheckCircle, AlertTriangle, XCircle, DollarSign, ChevronRight, ShieldAlert, Clock, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
} from "@/lib/billing-utils";

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

interface BillingOverrideRecord {
  id: string;
  trip_id: string;
  override_reason: string;
  overridden_by: string | null;
  overridden_at: string;
  previous_blockers_snapshot: any;
}

interface BillingQueueViewProps {
  trips: TripForQueue[];
  payerRulesMap: Map<string, any>;
  onRefresh: () => void;
}

function computeQueueStatus(trip: TripForQueue, payerRules: any): {
  status: BillingQueueStatus;
  missing: string[];
  blockers: string[];
} {
  if (!["completed", "ready_for_billing"].includes(trip.status)) {
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

  // Fetch override history for all trips
  useEffect(() => {
    const tripIds = trips.map(t => t.id);
    if (tripIds.length === 0) return;
    
    supabase
      .from("billing_overrides" as any)
      .select("*")
      .in("trip_id", tripIds)
      .order("overridden_at", { ascending: false })
      .then(({ data }) => {
        const map = new Map<string, BillingOverrideRecord>();
        for (const row of (data ?? []) as any[]) {
          if (!map.has(row.trip_id)) map.set(row.trip_id, row);
        }
        setOverrideHistory(map);
      });
  }, [trips]);

  const completedTrips = trips.filter(t => ["completed", "ready_for_billing"].includes(t.status));

  const grouped: Record<BillingQueueStatus, Array<TripForQueue & { queueMissing: string[]; queueBlockers: string[] }>> = {
    ready: [],
    review: [],
    blocked: [],
  };

  for (const trip of completedTrips) {
    const payerRules = payerRulesMap.get(trip.payer ?? "") ?? null;
    const { status, missing, blockers } = computeQueueStatus(trip, payerRules);
    grouped[status].push({ ...trip, queueMissing: missing, queueBlockers: blockers });
  }

  const selectedQueueInfo = selectedTrip
    ? computeQueueStatus(selectedTrip, payerRulesMap.get(selectedTrip.payer ?? "") ?? null)
    : null;

  const pcrRules = selectedTrip ? getPcrRules(selectedTrip.pcr_type) : [];
  const pcrResult = selectedTrip ? evaluatePcrCompleteness(selectedTrip) : null;
  const selectedOverride = selectedTrip ? overrideHistory.get(selectedTrip.id) : null;

  const handleOverride = async () => {
    if (!selectedTrip || !overrideReason.trim()) return;
    setOverriding(true);
    try {
      const previousBlockers = selectedQueueInfo
        ? { status: selectedQueueInfo.status, missing: selectedQueueInfo.missing, blockers: selectedQueueInfo.blockers }
        : null;

      // 1. Insert billing_overrides record
      const { error: overrideErr } = await supabase.from("billing_overrides" as any).insert({
        trip_id: selectedTrip.id,
        override_reason: overrideReason.trim(),
        previous_blockers_snapshot: previousBlockers,
      });
      if (overrideErr) throw new Error(`Override record failed: ${overrideErr.message}`);

      // 2. Write audit log
      const { error: auditErr } = await supabase.from("audit_logs" as any).insert({
        action: "billing_override",
        table_name: "trip_records",
        record_id: selectedTrip.id,
        notes: overrideReason.trim(),
        new_data: { claim_ready: true, previous_blockers: previousBlockers },
      });
      if (auditErr) console.warn("Audit log insert failed:", auditErr.message);

      // 3. Update trip status to ready_for_billing
      const { error: tripErr } = await supabase.from("trip_records" as any).update({
        claim_ready: true,
        billing_blocked_reason: null,
        status: "ready_for_billing",
      }).eq("id", selectedTrip.id);
      if (tripErr) throw new Error(`Trip update failed: ${tripErr.message}`);

      toast.success("Override applied — trip moved to Billing Ready");
      setSelectedTrip(null);
      setOverrideReason("");
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setOverriding(false);
    }
  };

  const totalRevenue = completedTrips.reduce((s, t) => s + (t.expected_revenue ?? 0), 0);
  const readyRevenue = grouped.ready.reduce((s, t) => s + (t.expected_revenue ?? 0), 0);
  const blockedRevenue = grouped.blocked.reduce((s, t) => s + (t.expected_revenue ?? 0), 0);

  return (
    <div className="space-y-4">
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
                      {new Date(selectedOverride.overridden_at).toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <User className="h-3 w-3" />
                      {selectedOverride.overridden_by?.slice(0, 8) ?? "System"}…
                    </div>
                  </div>
                  <p className="text-xs text-foreground"><span className="font-medium">Reason:</span> {selectedOverride.override_reason}</p>
                  {selectedOverride.previous_blockers_snapshot && (
                    <div className="text-[10px] text-muted-foreground">
                      <span className="font-medium">Original blockers:</span>{" "}
                      {(selectedOverride.previous_blockers_snapshot as any)?.blockers?.join(", ") ||
                       (selectedOverride.previous_blockers_snapshot as any)?.missing?.join(", ") ||
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
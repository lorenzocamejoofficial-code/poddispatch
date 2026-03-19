import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  Truck, Users, Clock, ArrowRight, Zap, MapPin, RefreshCw,
  CheckCircle2, Navigation, UserCheck, Loader2, Building2, X, Phone, Calendar, FileText,
  AlertCircle, CheckCheck, ClipboardCheck, Timer, PauseCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HelpButton } from "@/components/help/HelpButton";
import { CrewDocumentationPanel } from "@/components/crew/CrewDocumentationPanel";
import { toast } from "sonner";
import { format } from "date-fns";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const AUTO_REFRESH_MS = 45_000;

interface NotReadyAlert {
  id: string;
  note: string | null;
  created_at: string;
  status: string;
}

interface LegRow {
  id: string;
  leg_type: string;
  patient_name: string;
  patient_dob: string | null;
  patient_phone: string | null;
  patient_notes: string | null;
  patient_weight: number | null;
  pickup_time: string | null;
  chair_time: string | null;
  pickup_location: string;
  destination_location: string;
  estimated_duration_minutes: number | null;
  notes: string | null;
  slot_id: string | null;
  slot_status: string;
  not_ready_alert: NotReadyAlert | null;
  trip_id: string | null;
  trip_loaded_miles: number | null;
  trip_signature: boolean;
  trip_pcs: boolean;
  trip_status: string | null;
  trip_doc_complete: boolean;
  is_oneoff?: boolean;
  active_timer: {
    id: string;
    hold_type: string;
    started_at: string;
    current_level: string;
  } | null;
}

interface SheetData {
  companyName: string;
  truckName: string;
  truckId: string;
  companyId: string | null;
  date: string;
  member1: string | null;
  member2: string | null;
  legs: LegRow[];
}

const STATUS_FLOW = ["pending", "en_route", "arrived", "with_patient", "transporting", "completed"] as const;
const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  en_route: "En Route",
  arrived: "On Scene",
  with_patient: "With Patient",
  transporting: "Transporting",
  completed: "Complete",
};
const STATUS_ICONS: Record<string, any> = {
  pending: Clock,
  en_route: Navigation,
  arrived: MapPin,
  with_patient: UserCheck,
  transporting: Loader2,
  completed: CheckCircle2,
};

function getEdgeFunctionUrl(path: string) {
  return `${SUPABASE_URL}/functions/v1/${path}`;
}

function formatDisplayDate(dateStr: string) {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return format(dt, "EEEE, MMMM d, yyyy");
  } catch { return dateStr; }
}

function formatTime(t: string | null) {
  if (!t) return null;
  try {
    const [h, m] = t.split(":").map(Number);
    const dt = new Date();
    dt.setHours(h, m);
    return format(dt, "h:mm a");
  } catch { return t; }
}

// Inline elapsed timer display
function TimerElapsed({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const update = () => setElapsed(Math.floor((Date.now() - start) / 60000));
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [startedAt]);
  return <span className="text-[10px] font-mono font-bold">{elapsed}m</span>;
}

export default function DailyRunSheet() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SheetData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [updatingSlot, setUpdatingSlot] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<LegRow | null>(null);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Not Ready state
  const [notReadyLeg, setNotReadyLeg] = useState<LegRow | null>(null);
  const [notReadyNote, setNotReadyNote] = useState("");
  const [submittingNotReady, setSubmittingNotReady] = useState(false);
  const [clearingAlert, setClearingAlert] = useState<string | null>(null);

  // Wait timer state
  const [startingWait, setStartingWait] = useState<string | null>(null);

  // Trip capture state
  const [captureLeg, setCaptureLeg] = useState<LegRow | null>(null);
  const [captureMiles, setCaptureMiles] = useState("");
  const [submittingCapture, setSubmittingCapture] = useState(false);

  const startWaitTimer = async (leg: LegRow, holdType: "wait_patient" | "wait_offload") => {
    if (!leg.trip_id) { toast.error("No trip record linked"); return; }
    setStartingWait(leg.id);
    try {
      const res = await fetch(
        getEdgeFunctionUrl(`crew-run-sheet?token=${encodeURIComponent(token!)}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start_wait", trip_id: leg.trip_id, slot_id: leg.slot_id, hold_type: holdType }),
        }
      );
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Failed to start timer"); }
      else {
        toast.success(holdType === "wait_patient" ? "Patient wait timer started" : "Offload wait timer started");
        setData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            legs: prev.legs.map(l => l.id === leg.id ? {
              ...l,
              active_timer: { id: json.timer_id, hold_type: holdType, started_at: new Date().toISOString(), current_level: "green" },
            } : l),
          };
        });
      }
    } catch { toast.error("Network error"); }
    setStartingWait(null);
  };

  const endWaitTimer = async (leg: LegRow) => {
    if (!leg.active_timer) return;
    setStartingWait(leg.id);
    try {
      const res = await fetch(
        getEdgeFunctionUrl(`crew-run-sheet?token=${encodeURIComponent(token!)}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "end_wait", timer_id: leg.active_timer.id }),
        }
      );
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Failed to end timer"); }
      else {
        toast.success("Wait timer ended");
        setData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            legs: prev.legs.map(l => l.id === leg.id ? { ...l, active_timer: null } : l),
          };
        });
      }
    } catch { toast.error("Network error"); }
    setStartingWait(null);
  };

  // Documentation panel state
  const [docLeg, setDocLeg] = useState<LegRow | null>(null);

  const submitTripCapture = async (leg: LegRow, updates: { loaded_miles?: number; signature_obtained?: boolean; pcs_attached?: boolean; complete?: boolean }) => {
    if (!leg.trip_id) { toast.error("No trip record linked"); return; }
    setSubmittingCapture(true);
    try {
      const res = await fetch(
        getEdgeFunctionUrl(`crew-run-sheet?token=${encodeURIComponent(token!)}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update_trip", trip_id: leg.trip_id, ...updates }),
        }
      );
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Failed"); }
      else {
        toast.success(updates.complete ? "Trip completed!" : "Trip updated");
        setData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            legs: prev.legs.map(l => l.id === leg.id ? {
              ...l,
              trip_loaded_miles: updates.loaded_miles ?? l.trip_loaded_miles,
              trip_signature: updates.signature_obtained ?? l.trip_signature,
              trip_pcs: updates.pcs_attached ?? l.trip_pcs,
              trip_status: updates.complete ? "completed" : l.trip_status,
            } : l),
          };
        });
        setCaptureLeg(null);
      }
    } catch { toast.error("Network error"); }
    setSubmittingCapture(false);
  };

  const fetchSheet = useCallback(async (silent = false) => {
    if (!token) { setError("No token provided"); setLoading(false); return; }

    try {
      const res = await fetch(
        getEdgeFunctionUrl(`crew-run-sheet?token=${encodeURIComponent(token)}`),
        { method: "GET" }
      );
      const json = await res.json();

      if (!res.ok) {
        if (res.status === 403) setExpired(true);
        setError(json.error ?? "Could not load schedule.");
        setLoading(false);
        return;
      }

      setData(json);
      setLastUpdated(new Date());
    } catch {
      if (!silent) setError("Network error. Please try again.");
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    fetchSheet();
    autoRefreshRef.current = setInterval(() => fetchSheet(true), AUTO_REFRESH_MS);
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [fetchSheet]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSheet();
    setRefreshing(false);
  };

  const advanceStatus = async (leg: LegRow) => {
    if (!leg.slot_id) return;
    const currentIdx = STATUS_FLOW.indexOf(leg.slot_status as any);
    if (currentIdx >= STATUS_FLOW.length - 1) return;
    const nextStatus = STATUS_FLOW[currentIdx + 1];

    setUpdatingSlot(leg.slot_id);
    try {
      const res = await fetch(
        getEdgeFunctionUrl(`crew-run-sheet?token=${encodeURIComponent(token!)}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slot_id: leg.slot_id, next_status: nextStatus }),
        }
      );
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Failed to update status");
      } else {
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            legs: prev.legs.map((l) =>
              l.slot_id === leg.slot_id ? { ...l, slot_status: nextStatus } : l
            ),
          };
        });
        setLastUpdated(new Date());
      }
    } catch {
      toast.error("Network error. Please try again.");
    }
    setUpdatingSlot(null);
  };

  const submitNotReady = async () => {
    if (!notReadyLeg || !data) return;
    setSubmittingNotReady(true);
    try {
      const res = await fetch(
        getEdgeFunctionUrl(`crew-run-sheet?token=${encodeURIComponent(token!)}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "not_ready",
            leg_id: notReadyLeg.id,
            note: notReadyNote,
            company_id: data.companyId,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to send alert");
      } else {
        toast.success("Dispatch has been notified");
        const newAlert: NotReadyAlert = {
          id: json.alert_id,
          note: notReadyNote.trim() || null,
          created_at: json.created_at,
          status: "open",
        };
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            legs: prev.legs.map((l) =>
              l.id === notReadyLeg.id ? { ...l, not_ready_alert: newAlert } : l
            ),
          };
        });
        setNotReadyLeg(null);
        setNotReadyNote("");
      }
    } catch {
      toast.error("Network error. Please try again.");
    }
    setSubmittingNotReady(false);
  };

  const clearNotReady = async (leg: LegRow) => {
    if (!leg.not_ready_alert) return;
    setClearingAlert(leg.id);
    try {
      const res = await fetch(
        getEdgeFunctionUrl(`crew-run-sheet?token=${encodeURIComponent(token!)}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "clear_not_ready", alert_id: leg.not_ready_alert.id }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to clear alert");
      } else {
        toast.success("Patient ready — alert cleared");
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            legs: prev.legs.map((l) =>
              l.id === leg.id ? { ...l, not_ready_alert: null } : l
            ),
          };
        });
      }
    } catch {
      toast.error("Network error. Please try again.");
    }
    setClearingAlert(null);
  };

  const openInMaps = (address: string) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading schedule...</p>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center max-w-xs">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <Clock className="h-6 w-6 text-destructive" />
          </div>
          <p className="text-lg font-semibold text-foreground">Link Expired</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This run sheet link is no longer valid. Contact dispatch for an updated link.
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">Schedule Unavailable</p>
          <p className="mt-1 text-sm text-muted-foreground">{error ?? "Could not load schedule."}</p>
        </div>
      </div>
    );
  }

  // Documentation panel view — full screen overlay
  if (docLeg && data) {
    const crewNames = [data.member1, data.member2].filter(Boolean).join(" & ");
    return (
      <CrewDocumentationPanel
        legId={docLeg.id}
        tripId={docLeg.trip_id!}
        patientName={docLeg.patient_name}
        pickupLocation={docLeg.pickup_location}
        destinationLocation={docLeg.destination_location}
        crewNames={crewNames}
        existingMiles={docLeg.trip_loaded_miles}
        existingSignature={docLeg.trip_signature}
        existingPcs={docLeg.trip_pcs}
        token={token!}
        edgeFunctionUrl={getEdgeFunctionUrl("crew-run-sheet")}
        onClose={() => setDocLeg(null)}
        onSubmitted={() => {
          setDocLeg(null);
          fetchSheet();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            {data.companyName && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {data.companyName}
              </p>
            )}
            <p className="text-xs font-bold text-primary uppercase tracking-wide">Daily Run Sheet</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Truck className="h-4 w-4 text-foreground" />
              <span className="text-base font-bold text-foreground">{data.truckName}</span>
            </div>
            <p className="text-xs text-muted-foreground">{formatDisplayDate(data.date)}</p>
            {(data.member1 || data.member2) && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <Users className="h-3 w-3" />
                <span>{[data.member1, data.member2].filter(Boolean).join(" & ")}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1">
              <HelpButton routeKey="/crew/:token" />
              <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing} className="h-8 w-8">
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>
            {lastUpdated && (
              <p className="text-[10px] text-muted-foreground text-right">
                Updated {format(lastUpdated, "h:mm a")}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Runs */}
      <div className="p-3 space-y-3">
        {data.legs.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">No runs assigned for this date.</p>
            <p className="text-xs text-muted-foreground mt-1">Check back after dispatch updates the schedule.</p>
          </div>
        ) : (
          data.legs.map((leg, idx) => {
            const isHeavy = (leg.patient_weight ?? 0) > 200;
            const isCompleted = leg.slot_status === "completed";
            const isCancelled = leg.slot_status === "cancelled";
            const StatusIcon = STATUS_ICONS[leg.slot_status] ?? Clock;
            const currentIdx = STATUS_FLOW.indexOf(leg.slot_status as any);
            const nextStatus = currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null;
            const hasNotReady = !!leg.not_ready_alert;

            return (
              <div
                key={leg.id}
                className={`rounded-lg border bg-card p-3 ${isCompleted ? "opacity-60" : ""} ${
                  isCancelled ? "border-destructive/40 bg-destructive/5 opacity-70" : ""
                } ${
                  hasNotReady ? "border-[hsl(var(--status-red))]/50" : ""
                }`}
              >
                {/* Row header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-muted-foreground w-5">#{idx + 1}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      leg.leg_type === "A"
                        ? "bg-primary/10 text-primary"
                        : "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]"
                    }`}>{leg.leg_type}-LEG</span>
                    <button
                      className="font-semibold text-card-foreground text-sm underline decoration-dotted underline-offset-2 hover:text-primary transition-colors"
                      onClick={() => setSelectedPatient(leg)}
                    >
                      {leg.patient_name}
                    </button>
                    {leg.is_oneoff && (
                      <span className="rounded-full bg-accent/80 text-accent-foreground px-1.5 py-0.5 text-[9px] font-bold shrink-0">ONE-OFF</span>
                    )}
                    {isHeavy && <Zap className="h-3.5 w-3.5 text-[hsl(var(--status-yellow))]" />}
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 ${
                    isCancelled
                      ? "bg-destructive/15 text-destructive"
                      : isCompleted
                      ? "bg-[hsl(var(--status-green-bg))] text-[hsl(var(--status-green))]"
                      : leg.slot_status === "pending"
                      ? "bg-[hsl(var(--status-pending-bg))] text-[hsl(var(--status-pending))]"
                      : "bg-primary/10 text-primary"
                  }`}>
                    {isCancelled ? <X className="h-3 w-3" /> : <StatusIcon className="h-3 w-3" />}
                    {isCancelled ? "Cancelled" : (STATUS_LABELS[leg.slot_status] ?? leg.slot_status)}
                  </span>
                </div>

                {/* NOT READY badge */}
                {hasNotReady && (
                  <div className="mb-2 flex items-start justify-between gap-2 rounded-md border border-[hsl(var(--status-red))]/40 bg-[hsl(var(--status-red))]/8 px-2.5 py-2">
                    <div className="flex items-start gap-1.5 min-w-0">
                      <AlertCircle className="h-3.5 w-3.5 text-[hsl(var(--status-red))] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-[hsl(var(--status-red))] uppercase tracking-wide">
                          Not Ready · {format(new Date(leg.not_ready_alert!.created_at), "h:mm a")}
                        </span>
                        {leg.not_ready_alert!.note && (
                          <p className="text-xs text-foreground mt-0.5 truncate">{leg.not_ready_alert!.note}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] shrink-0 border-[hsl(var(--status-green))]/50 text-[hsl(var(--status-green))] hover:bg-[hsl(var(--status-green-bg))]"
                      disabled={clearingAlert === leg.id}
                      onClick={() => clearNotReady(leg)}
                    >
                      <CheckCheck className="h-3 w-3 mr-1" />
                      {clearingAlert === leg.id ? "Clearing..." : "Patient Ready"}
                    </Button>
                  </div>
                )}

                {/* Details */}
                <div className="space-y-1.5 text-sm">
                  {leg.pickup_time && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        Pickup: <span className="font-medium text-card-foreground">{formatTime(leg.pickup_time)}</span>
                        {leg.chair_time && (
                          <span className="ml-2">Chair: <span className="font-medium text-card-foreground">{formatTime(leg.chair_time)}</span></span>
                        )}
                      </span>
                    </div>
                  )}
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <button
                        onClick={() => openInMaps(leg.pickup_location)}
                        className="text-left text-xs underline decoration-dotted hover:text-foreground truncate"
                      >
                        {leg.pickup_location}
                      </button>
                      <div className="flex items-center gap-1">
                        <ArrowRight className="h-3 w-3 shrink-0" />
                        <button
                          onClick={() => openInMaps(leg.destination_location)}
                          className="text-left text-xs underline decoration-dotted hover:text-foreground truncate"
                        >
                          {leg.destination_location}
                        </button>
                      </div>
                    </div>
                  </div>
                  {leg.estimated_duration_minutes && (
                    <p className="text-xs text-muted-foreground pl-5">~{leg.estimated_duration_minutes} min travel</p>
                  )}
                  {isHeavy && (
                    <p className="text-xs font-semibold text-[hsl(var(--status-yellow))] pl-5">⚡ Electric stretcher required</p>
                  )}
                  {leg.notes && (
                    <p className="text-xs text-muted-foreground italic pl-5">📋 {leg.notes}</p>
                  )}
                </div>

                {/* Active wait timer indicator */}
                {leg.active_timer && (
                  <div className={`mt-2 flex items-center justify-between rounded-md border px-2.5 py-2 ${
                    leg.active_timer.current_level === "red"
                      ? "border-[hsl(var(--status-red))]/50 bg-[hsl(var(--status-red))]/8"
                      : leg.active_timer.current_level === "orange" || leg.active_timer.current_level === "yellow"
                      ? "border-[hsl(var(--status-yellow))]/50 bg-[hsl(var(--status-yellow-bg))]"
                      : "border-[hsl(var(--status-green))]/30 bg-[hsl(var(--status-green-bg))]"
                  }`}>
                    <div className="flex items-center gap-1.5">
                      <Timer className={`h-3.5 w-3.5 animate-pulse ${
                        leg.active_timer.current_level === "red" ? "text-[hsl(var(--status-red))]" :
                        leg.active_timer.current_level === "orange" || leg.active_timer.current_level === "yellow" ? "text-[hsl(var(--status-yellow))]" :
                        "text-[hsl(var(--status-green))]"
                      }`} />
                      <span className="text-[10px] font-bold">
                        {leg.active_timer.hold_type === "wait_patient" ? "Patient Wait" : "Offload Wait"}
                      </span>
                      <TimerElapsed startedAt={leg.active_timer.started_at} />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] border-[hsl(var(--status-green))]/50 text-[hsl(var(--status-green))]"
                      disabled={startingWait === leg.id}
                      onClick={() => endWaitTimer(leg)}
                    >
                      <PauseCircle className="h-3 w-3 mr-1" />
                      End Wait
                    </Button>
                  </div>
                )}

                {/* Action buttons — hide for cancelled runs */}
                {isCancelled && (
                  <div className="mt-2 text-center">
                    <p className="text-[10px] text-destructive font-semibold">This run has been cancelled by dispatch</p>
                  </div>
                )}
                {!isCancelled && (
                <div className="mt-3 flex flex-col gap-2">
                  {nextStatus && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={updatingSlot === leg.slot_id}
                      onClick={() => advanceStatus(leg)}
                    >
                      {updatingSlot === leg.slot_id ? "Updating..." : `Mark ${STATUS_LABELS[nextStatus]}`}
                    </Button>
                  )}

                  {/* Trip documentation — show Complete Run button when trip exists and not documented */}
                  {leg.trip_id && !leg.trip_doc_complete && leg.trip_status !== "ready_for_billing" && (
                    <Button
                      size="sm"
                      className="w-full bg-[hsl(var(--status-green))] hover:bg-[hsl(var(--status-green))]/90 text-white"
                      onClick={() => setDocLeg(leg)}
                    >
                      <ClipboardCheck className="h-4 w-4 mr-1.5" />
                      Complete Run Documentation
                    </Button>
                  )}
                  {leg.trip_doc_complete && (
                    <p className="text-[10px] text-center text-[hsl(var(--status-green))] font-semibold">✓ Documentation Complete — Ready for Billing</p>
                  )}
                  {!leg.trip_doc_complete && leg.trip_status === "completed" && (
                    <div className="flex items-center gap-1.5 justify-center">
                      <AlertCircle className="h-3 w-3 text-[hsl(var(--status-yellow))]" />
                      <p className="text-[10px] text-[hsl(var(--status-yellow))] font-semibold">Missing documentation</p>
                    </div>
                  )}

                  {/* Patient Not Ready button */}
                  {!isCompleted && !hasNotReady && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-[hsl(var(--status-red))] hover:bg-[hsl(var(--status-red))]/8 hover:text-[hsl(var(--status-red))] border border-[hsl(var(--status-red))]/20"
                      onClick={() => { setNotReadyLeg(leg); setNotReadyNote(""); }}
                    >
                      <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
                      Patient Not Ready
                    </Button>
                  )}

                  {/* Wait timer buttons — only when trip exists and not completed */}
                  {!isCompleted && leg.trip_id && !leg.active_timer && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-[10px] border-[hsl(var(--status-yellow))]/30 text-[hsl(var(--status-yellow))] hover:bg-[hsl(var(--status-yellow-bg))]"
                        disabled={startingWait === leg.id}
                        onClick={() => startWaitTimer(leg, "wait_patient")}
                      >
                        <Timer className="h-3 w-3 mr-1" />
                        Wait: Patient
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-[10px] border-[hsl(var(--status-yellow))]/30 text-[hsl(var(--status-yellow))] hover:bg-[hsl(var(--status-yellow-bg))]"
                        disabled={startingWait === leg.id}
                        onClick={() => startWaitTimer(leg, "wait_offload")}
                      >
                        <Timer className="h-3 w-3 mr-1" />
                        Wait: Offload
                      </Button>
                    </div>
                  )}
                </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Patient Not Ready Dialog */}
      <Dialog open={!!notReadyLeg} onOpenChange={(o) => { if (!o) { setNotReadyLeg(null); setNotReadyNote(""); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[hsl(var(--status-red))]">
              <AlertCircle className="h-4 w-4" />
              Patient Not Ready
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{notReadyLeg?.patient_name}</span> — Run #{notReadyLeg ? data.legs.indexOf(notReadyLeg) + 1 : ""}
              {notReadyLeg?.pickup_time && (
                <span className="ml-1">(Pickup: {formatTime(notReadyLeg.pickup_time)})</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Dispatch will be notified immediately. Add an optional note with more detail.
            </p>
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                Note (optional)
              </label>
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                rows={3}
                placeholder='e.g. "Facility says 15 min", "Patient in bathroom", "Nurse delayed paperwork"'
                value={notReadyNote}
                onChange={(e) => setNotReadyNote(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-[hsl(var(--status-red))] hover:bg-[hsl(var(--status-red))]/90 text-white"
                disabled={submittingNotReady}
                onClick={submitNotReady}
              >
                {submittingNotReady ? "Sending..." : "Notify Dispatch"}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setNotReadyLeg(null); setNotReadyNote(""); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Patient Detail Modal */}
      <Dialog open={!!selectedPatient} onOpenChange={(o) => { if (!o) setSelectedPatient(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Patient Info
            </DialogTitle>
          </DialogHeader>
          {selectedPatient && (
            <div className="space-y-3 pt-1">
              <div>
                <p className="text-lg font-bold text-foreground">{selectedPatient.patient_name}</p>
                {selectedPatient.patient_weight && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Weight: {selectedPatient.patient_weight} lbs
                    {selectedPatient.patient_weight > 200 && (
                      <span className="ml-2 text-[hsl(var(--status-yellow))] font-semibold">⚡ Electric stretcher</span>
                    )}
                  </p>
                )}
              </div>

              <div className="space-y-2 text-sm">
                {selectedPatient.patient_dob && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span>DOB: <span className="font-medium text-foreground">{selectedPatient.patient_dob}</span></span>
                  </div>
                )}
                {selectedPatient.patient_phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <a
                      href={`tel:${selectedPatient.patient_phone}`}
                      className="font-medium text-primary underline"
                    >
                      {selectedPatient.patient_phone}
                    </a>
                  </div>
                )}
                <div className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs uppercase font-semibold tracking-wide mb-0.5">Pickup</p>
                    <button
                      className="text-left text-foreground text-xs underline decoration-dotted"
                      onClick={() => openInMaps(selectedPatient.pickup_location)}
                    >
                      {selectedPatient.pickup_location}
                    </button>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs uppercase font-semibold tracking-wide mb-0.5">Destination</p>
                    <button
                      className="text-left text-foreground text-xs underline decoration-dotted"
                      onClick={() => openInMaps(selectedPatient.destination_location)}
                    >
                      {selectedPatient.destination_location}
                    </button>
                  </div>
                </div>
                {selectedPatient.patient_notes && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs uppercase font-semibold tracking-wide mb-0.5">Notes</p>
                      <p className="text-foreground text-xs">{selectedPatient.patient_notes}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  Truck, Users, Clock, ArrowRight, Zap, MapPin, RefreshCw,
  CheckCircle2, Navigation, UserCheck, Loader2, Building2, X, Phone, Calendar, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const AUTO_REFRESH_MS = 45_000;

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
}

interface SheetData {
  companyName: string;
  truckName: string;
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
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing} className="h-8 w-8">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
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
            const StatusIcon = STATUS_ICONS[leg.slot_status] ?? Clock;
            const currentIdx = STATUS_FLOW.indexOf(leg.slot_status as any);
            const nextStatus = currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null;

            return (
              <div
                key={leg.id}
                className={`rounded-lg border bg-card p-3 ${isCompleted ? "opacity-60" : ""}`}
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
                    {isHeavy && <Zap className="h-3.5 w-3.5 text-[hsl(var(--status-yellow))]" />}
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 ${
                    isCompleted
                      ? "bg-[hsl(var(--status-green-bg))] text-[hsl(var(--status-green))]"
                      : leg.slot_status === "pending"
                      ? "bg-[hsl(var(--status-pending-bg))] text-[hsl(var(--status-pending))]"
                      : "bg-primary/10 text-primary"
                  }`}>
                    <StatusIcon className="h-3 w-3" />
                    {STATUS_LABELS[leg.slot_status] ?? leg.slot_status}
                  </span>
                </div>

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

                {nextStatus && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    disabled={updatingSlot === leg.slot_id}
                    onClick={() => advanceStatus(leg)}
                  >
                    {updatingSlot === leg.slot_id ? "Updating..." : `Mark ${STATUS_LABELS[nextStatus]}`}
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>

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
                {selectedPatient.chair_time && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>Chair time: <span className="font-medium text-foreground">{formatTime(selectedPatient.chair_time)}</span></span>
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

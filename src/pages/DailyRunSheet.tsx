import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Truck, Users, Clock, ArrowRight, Zap, MapPin, RefreshCw, CheckCircle2, Navigation, UserCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface LegRow {
  id: string;
  leg_type: string;
  patient_name: string;
  pickup_time: string | null;
  chair_time: string | null;
  pickup_location: string;
  destination_location: string;
  estimated_duration_minutes: number | null;
  notes: string | null;
  patient_weight: number | null;
  slot_id: string | null;
  slot_status: string;
}

interface SheetData {
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

export default function DailyRunSheet() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SheetData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingSlot, setUpdatingSlot] = useState<string | null>(null);

  const fetchSheet = useCallback(async () => {
    if (!token) { setError("No token provided"); setLoading(false); return; }

    try {
      const res = await fetch(
        getEdgeFunctionUrl(`crew-run-sheet?token=${encodeURIComponent(token)}`),
        { method: "GET" }
      );
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Could not load schedule.");
        setLoading(false);
        return;
      }

      setData(json);
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchSheet(); }, [fetchSheet]);

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
      <header className="border-b bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold text-foreground">{data.truckName}</h1>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{data.date}</p>
            {(data.member1 || data.member2) && (
              <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {[data.member1, data.member2].filter(Boolean).join(" & ")}
              </div>
            )}
          </div>
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      <div className="p-4 space-y-3">
        {data.legs.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">No runs assigned for this date.</p>
        ) : (
          data.legs.map((leg, idx) => {
            const isHeavy = (leg.patient_weight ?? 0) > 200;
            const isCompleted = leg.slot_status === "completed";
            const StatusIcon = STATUS_ICONS[leg.slot_status] ?? Clock;
            const currentIdx = STATUS_FLOW.indexOf(leg.slot_status as any);
            const nextStatus = currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null;

            return (
              <div key={leg.id} className={`rounded-lg border bg-card p-4 ${isCompleted ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      leg.leg_type === "A" ? "bg-primary/10 text-primary" : "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]"
                    }`}>{leg.leg_type}-LEG</span>
                    <span className="font-semibold text-card-foreground">{leg.patient_name}</span>
                    {isHeavy && <Zap className="h-3.5 w-3.5 text-[hsl(var(--status-yellow))]" />}
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    isCompleted ? "bg-[hsl(var(--status-green-bg))] text-[hsl(var(--status-green))]" :
                    leg.slot_status === "pending" ? "bg-[hsl(var(--status-pending-bg))] text-[hsl(var(--status-pending))]" :
                    "bg-primary/10 text-primary"
                  }`}>
                    <StatusIcon className="h-3 w-3" />
                    {STATUS_LABELS[leg.slot_status] ?? leg.slot_status}
                  </span>
                </div>

                <div className="space-y-1.5 text-sm">
                  {leg.pickup_time && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Pickup: <span className="font-medium text-card-foreground">{leg.pickup_time}</span></span>
                      {leg.chair_time && <span className="ml-2">Chair: <span className="font-medium text-card-foreground">{leg.chair_time}</span></span>}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <button onClick={() => openInMaps(leg.pickup_location)} className="text-left underline decoration-dotted hover:text-foreground">
                      {leg.pickup_location}
                    </button>
                    <ArrowRight className="h-3 w-3 shrink-0" />
                    <button onClick={() => openInMaps(leg.destination_location)} className="text-left underline decoration-dotted hover:text-foreground">
                      {leg.destination_location}
                    </button>
                  </div>
                  {leg.estimated_duration_minutes && (
                    <p className="text-xs text-muted-foreground">~{leg.estimated_duration_minutes} min travel</p>
                  )}
                  {isHeavy && (
                    <p className="text-xs font-semibold text-[hsl(var(--status-yellow))]">⚡ Electric stretcher required</p>
                  )}
                  {leg.notes && (
                    <p className="text-xs text-muted-foreground italic">{leg.notes}</p>
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
    </div>
  );
}

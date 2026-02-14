import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Truck, Users, Clock, ArrowRight, Zap, MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

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
}

interface SheetData {
  truckName: string;
  date: string;
  member1: string | null;
  member2: string | null;
  legs: LegRow[];
}

export default function DailyRunSheet() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SheetData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSheet = async () => {
    if (!token) { setError("No token provided"); setLoading(false); return; }

    // Look up the share token
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("crew_share_tokens")
      .select("truck_id, valid_from, valid_until")
      .eq("token", token)
      .eq("active", true)
      .maybeSingle();

    if (tokenErr || !tokenRow) {
      setError("Invalid or expired share link.");
      setLoading(false);
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const scheduleDate = today >= tokenRow.valid_from && today <= tokenRow.valid_until ? today : tokenRow.valid_from;

    // Fetch truck name
    const { data: truck } = await supabase
      .from("trucks")
      .select("name")
      .eq("id", tokenRow.truck_id)
      .single();

    // Fetch crew for this date
    const { data: crew } = await supabase
      .from("crews")
      .select("member1:profiles!crews_member1_id_fkey(full_name), member2:profiles!crews_member2_id_fkey(full_name)")
      .eq("truck_id", tokenRow.truck_id)
      .eq("active_date", scheduleDate)
      .maybeSingle();

    // Fetch legs assigned to this truck for this date
    const { data: slots } = await supabase
      .from("truck_run_slots")
      .select("leg_id, slot_order")
      .eq("truck_id", tokenRow.truck_id)
      .eq("run_date", scheduleDate)
      .order("slot_order");

    const legIds = (slots ?? []).map((s) => s.leg_id);

    let legs: LegRow[] = [];
    if (legIds.length > 0) {
      const { data: legData } = await supabase
        .from("scheduling_legs")
        .select("*, patient:patients!scheduling_legs_patient_id_fkey(first_name, last_name, weight_lbs, notes)")
        .in("id", legIds);

      // Sort by slot_order
      const orderMap = new Map((slots ?? []).map((s) => [s.leg_id, s.slot_order]));
      legs = (legData ?? [])
        .map((l: any) => ({
          id: l.id,
          leg_type: l.leg_type,
          patient_name: l.patient ? `${l.patient.first_name} ${l.patient.last_name}` : "Unknown",
          pickup_time: l.pickup_time,
          chair_time: l.chair_time,
          pickup_location: l.pickup_location,
          destination_location: l.destination_location,
          estimated_duration_minutes: l.estimated_duration_minutes,
          notes: l.patient?.notes ?? l.notes ?? null,
          patient_weight: l.patient?.weight_lbs ?? null,
        }))
        .sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
    }

    setData({
      truckName: truck?.name ?? "Unknown Truck",
      date: scheduleDate,
      member1: (crew as any)?.member1?.full_name ?? null,
      member2: (crew as any)?.member2?.full_name ?? null,
      legs,
    });
    setLoading(false);
  };

  useEffect(() => { fetchSheet(); }, [token]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSheet();
    setRefreshing(false);
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
      {/* Header */}
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

      {/* Legs */}
      <div className="p-4 space-y-3">
        {data.legs.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">No runs assigned for this date.</p>
        ) : (
          data.legs.map((leg, idx) => {
            const isHeavy = (leg.patient_weight ?? 0) > 200;
            return (
              <div key={leg.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      leg.leg_type === "A" ? "bg-primary/10 text-primary" : "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]"
                    }`}>{leg.leg_type}-LEG</span>
                    <span className="font-semibold text-card-foreground">{leg.patient_name}</span>
                    {isHeavy && <Zap className="h-3.5 w-3.5 text-[hsl(var(--status-yellow))]" />}
                  </div>
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

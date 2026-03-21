import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/dispatch/StatusBadge";
import { Button } from "@/components/ui/button";
import { LogOut, Truck, Users, MapPin, ChevronLeft, Weight } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { useNavigate } from "react-router-dom";

type RunStatus = Database["public"]["Enums"]["run_status"];

const STATUS_FLOW: RunStatus[] = ["en_route", "arrived", "with_patient", "transporting", "completed"];
const STATUS_LABELS: Record<string, string> = {
  en_route: "En Route",
  arrived: "Arrived",
  with_patient: "With Patient",
  transporting: "Transporting",
  completed: "Completed",
};

interface RunDetail {
  id: string;
  patient_name: string;
  pickup_address: string | null;
  dropoff_facility: string | null;
  pickup_time: string | null;
  trip_type: string;
  status: RunStatus;
  notes: string | null;
  weight_lbs: number | null;
}

export default function CrewView() {
  const { user, signOut, profileId } = useAuth();
  const navigate = useNavigate();
  const [truckName, setTruckName] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [runs, setRuns] = useState<RunDetail[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const today = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`; })();

  const fetchMyRuns = async () => {
    if (!profileId) return;

    // Find my crew for today
    const { data: crewData } = await supabase
      .from("crews")
      .select("*, truck:trucks!crews_truck_id_fkey(name), member1:profiles!crews_member1_id_fkey(id, full_name), member2:profiles!crews_member2_id_fkey(id, full_name)")
      .eq("active_date", today)
      .or(`member1_id.eq.${profileId},member2_id.eq.${profileId}`)
      .maybeSingle();

    if (!crewData) {
      setLoading(false);
      return;
    }

    setTruckName(crewData.truck?.name ?? "");
    const partner =
      crewData.member1?.id === profileId
        ? crewData.member2?.full_name
        : crewData.member1?.full_name;
    setPartnerName(partner ?? "");

    // Fetch runs for this crew
    const { data: runData } = await supabase
      .from("runs")
      .select("*, patient:patients!runs_patient_id_fkey(first_name, last_name, pickup_address, dropoff_facility, weight_lbs, notes)")
      .eq("crew_id", crewData.id)
      .eq("run_date", today)
      .order("sort_order");

    const mappedRuns: RunDetail[] = (runData ?? []).map((r) => ({
      id: r.id,
      patient_name: r.patient ? `${r.patient.first_name} ${r.patient.last_name}` : "Unknown",
      pickup_address: r.patient?.pickup_address ?? null,
      dropoff_facility: r.patient?.dropoff_facility ?? null,
      pickup_time: r.pickup_time,
      trip_type: r.trip_type,
      status: r.status,
      notes: r.patient?.notes ?? r.notes ?? null,
      weight_lbs: r.patient?.weight_lbs ?? null,
    }));

    setRuns(mappedRuns);
    if (selectedRun) {
      const updated = mappedRuns.find((r) => r.id === selectedRun.id);
      if (updated) setSelectedRun(updated);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMyRuns();

    const channel = supabase
      .channel("crew-runs")
      .on("postgres_changes", { event: "*", schema: "public", table: "runs" }, () => fetchMyRuns())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profileId]);

  const updateStatus = async (runId: string, newStatus: RunStatus) => {
    setUpdatingStatus(true);

    // Try to get location
    let lat: number | undefined;
    let lng: number | undefined;
    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        // Location not available, continue without it
      }
    }

    await supabase.from("runs").update({ status: newStatus }).eq("id", runId);
    await supabase.from("status_updates").insert({
      run_id: runId,
      status: newStatus,
      updated_by: user?.id,
      lat,
      lng,
    });

    await fetchMyRuns();
    setUpdatingStatus(false);
  };

  const openInMaps = (address: string) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, "_blank");
  };

  const currentRunIdx = runs.findIndex((r) => r.status !== "completed");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Run detail view
  if (selectedRun) {
    const currentStatusIdx = STATUS_FLOW.indexOf(selectedRun.status);
    const nextStatus = currentStatusIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentStatusIdx + 1] : null;
    const isCompleted = selectedRun.status === "completed";

    return (
      <div className="min-h-screen bg-background p-4">
        <button
          onClick={() => setSelectedRun(null)}
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Back to runs
        </button>

        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">{selectedRun.patient_name}</h2>
            <StatusBadge status={selectedRun.status} />
          </div>

          {selectedRun.pickup_address && (
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Pickup</p>
              <p className="text-sm text-card-foreground">{selectedRun.pickup_address}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => openInMaps(selectedRun.pickup_address!)}
              >
                <MapPin className="mr-1.5 h-3.5 w-3.5" /> Open in Maps
              </Button>
            </div>
          )}

          {selectedRun.dropoff_facility && (
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Dropoff</p>
              <p className="text-sm text-card-foreground">{selectedRun.dropoff_facility}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => openInMaps(selectedRun.dropoff_facility!)}
              >
                <MapPin className="mr-1.5 h-3.5 w-3.5" /> Open in Maps
              </Button>
            </div>
          )}

          {selectedRun.weight_lbs && (
            <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
              selectedRun.weight_lbs > 200 ? "border-[hsl(var(--status-yellow))]/30 bg-[hsl(var(--status-yellow-bg))]" : "bg-card"
            }`}>
              <Weight className="h-4 w-4 text-muted-foreground" />
              <span className="text-card-foreground">{selectedRun.weight_lbs} lbs</span>
              {selectedRun.weight_lbs > 200 && (
                <span className="ml-auto text-xs font-semibold text-[hsl(var(--status-yellow))]">⚡ Electric stretcher required</span>
              )}
            </div>
          )}

          {selectedRun.notes && (
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Notes</p>
              <p className="text-sm text-card-foreground">{selectedRun.notes}</p>
            </div>
          )}

          {/* Status buttons */}
          {!isCompleted && (
            <div className="space-y-2 pt-4">
              {STATUS_FLOW.map((s, i) => {
                const isPast = i <= currentStatusIdx && selectedRun.status !== "pending";
                const isNext = s === nextStatus || (selectedRun.status === "pending" && s === "en_route");
                return (
                  <Button
                    key={s}
                    className="w-full"
                    variant={isPast ? "secondary" : isNext ? "default" : "outline"}
                    disabled={isPast || updatingStatus || (!isNext && !isPast)}
                    onClick={() => isNext && updateStatus(selectedRun.id, s)}
                  >
                    {isPast ? "✓ " : ""}
                    {STATUS_LABELS[s]}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Runs list view
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              <h1 className="font-bold text-foreground">{truckName || "No Truck Assigned"}</h1>
            </div>
            {partnerName && (
              <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Partner: {partnerName}
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={() => { signOut(); navigate("/login"); }}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="p-4">
        {runs.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">
            No runs assigned for today.
          </p>
        ) : (
          <div className="space-y-2">
            {runs.map((run, idx) => (
              <button
                key={run.id}
                onClick={() => setSelectedRun(run)}
                className={`w-full rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent ${
                  idx === currentRunIdx ? "border-primary/40 ring-1 ring-primary/20" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    {idx === currentRunIdx && (
                      <span className="mb-1 inline-block text-[10px] font-bold uppercase tracking-wider text-primary">
                        CURRENT
                      </span>
                    )}
                    <p className="font-medium text-card-foreground">{run.patient_name}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      {run.pickup_time && <span>{run.pickup_time}</span>}
                      <span className="capitalize">{run.trip_type}</span>
                    </div>
                  </div>
                  <StatusBadge status={run.status} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Truck, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";

type TripStatus = Database["public"]["Enums"]["trip_status"];

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  dispatched: "Dispatched",
  en_route_pickup: "En Route",
  on_scene: "On Scene",
  transporting: "Transporting",
  at_destination: "At Destination",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
};

interface RunCard {
  slotId: string;
  slotOrder: number;
  legId: string;
  patientName: string;
  pickupLocation: string;
  destinationLocation: string;
  pickupTime: string | null;
  tripStatus: TripStatus;
  tripId: string | null;
}

export default function CrewDashboard() {
  const { user, signOut, profileId } = useAuth();
  const navigate = useNavigate();
  const [truckName, setTruckName] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [runs, setRuns] = useState<RunCard[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split("T")[0];

  const fetchData = useCallback(async () => {
    if (!profileId) return;

    // 1. Find crew assignment for today
    const { data: crewRow } = await supabase
      .from("crews")
      .select(
        "id, truck_id, member1_id, member2_id, truck:trucks!crews_truck_id_fkey(name), member1:profiles!crews_member1_id_fkey(id, full_name), member2:profiles!crews_member2_id_fkey(id, full_name)"
      )
      .eq("active_date", today)
      .or(`member1_id.eq.${profileId},member2_id.eq.${profileId}`)
      .maybeSingle();

    if (!crewRow) {
      setTruckName("");
      setPartnerName("");
      setRuns([]);
      setLoading(false);
      return;
    }

    setTruckName((crewRow.truck as any)?.name ?? "");
    const m1 = crewRow.member1 as any;
    const m2 = crewRow.member2 as any;
    const partner = m1?.id === profileId ? m2?.full_name : m1?.full_name;
    setPartnerName(partner ?? "");

    const truckId = crewRow.truck_id;

    // 2. Fetch truck_run_slots for this truck today, ordered
    const { data: slots } = await supabase
      .from("truck_run_slots")
      .select("id, leg_id, slot_order")
      .eq("truck_id", truckId)
      .eq("run_date", today)
      .order("slot_order");

    if (!slots || slots.length === 0) {
      setRuns([]);
      setLoading(false);
      return;
    }

    const legIds = slots.map((s) => s.leg_id);

    // 3. Fetch scheduling_legs + patient info
    const { data: legs } = await supabase
      .from("scheduling_legs")
      .select(
        "id, pickup_location, destination_location, pickup_time, patient:patients!scheduling_legs_patient_id_fkey(first_name, last_name)"
      )
      .in("id", legIds);

    // 4. Fetch trip_records for these legs today
    const { data: trips } = await supabase
      .from("trip_records")
      .select("id, leg_id, status")
      .eq("run_date", today)
      .eq("truck_id", truckId)
      .in("leg_id", legIds);

    // Build lookup maps
    const legMap = new Map(
      (legs ?? []).map((l) => [l.id, l])
    );
    const tripMap = new Map(
      (trips ?? []).map((t) => [t.leg_id, t])
    );

    const cards: RunCard[] = slots.map((slot) => {
      const leg = legMap.get(slot.leg_id);
      const trip = tripMap.get(slot.leg_id);
      const patient = leg?.patient as any;
      return {
        slotId: slot.id,
        slotOrder: slot.slot_order,
        legId: slot.leg_id,
        patientName: patient
          ? `${patient.first_name} ${patient.last_name}`
          : "Unknown Patient",
        pickupLocation: leg?.pickup_location ?? "—",
        destinationLocation: leg?.destination_location ?? "—",
        pickupTime: leg?.pickup_time ?? null,
        tripStatus: (trip?.status as TripStatus) ?? "scheduled",
        tripId: trip?.id ?? null,
      };
    });

    setRuns(cards);
    setLoading(false);
  }, [profileId, today]);

  useEffect(() => {
    fetchData();

    // Realtime: refresh on trip_records changes
    const channel = supabase
      .channel("crew-dashboard-trips")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_records" },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading your shift...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold text-foreground">
                {truckName || "No Truck Assigned"}
              </h1>
            </div>
            {partnerName && (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Partner: {partnerName}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              signOut();
              navigate("/login");
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Run cards */}
      <div className="p-4 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Today's Runs · {runs.length}
        </p>

        {runs.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">
            No runs assigned for today.
          </p>
        ) : (
          runs.map((run, idx) => {
            const isActive =
              run.tripStatus !== "completed" &&
              run.tripStatus !== "cancelled" &&
              run.tripStatus !== "no_show";
            const isFirst = idx === runs.findIndex(
              (r) =>
                r.tripStatus !== "completed" &&
                r.tripStatus !== "cancelled" &&
                r.tripStatus !== "no_show"
            );

            return (
              <div
                key={run.slotId}
                className={`rounded-lg border bg-card p-4 ${
                  isFirst && isActive
                    ? "border-primary/40 ring-1 ring-primary/20"
                    : ""
                }`}
              >
                {isFirst && isActive && (
                  <span className="mb-1 inline-block text-[10px] font-bold uppercase tracking-wider text-primary">
                    CURRENT
                  </span>
                )}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-card-foreground truncate">
                      {run.slotOrder + 1}. {run.patientName}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground truncate">
                      <span className="font-medium">PU:</span>{" "}
                      {run.pickupLocation}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      <span className="font-medium">DO:</span>{" "}
                      {run.destinationLocation}
                    </p>
                    {run.pickupTime && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Pickup: {run.pickupTime}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      run.tripStatus === "completed"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : run.tripStatus === "scheduled"
                        ? "bg-muted text-muted-foreground"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}
                  >
                    {STATUS_LABEL[run.tripStatus] ?? run.tripStatus}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

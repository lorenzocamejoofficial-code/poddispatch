import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Truck, Users, ChevronRight, Loader2, Clock, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type TripStatus = Database["public"]["Enums"]["trip_status"];

// Forward-only crew progression
const STATUS_FLOW: TripStatus[] = [
  "scheduled",
  "assigned",
  "en_route",
  "arrived_pickup",
  "loaded",
  "arrived_dropoff",
  "completed",
];

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  assigned: "Assigned",
  en_route: "En Route",
  arrived_pickup: "Arrived at Pickup",
  loaded: "Patient Loaded",
  arrived_dropoff: "Arrived at Dropoff",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
  ready_for_billing: "Ready for Billing",
  patient_not_ready: "Patient Not Ready",
  facility_delay: "Facility Delay",
};

// Label for the "advance" button based on what's next
const NEXT_ACTION_LABEL: Record<string, string> = {
  scheduled: "Start Trip",
  assigned: "Mark En Route",
  en_route: "Arrived at Pickup",
  arrived_pickup: "Patient Loaded",
  loaded: "Arrived at Dropoff",
  arrived_dropoff: "Complete Trip",
};

interface HoldTimer {
  id: string;
  tripId: string;
  holdType: string; // "patient_not_ready" | "facility_delay"
  startedAt: string;
  isActive: boolean;
}

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
  truckId: string;
  crewId: string;
  companyId: string | null;
}

export default function CrewDashboard() {
  const { user, signOut, profileId } = useAuth();
  const navigate = useNavigate();
  const [truckName, setTruckName] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [runs, setRuns] = useState<RunCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingTripId, setUpdatingTripId] = useState<string | null>(null);
  const [holdTimers, setHoldTimers] = useState<HoldTimer[]>([]);
  const [holdLoading, setHoldLoading] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const fetchData = useCallback(async () => {
    if (!profileId) return;

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
    const crewId = crewRow.id;

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

    const { data: legs } = await supabase
      .from("scheduling_legs")
      .select(
        "id, pickup_location, destination_location, pickup_time, patient:patients!scheduling_legs_patient_id_fkey(first_name, last_name)"
      )
      .in("id", legIds);

    const { data: trips } = await supabase
      .from("trip_records")
      .select("id, leg_id, status, company_id")
      .eq("run_date", today)
      .eq("truck_id", truckId)
      .in("leg_id", legIds);

    const legMap = new Map((legs ?? []).map((l) => [l.id, l]));
    const tripMap = new Map((trips ?? []).map((t) => [t.leg_id, t]));

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
        truckId,
        crewId,
        companyId: trip?.company_id ?? null,
      };
    });

    setRuns(cards);

    // Fetch active hold timers for these trips
    const tripIds = cards.map((c) => c.tripId).filter(Boolean) as string[];
    if (tripIds.length > 0) {
      const { data: timers } = await supabase
        .from("hold_timers")
        .select("id, trip_id, hold_type, started_at, is_active")
        .in("trip_id", tripIds)
        .eq("is_active", true);
      setHoldTimers(
        (timers ?? []).map((t) => ({
          id: t.id,
          tripId: t.trip_id,
          holdType: t.hold_type,
          startedAt: t.started_at,
          isActive: t.is_active,
        }))
      );
    } else {
      setHoldTimers([]);
    }

    setLoading(false);
  }, [profileId, today]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel("crew-dashboard-trips")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_records" },
        () => fetchData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hold_timers" },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const advanceStatus = async (run: RunCard) => {
    const currentIdx = STATUS_FLOW.indexOf(run.tripStatus);
    if (currentIdx < 0 || currentIdx >= STATUS_FLOW.length - 1) return;

    const nextStatus = STATUS_FLOW[currentIdx + 1];
    setUpdatingTripId(run.tripId);

    try {
      if (run.tripId) {
        const updateFields: Record<string, any> = { status: nextStatus, updated_at: new Date().toISOString() };
        const now = new Date().toISOString();
        if (nextStatus === "en_route") updateFields.dispatch_time = now;
        if (nextStatus === "arrived_pickup") updateFields.arrived_pickup_at = now;
        if (nextStatus === "loaded") updateFields.loaded_at = now;
        if (nextStatus === "arrived_dropoff") updateFields.arrived_dropoff_at = now;
        if (nextStatus === "completed") updateFields.dropped_at = now;

        const { error } = await supabase
          .from("trip_records")
          .update(updateFields)
          .eq("id", run.tripId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("trip_records").insert({
          leg_id: run.legId,
          truck_id: run.truckId,
          crew_id: run.crewId,
          run_date: today,
          status: nextStatus,
          pickup_location: run.pickupLocation,
          destination_location: run.destinationLocation,
          scheduled_pickup_time: run.pickupTime,
          dispatch_time: nextStatus === "en_route" ? new Date().toISOString() : undefined,
        });
        if (error) throw error;
      }

      // Resolve any active hold timers when advancing
      if (run.tripId) {
        await supabase
          .from("hold_timers")
          .update({ is_active: false, resolved_at: new Date().toISOString() })
          .eq("trip_id", run.tripId)
          .eq("is_active", true);
      }

      toast({ title: `Status → ${STATUS_LABEL[nextStatus]}` });
      await fetchData();
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setUpdatingTripId(null);
    }
  };

  const startHold = async (run: RunCard, holdType: "patient_not_ready" | "facility_delay") => {
    if (!run.tripId || !run.companyId) return;
    setHoldLoading(`${run.tripId}-${holdType}`);
    try {
      const { error } = await supabase.from("hold_timers").insert({
        trip_id: run.tripId,
        company_id: run.companyId,
        hold_type: holdType,
        started_at: new Date().toISOString(),
        is_active: true,
        current_level: "crew",
        slot_id: run.slotId,
      });
      if (error) throw error;
      toast({ title: holdType === "patient_not_ready" ? "Patient Not Ready — timer started" : "Facility Delay — timer started" });
      await fetchData();
    } catch (err: any) {
      toast({ title: "Failed to start hold", description: err.message, variant: "destructive" });
    } finally {
      setHoldLoading(null);
    }
  };

  const resolveHold = async (timerId: string) => {
    setHoldLoading(timerId);
    try {
      const { error } = await supabase
        .from("hold_timers")
        .update({ is_active: false, resolved_at: new Date().toISOString() })
        .eq("id", timerId);
      if (error) throw error;
      toast({ title: "Hold resolved" });
      await fetchData();
    } catch (err: any) {
      toast({ title: "Failed to resolve hold", description: err.message, variant: "destructive" });
    } finally {
      setHoldLoading(null);
    }
  };

  const getActiveHold = (tripId: string | null) =>
    tripId ? holdTimers.find((h) => h.tripId === tripId) : undefined;

  const formatElapsed = (startedAt: string) => {
    const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading your shift...</p>
      </div>
    );
  }

  const firstActiveIdx = runs.findIndex(
    (r) =>
      r.tripStatus !== "completed" &&
      r.tripStatus !== "cancelled" &&
      r.tripStatus !== "no_show" &&
      r.tripStatus !== "ready_for_billing"
  );

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
      <div className="p-4 space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Today's Runs · {runs.length}
        </p>

        {runs.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">
            No runs assigned for today.
          </p>
        ) : (
          runs.map((run, idx) => {
            const isTerminal =
              run.tripStatus === "completed" ||
              run.tripStatus === "cancelled" ||
              run.tripStatus === "no_show" ||
              run.tripStatus === "ready_for_billing";
            const isCurrent = idx === firstActiveIdx;
            const statusIdx = STATUS_FLOW.indexOf(run.tripStatus);
            const canAdvance = !isTerminal && statusIdx < STATUS_FLOW.length - 1;
            const nextLabel = NEXT_ACTION_LABEL[run.tripStatus];
            const isUpdating = updatingTripId === run.tripId;

            return (
              <div
                key={run.slotId}
                className={`rounded-lg border bg-card p-4 transition-all ${
                  isCurrent
                    ? "border-primary/40 ring-1 ring-primary/20"
                    : isTerminal
                    ? "opacity-60"
                    : ""
                }`}
              >
                {isCurrent && (
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
                      <span className="font-medium">PU:</span> {run.pickupLocation}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      <span className="font-medium">DO:</span> {run.destinationLocation}
                    </p>
                    {run.pickupTime && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Pickup: {run.pickupTime}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      isTerminal
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : run.tripStatus === "scheduled" || run.tripStatus === "assigned"
                        ? "bg-muted text-muted-foreground"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}
                  >
                    {STATUS_LABEL[run.tripStatus] ?? run.tripStatus}
                  </span>
                </div>

                {/* Status progression button */}
                {canAdvance && (
                  <Button
                    className="mt-3 w-full"
                    size="sm"
                    disabled={isUpdating}
                    onClick={() => advanceStatus(run)}
                  >
                    {isUpdating ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ChevronRight className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {nextLabel ?? "Next"}
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

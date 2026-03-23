import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Truck, Users, Loader2, Clock, AlertTriangle, FileText, Check, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { CrewLayout } from "@/components/crew/CrewLayout";
import { cn } from "@/lib/utils";

interface RunCard {
  slotId: string;
  slotOrder: number;
  legId: string;
  patientName: string;
  pickupLocation: string;
  destinationLocation: string;
  pickupTime: string | null;
  tripType: string | null;
  tripStatus: string;
  tripId: string | null;
  truckId: string;
  crewId: string;
  companyId: string | null;
  pcrStatus: string;
  patientId: string | null;
}

interface HoldTimer {
  id: string;
  tripId: string;
  holdType: string;
  startedAt: string;
  isActive: boolean;
}

const PCR_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  not_started: { label: "Not Started", color: "bg-destructive/10 text-destructive border-destructive/30" },
  in_progress: { label: "In Progress", color: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700" },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-700" },
};

export default function CrewDashboard() {
  const { user, signOut, profileId } = useAuth();
  const navigate = useNavigate();
  const [truckName, setTruckName] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [runs, setRuns] = useState<RunCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [holdTimers, setHoldTimers] = useState<HoldTimer[]>([]);
  const [holdLoading, setHoldLoading] = useState<string | null>(null);

  const today = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`; })();

  const fetchData = useCallback(async () => {
    if (!profileId) return;

    const { data: crewRow } = await supabase
      .from("crews")
      .select("id, truck_id, company_id, member1_id, member2_id, truck:trucks!crews_truck_id_fkey(name), member1:profiles!crews_member1_id_fkey(id, full_name), member2:profiles!crews_member2_id_fkey(id, full_name)")
      .eq("active_date", today)
      .or(`member1_id.eq.${profileId},member2_id.eq.${profileId}`)
      .maybeSingle();

    if (!crewRow) {
      setTruckName(""); setPartnerName(""); setRuns([]); setLoading(false); return;
    }

    setTruckName((crewRow.truck as any)?.name ?? "");
    const m1 = crewRow.member1 as any;
    const m2 = crewRow.member2 as any;
    setPartnerName((m1?.id === profileId ? m2?.full_name : m1?.full_name) ?? "");

    const truckId = crewRow.truck_id;
    const crewId = crewRow.id;
    const crewCompanyId = crewRow.company_id;

    const { data: slots } = await supabase
      .from("truck_run_slots")
      .select("id, leg_id, slot_order")
      .eq("truck_id", truckId)
      .eq("run_date", today)
      .order("slot_order");

    if (!slots?.length) { setRuns([]); setLoading(false); return; }

    const legIds = slots.map(s => s.leg_id);

    const [{ data: legs }, { data: trips }] = await Promise.all([
      supabase.from("scheduling_legs").select("id, pickup_location, destination_location, pickup_time, trip_type, patient_id, patient:patients!scheduling_legs_patient_id_fkey(first_name, last_name)").in("id", legIds),
      supabase.from("trip_records").select("id, leg_id, status, company_id, pcr_status, trip_type").eq("run_date", today).eq("truck_id", truckId).in("leg_id", legIds),
    ]);

    const legMap = new Map((legs ?? []).map(l => [l.id, l]));
    const tripMap = new Map((trips ?? []).map(t => [t.leg_id, t]));

    const cards: RunCard[] = slots.map(slot => {
      const leg = legMap.get(slot.leg_id);
      const trip = tripMap.get(slot.leg_id);
      const patient = leg?.patient as any;
      return {
        slotId: slot.id, slotOrder: slot.slot_order, legId: slot.leg_id,
        patientName: patient ? `${patient.first_name} ${patient.last_name}` : "Unknown",
        pickupLocation: leg?.pickup_location ?? "—",
        destinationLocation: leg?.destination_location ?? "—",
        pickupTime: leg?.pickup_time ?? null,
        tripType: trip?.trip_type ?? leg?.trip_type ?? null,
        tripStatus: trip?.status ?? "scheduled",
        tripId: trip?.id ?? null,
        truckId, crewId,
        companyId: trip?.company_id ?? crewCompanyId ?? null,
        pcrStatus: (trip as any)?.pcr_status ?? "not_started",
        patientId: (leg as any)?.patient_id ?? null,
      };
    });
    setRuns(cards);

    const tripIds = cards.map(c => c.tripId).filter(Boolean) as string[];
    if (tripIds.length > 0) {
      const { data: timers } = await supabase.from("hold_timers").select("id, trip_id, hold_type, started_at, is_active").in("trip_id", tripIds).eq("is_active", true);
      setHoldTimers((timers ?? []).map(t => ({ id: t.id, tripId: t.trip_id, holdType: t.hold_type, startedAt: t.started_at, isActive: t.is_active })));
    } else {
      setHoldTimers([]);
    }
    setLoading(false);
  }, [profileId, today]);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel("crew-dash-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_records" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "hold_timers" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const [, setTick] = useState(0);
  useEffect(() => {
    if (holdTimers.length === 0) return;
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, [holdTimers.length]);

  const startHold = async (run: RunCard, holdType: "patient_not_ready" | "facility_delay") => {
    if (!run.tripId || !run.companyId) return;
    setHoldLoading(`${run.tripId}-${holdType}`);
    try {
      await supabase.from("hold_timers").insert({ trip_id: run.tripId, company_id: run.companyId, hold_type: holdType, started_at: new Date().toISOString(), is_active: true, current_level: "crew", slot_id: run.slotId });
      toast({ title: holdType === "patient_not_ready" ? "Patient Not Ready — timer started" : "Facility Delay — timer started" });
      await fetchData();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
    setHoldLoading(null);
  };

  const resolveHold = async (timerId: string) => {
    setHoldLoading(timerId);
    try {
      await supabase.from("hold_timers").update({ is_active: false, resolved_at: new Date().toISOString() }).eq("id", timerId);
      toast({ title: "Hold resolved" });
      await fetchData();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
    setHoldLoading(null);
  };

  const formatElapsed = (startedAt: string) => {
    const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    return `${Math.floor(diff / 60)}:${(diff % 60).toString().padStart(2, "0")}`;
  };

  const getActiveHold = (tripId: string | null) => tripId ? holdTimers.find(h => h.tripId === tripId) : undefined;

  const openPCR = async (run: RunCard) => {
    let tripId = run.tripId;
    // If no trip_record exists yet, create one
    if (!tripId) {
      const companyId = run.companyId;
      if (!companyId) {
        toast({ title: "Cannot create trip record", description: "No company association found for this crew.", variant: "destructive" });
        return;
      }
      const { data: newTrip, error } = await supabase.from("trip_records").insert({
        leg_id: run.legId, truck_id: run.truckId, crew_id: run.crewId,
        company_id: companyId,
        patient_id: run.patientId,
        run_date: today, status: "scheduled" as any,
        pickup_location: run.pickupLocation, destination_location: run.destinationLocation,
        scheduled_pickup_time: run.pickupTime, trip_type: run.tripType as any,
        pcr_status: "not_started",
      }).select("id").single();
      if (error || !newTrip) {
        toast({ title: "Failed to create trip record", description: error?.message ?? "Unknown error", variant: "destructive" });
        return;
      }
      tripId = newTrip.id;
    }
    navigate(`/pcr?tripId=${tripId}`);
  };

  if (loading) {
    return <CrewLayout><div className="flex min-h-screen items-center justify-center"><p className="text-sm text-muted-foreground">Loading your shift...</p></div></CrewLayout>;
  }

  return (
    <CrewLayout>
      <div className="p-4 space-y-4">
        {/* Truck & Partner Header */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Truck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">{truckName || "No Truck Assigned"}</h1>
              {partnerName && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Partner: {partnerName}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Runs */}
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Today's Runs · {runs.length}
        </p>

        {runs.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">No runs assigned for today.</p>
        ) : (
          runs.map((run) => {
            const pcr = PCR_STATUS_CONFIG[run.pcrStatus] || PCR_STATUS_CONFIG.not_started;
            const isTerminal = ["completed", "cancelled", "no_show", "ready_for_billing"].includes(run.tripStatus);
            const activeHold = getActiveHold(run.tripId);

            return (
              <div key={run.slotId} className={cn("rounded-lg border bg-card p-4 space-y-3", isTerminal && "opacity-60")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">
                      {run.slotOrder + 1}. {run.patientName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {run.pickupTime && <span className="font-medium">{run.pickupTime} · </span>}
                      {run.destinationLocation}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{(run.tripType || "transport").replace("_", " ")}</p>
                  </div>
                  <span className={cn("shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold", pcr.color)}>
                    {pcr.label}
                  </span>
                </div>

                {/* Active hold */}
                {activeHold && (
                  <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-destructive">
                      <Clock className="h-3.5 w-3.5 animate-pulse" />
                      {activeHold.holdType === "patient_not_ready" ? "Patient Not Ready" : "Facility Delay"}
                      <span className="font-mono">{formatElapsed(activeHold.startedAt)}</span>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-xs" disabled={holdLoading === activeHold.id}
                      onClick={() => resolveHold(activeHold.id)}>
                      {holdLoading === activeHold.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Resolve"}
                    </Button>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button className="flex-1 h-12 text-sm font-semibold gap-2" onClick={() => openPCR(run)}>
                    <FileText className="h-4 w-4" />
                    {run.pcrStatus === "not_started" ? "Start PCR" : run.pcrStatus === "in_progress" ? "Continue PCR" : "View PCR"}
                  </Button>

                  {run.tripId && !isTerminal && !activeHold && (
                    <>
                      {["arrived_pickup", "en_route"].includes(run.tripStatus) && (
                        <Button variant="outline" size="icon" className="h-12 w-12 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400"
                          disabled={holdLoading === `${run.tripId}-patient_not_ready`}
                          onClick={() => startHold(run, "patient_not_ready")}>
                          <AlertTriangle className="h-4 w-4" />
                        </Button>
                      )}
                      {["arrived_dropoff", "loaded"].includes(run.tripStatus) && (
                        <Button variant="outline" size="icon" className="h-12 w-12 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400"
                          disabled={holdLoading === `${run.tripId}-facility_delay`}
                          onClick={() => startHold(run, "facility_delay")}>
                          <Clock className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </CrewLayout>
  );
}

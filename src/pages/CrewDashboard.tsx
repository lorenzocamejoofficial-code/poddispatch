import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Truck, Users, Loader2, Clock, AlertTriangle, FileText, Check, Eye, Ban, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { CrewLayout } from "@/components/crew/CrewLayout";
import { cn } from "@/lib/utils";

const TRANSPORT_LABELS: Record<string, string> = {
  dialysis: "Dialysis Transport",
  ift: "Interfacility Transfer",
  discharge: "Discharge Transport",
  outpatient_specialty: "Outpatient Specialty",
  private_pay: "Private Pay",
  emergency: "Emergency Transport",
};

interface RunCard {
  slotId: string;
  slotOrder: number;
  legId: string;
  legType: string; // "A" | "B" | "—"
  patientName: string; // formatted as "J. Doe"
  patientHasRecord: boolean;
  pickupLocation: string;
  destinationLocation: string;
  pickupTime: string | null;
  originType: string | null;
  patientPickupAddress: string | null;
  patientDropoffFacility: string | null;
  patientLocationType: string | null;
  patientFacilityName: string | null;
  dispatchTime: string | null;
  tripType: string | null;
  pcrType: string | null;
  tripStatus: string;
  tripId: string | null;
  truckId: string;
  crewId: string;
  companyId: string | null;
  pcrStatus: string;
  patientId: string | null;
  cancellationReason: string | null;
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
      supabase.from("scheduling_legs").select("id, leg_type, pickup_location, destination_location, pickup_time, trip_type, patient_id, patient:patients!scheduling_legs_patient_id_fkey(first_name, last_name, pickup_address, dropoff_facility, location_type, facility_id, facility:facilities!patients_facility_id_fkey(name))").in("id", legIds),
      supabase.from("trip_records").select("id, leg_id, status, company_id, pcr_status, trip_type, pcr_type, origin_type, pickup_location, destination_location, dispatch_time, scheduled_pickup_time, billing_blocked_reason, cancellation_reason, cancellation_disputed, cancellation_dispatcher_note").eq("run_date", today).eq("truck_id", truckId).in("leg_id", legIds),
    ]);

    const legMap = new Map((legs ?? []).map(l => [l.id, l]));
    const tripMap = new Map((trips ?? []).map(t => [t.leg_id, t]));

    const formatPatientName = (patient: any): { name: string; hasRecord: boolean } => {
      if (!patient?.first_name) return { name: "Unassigned", hasRecord: false };
      const firstInitial = patient.first_name.charAt(0).toUpperCase();
      return { name: `${firstInitial}. ${patient.last_name}`, hasRecord: true };
    };

    const cards: RunCard[] = slots.map(slot => {
      const leg = legMap.get(slot.leg_id);
      const trip = tripMap.get(slot.leg_id);
      const patient = leg?.patient as any;
      const { name: patientName, hasRecord } = formatPatientName(patient);
      const legTypeRaw = (leg as any)?.leg_type;
      const legType = legTypeRaw === "a_leg" ? "A" : legTypeRaw === "b_leg" ? "B" : "—";
      return {
        slotId: slot.id, slotOrder: slot.slot_order, legId: slot.leg_id,
        legType,
        patientName,
        patientHasRecord: hasRecord,
        pickupLocation: trip?.pickup_location ?? leg?.pickup_location ?? "—",
        destinationLocation: trip?.destination_location ?? leg?.destination_location ?? "—",
        pickupTime: leg?.pickup_time ?? null,
        originType: trip?.origin_type ?? null,
        patientPickupAddress: patient?.pickup_address ?? null,
        patientDropoffFacility: patient?.dropoff_facility ?? null,
        patientLocationType: patient?.location_type ?? null,
        patientFacilityName: (patient?.facility as any)?.name ?? null,
        dispatchTime: trip?.dispatch_time ?? null,
        tripType: trip?.trip_type ?? leg?.trip_type ?? null,
        pcrType: (trip as any)?.pcr_type ?? null,
        tripStatus: trip?.status ?? "scheduled",
        tripId: trip?.id ?? null,
        truckId, crewId,
        companyId: trip?.company_id ?? crewCompanyId ?? null,
        pcrStatus: (trip as any)?.pcr_status ?? "not_started",
        patientId: (leg as any)?.patient_id ?? null,
        cancellationReason: (trip as any)?.cancellation_reason ?? null,
        cancellationDisputed: (trip as any)?.cancellation_disputed ?? false,
        cancellationDispatcherNote: (trip as any)?.cancellation_dispatcher_note ?? null,
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
            const isCancelled = ["cancelled", "pending_cancellation"].includes(run.tripStatus);
            const isTerminal = ["completed", "cancelled", "no_show", "ready_for_billing", "pending_cancellation"].includes(run.tripStatus);
            const activeHold = getActiveHold(run.tripId);

            // Time display
            const resolveTime = (): string | null => {
              if (run.dispatchTime) {
                const d = new Date(run.dispatchTime);
                return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
              }
              if (run.pickupTime) return run.pickupTime.substring(0, 5);
              return null;
            };
            const resolvePickup = (): string => {
              if (run.originType && run.originType.toLowerCase().includes("residence")) return "Residence";
              if (run.pickupLocation && run.pickupLocation !== "—") return run.pickupLocation;
              // Use patient location_type / facility link
              if (run.patientLocationType === "Residence") return "Residence";
              if (run.patientFacilityName) return run.patientFacilityName;
              if (run.patientPickupAddress) return "Residence";
              return "—";
            };
            const resolveDropoff = (): string => {
              if (run.destinationLocation && run.destinationLocation !== "—") return run.destinationLocation;
              if (run.patientDropoffFacility) return run.patientDropoffFacility;
              return "—";
            };

            const timeStr = resolveTime();
            const transportLabel = TRANSPORT_LABELS[run.pcrType ?? run.tripType ?? ""] ?? "Transport";

            if (isCancelled) {
              return (
                <div key={run.slotId} className="rounded-lg border bg-muted/40 p-4 space-y-3 opacity-70">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground text-xs font-bold">
                      {run.legType}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-muted-foreground">{run.patientName}</p>
                        {!run.patientHasRecord && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {timeStr && <><span className="font-medium">@ {timeStr}</span> · </>}
                        {resolvePickup()} → {resolveDropoff()}
                      </p>
                      <p className="text-xs text-muted-foreground">{transportLabel}</p>
                    </div>
                    <span className="shrink-0 inline-flex items-center rounded-full border border-muted-foreground/30 bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      {run.tripStatus === "pending_cancellation" ? "Cancelled — Pending Review" : "Cancelled"}
                    </span>
                  </div>
                  {run.cancellationReason && (
                    <p className="text-xs text-muted-foreground italic pl-10">Reason: {run.cancellationReason}</p>
                  )}
                  <Button variant="outline" className="w-full h-10 text-sm text-muted-foreground" disabled>
                    <Ban className="h-4 w-4 mr-1.5" /> View Details
                  </Button>
                </div>
              );
            }

            return (
              <div key={run.slotId} className={cn("rounded-lg border bg-card p-4 space-y-3", isTerminal && "opacity-60")}>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-xs font-bold">
                    {run.legType}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{run.patientName}</p>
                      {!run.patientHasRecord && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {timeStr && <><span className="font-medium">@ {timeStr}</span> · </>}
                      {resolvePickup()} → {resolveDropoff()}
                    </p>
                    <p className="text-xs text-muted-foreground">{transportLabel}</p>
                  </div>
                  <span className={cn("shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold", pcr.color)}>
                    {pcr.label}
                  </span>
                </div>

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

                <div className="flex gap-2">
                  <Button
                    className={cn(
                      "flex-1 h-12 text-sm font-semibold gap-2",
                      run.pcrStatus === "completed" && "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800",
                      run.pcrStatus === "in_progress" && "bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-800",
                    )}
                    onClick={() => openPCR(run)}
                  >
                    {run.pcrStatus === "completed" ? (
                      <><Eye className="h-4 w-4" />View PCR</>
                    ) : run.pcrStatus === "in_progress" ? (
                      <><FileText className="h-4 w-4" />Continue PCR</>
                    ) : (
                      <><FileText className="h-4 w-4" />Start PCR</>
                    )}
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

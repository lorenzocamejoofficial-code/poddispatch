import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Truck, Users, Loader2, Clock, AlertTriangle, FileText, Check, Eye, Ban, XCircle } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { CrewLayout } from "@/components/crew/CrewLayout";
import { cn } from "@/lib/utils";
import { deriveRunStatus } from "@/lib/trip-status";
import { TimeTapRow } from "@/components/dispatch/TimeTapRow";

const TRANSPORT_LABELS: Record<string, string> = {
  dialysis: "Dialysis Transport",
  outpatient: "Outpatient Transport",
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
  legTypeRaw: string | null; // raw enum: "a_leg" | "b_leg" | null
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
  cancellationDisputed: boolean;
  cancellationDispatcherNote: string | null;
  // Time tap fields
  atSceneTime: string | null;
  patientContactTime: string | null;
  leftSceneTime: string | null;
  arrivedPickupAt: string | null;
  arrivedDropoffAt: string | null;
  inServiceTime: string | null;
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

interface NotificationRow {
  id: string;
  message: string;
  notification_type: string | null;
  created_at: string;
  acknowledged: boolean;
}

function HoldConfirmButton({ icon, label, confirmLabel, loading, onConfirm }: {
  icon: React.ReactNode;
  label: string;
  confirmLabel: string;
  loading: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="icon" className="h-12 w-12 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400"
        disabled={loading}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
        {icon}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-sm">{label}</DialogTitle>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={loading} onClick={() => { setOpen(false); onConfirm(); }}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

  const { user, signOut, profileId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [truckName, setTruckName] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [runs, setRuns] = useState<RunCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [holdTimers, setHoldTimers] = useState<HoldTimer[]>([]);
  const [holdLoading, setHoldLoading] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<RunCard | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

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
      supabase.from("scheduling_legs").select("id, leg_type, pickup_location, destination_location, pickup_time, trip_type, patient_id, is_oneoff, oneoff_name, patient:patients!scheduling_legs_patient_id_fkey(first_name, last_name, pickup_address, dropoff_facility, location_type, facility_id, facility:facilities!patients_facility_id_fkey(name))").in("id", legIds),
      supabase.from("trip_records").select("id, leg_id, status, company_id, pcr_status, trip_type, pcr_type, origin_type, pickup_location, destination_location, dispatch_time, at_scene_time, patient_contact_time, left_scene_time, arrived_pickup_at, arrived_dropoff_at, in_service_time, scheduled_pickup_time, billing_blocked_reason, cancellation_reason, cancellation_disputed, cancellation_dispatcher_note").eq("run_date", today).eq("truck_id", truckId).in("leg_id", legIds),
    ]);

    const legMap = new Map((legs ?? []).map(l => [l.id, l]));
    const tripMap = new Map((trips ?? []).map(t => [t.leg_id, t]));

    const formatPatientName = (patient: any, leg: any): { name: string; hasRecord: boolean } => {
      if (patient?.first_name) {
        const firstInitial = patient.first_name.charAt(0).toUpperCase();
        return { name: `${firstInitial}. ${patient.last_name}`, hasRecord: true };
      }
      // Fallback for one-off runs
      if (leg?.is_oneoff && leg?.oneoff_name) return { name: leg.oneoff_name, hasRecord: false };
      if (leg?.pickup_location) return { name: leg.pickup_location, hasRecord: false };
      return { name: "Unknown Patient", hasRecord: false };
    };

    const cards: RunCard[] = slots.map(slot => {
      const leg = legMap.get(slot.leg_id);
      const trip = tripMap.get(slot.leg_id);
      const patient = leg?.patient as any;
      const { name: patientName, hasRecord } = formatPatientName(patient, leg);
      const legTypeRaw = (leg as any)?.leg_type ?? null;
      const legType = legTypeRaw === "a_leg" || legTypeRaw === "A" ? "A" : legTypeRaw === "b_leg" || legTypeRaw === "B" ? "B" : "—";
      return {
        slotId: slot.id, slotOrder: slot.slot_order, legId: slot.leg_id,
        legType,
        legTypeRaw,
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
        atSceneTime: (trip as any)?.at_scene_time ?? null,
        patientContactTime: (trip as any)?.patient_contact_time ?? null,
        leftSceneTime: (trip as any)?.left_scene_time ?? null,
        arrivedPickupAt: (trip as any)?.arrived_pickup_at ?? null,
        arrivedDropoffAt: (trip as any)?.arrived_dropoff_at ?? null,
        inServiceTime: (trip as any)?.in_service_time ?? null,
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
    // Fetch notifications
    if (user?.id) {
      const { data: notifData } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .eq("acknowledged", false)
        .order("created_at", { ascending: false })
        .limit(10);
      setNotifications((notifData ?? []).map((n: any) => ({
        id: n.id, message: n.message, notification_type: n.notification_type ?? "general",
        created_at: n.created_at, acknowledged: n.acknowledged,
      })));
    }

    setLoading(false);
  }, [profileId, today, user?.id]);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel("crew-dash-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_records" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "hold_timers" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "truck_run_slots" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  // Auto-open PCR when navigated from schedule tab with state
  useEffect(() => {
    if (location.state?.openPCRForTripId && runs.length > 0) {
      const run = runs.find(r => r.tripId === location.state.openPCRForTripId || r.legId === location.state.openPCRForLegId);
      if (run) {
        openPCR(run);
        // Clear state to prevent re-triggering
        window.history.replaceState({}, document.title);
      }
    }
  }, [runs, location.state]);

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

  const getOriginDestination = (tripType: string, legType: string) => {
    if (legType === "B") {
      const origin = tripType === "dialysis" ? "Dialysis Facility"
        : tripType === "ift" ? "Hospital"
        : tripType === "discharge" ? "Hospital"
        : tripType === "outpatient" ? "Outpatient Specialty"
        : "Healthcare Facility";
      return { origin_type: origin, destination_type: "Residence" };
    }
    const destination = tripType === "dialysis" ? "Dialysis Facility"
      : tripType === "ift" ? "Hospital"
      : tripType === "discharge" ? "Hospital"
      : tripType === "outpatient" ? "Outpatient Specialty"
      : "Healthcare Facility";
    return { origin_type: "Residence", destination_type: destination };
  };

  const openPCR = async (run: RunCard) => {
    let tripId = run.tripId;
    // Store leg type in sessionStorage for PCR fallback
    if (run.legTypeRaw) {
      sessionStorage.setItem("pcr_leg_type", run.legTypeRaw);
    }
   // If no trip_record exists yet, create one
    if (!tripId) {
      if (!run.patientId) {
        console.warn("openPCR: run.patientId is null — trip record will have no patient linked", { legId: run.legId });
      }
      const companyId = run.companyId;
      if (!companyId) {
        toast({ title: "Cannot create trip record", description: "No company association found for this crew.", variant: "destructive" });
        return;
      }

      // Leg-type-aware origin/destination derivation
      const derived = getOriginDestination(run.tripType ?? "", run.legType);
      // Override origin with patient location_type if available
      const patLocType = run.patientLocationType;
      if (patLocType) {
        derived.origin_type = patLocType;
      }

      const { data: newTrip, error } = await supabase.from("trip_records").insert({
        leg_id: run.legId, truck_id: run.truckId, crew_id: run.crewId,
        company_id: companyId,
        patient_id: run.patientId,
        run_date: today, status: "scheduled" as any,
        pickup_location: run.pickupLocation, destination_location: run.destinationLocation,
        scheduled_pickup_time: run.pickupTime, trip_type: run.tripType as any,
        pcr_type: run.tripType as any,
        pcr_status: "not_started",
        origin_type: derived.origin_type,
        destination_type: derived.destination_type,
      }).select("id, origin_type, destination_type").single();
      if (error || !newTrip) {
        console.error("Failed to create trip record with origin/destination:", error);
        toast({ title: "Failed to create trip record", description: error?.message ?? "Unknown error", variant: "destructive" });
        return;
      }
      console.log("Trip record created with origin_type:", newTrip.origin_type, "destination_type:", newTrip.destination_type);
      tripId = newTrip.id;
    }
    navigate(`/pcr?tripId=${tripId}`);
  };

  const handleCancelTrip = async () => {
    if (!cancelTarget || cancelReason.trim().length < 10) return;
    setCancelLoading(true);
    try {
      let tripId = cancelTarget.tripId;
      // Create trip record if it doesn't exist yet
      if (!tripId) {
        const companyId = cancelTarget.companyId;
        if (!companyId) throw new Error("No company association");
        const { data: newTrip, error } = await supabase.from("trip_records").insert({
          leg_id: cancelTarget.legId, truck_id: cancelTarget.truckId, crew_id: cancelTarget.crewId,
          company_id: companyId, patient_id: cancelTarget.patientId,
          run_date: today, status: "pending_cancellation" as any,
          pickup_location: cancelTarget.pickupLocation, destination_location: cancelTarget.destinationLocation,
          scheduled_pickup_time: cancelTarget.pickupTime, trip_type: cancelTarget.tripType as any,
          pcr_status: "not_started",
          cancellation_reason: cancelReason.trim(),
          cancelled_by: profileId,
          cancelled_at: new Date().toISOString(),
        } as any).select("id").single();
        if (error || !newTrip) throw new Error(error?.message ?? "Failed to create trip record");
        tripId = newTrip.id;
      } else {
        await supabase.from("trip_records").update({
          status: "pending_cancellation" as any,
          cancellation_reason: cancelReason.trim(),
          cancelled_by: profileId,
          cancelled_at: new Date().toISOString(),
        } as any).eq("id", tripId);
      }

      // Find dispatchers/owners for notification
      if (cancelTarget.companyId) {
        const { data: dispatchers } = await supabase
          .from("company_memberships")
          .select("user_id")
          .eq("company_id", cancelTarget.companyId)
          .in("role", ["dispatcher", "owner"] as any);
        for (const d of (dispatchers ?? [])) {
          try {
            const { error: notifErr } = await supabase.from("notifications").insert({
              user_id: d.user_id,
              message: `Trip cancellation requested by crew: ${cancelTarget.patientName} — ${cancelReason.trim()}`,
              acknowledged: false,
            });
            if (notifErr) {
              console.error("Notification insert failed for user", d.user_id, notifErr);
              toast({ title: "Warning", description: `Failed to notify dispatcher (${d.user_id})`, variant: "destructive" });
            }
          } catch (notifCatch: any) {
            console.error("Notification insert exception for user", d.user_id, notifCatch);
          }
        }
      }

      // Insert alert
      try {
        const { data: alertData, error: alertErr } = await supabase.from("alerts").insert({
          message: `Crew cancellation pending review: ${cancelTarget.patientName}`,
          severity: "yellow",
          truck_id: cancelTarget.truckId,
          run_id: tripId,
          company_id: cancelTarget.companyId,
          dismissed: false,
        }).select("id").maybeSingle();
        if (alertErr) {
          console.error("Alert insert failed:", alertErr);
          toast({ title: "Warning", description: "Failed to create dispatch alert — notify dispatch manually", variant: "destructive" });
        } else {
          console.log("Alert insert success, id:", alertData?.id);
        }
      } catch (alertCatch: any) {
        console.error("Alert insert exception:", alertCatch);
        toast({ title: "Warning", description: "Failed to create dispatch alert", variant: "destructive" });
      }

      toast({ title: "Cancellation requested", description: "Dispatcher will review your request." });
      setCancelTarget(null);
      setCancelReason("");
      await fetchData();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
    setCancelLoading(false);
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

        {/* Notification Banners */}
        {notifications.length > 0 && (
          <div className="space-y-2">
            {notifications.map((notif) => {
              const borderColor = notif.notification_type === "schedule_change"
                ? "border-l-amber-500"
                : notif.message.toLowerCase().includes("cancel")
                ? "border-l-destructive"
                : "border-l-primary";
              const formatNotifTime = (iso: string) => {
                const d = new Date(iso);
                const now = new Date();
                const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                if (d.toDateString() === now.toDateString()) return `Today at ${timeStr}`;
                return `${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at ${timeStr}`;
              };
              return (
                <div key={notif.id} className={cn("rounded-lg border border-l-4 bg-card p-3", borderColor)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground whitespace-pre-line">{notif.message}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">{formatNotifTime(notif.created_at)}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 h-7 text-xs"
                      onClick={async () => {
                        await supabase.from("notifications").update({
                          acknowledged: true,
                          acknowledged_at: new Date().toISOString(),
                        } as any).eq("id", notif.id);
                        setNotifications(prev => prev.filter(n => n.id !== notif.id));
                      }}
                    >
                      Got it
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

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
                    <span className={cn(
                      "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold",
                      run.legType === "A" ? "bg-primary/10 text-primary" : run.legType === "B" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400" : "bg-muted text-muted-foreground"
                    )}>
                      {run.legType}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-muted-foreground">{run.patientName}</p>
                        {!run.patientHasRecord && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
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

            const isExpanded = expandedRunId === run.slotId;

            return (
              <div
                key={run.slotId}
                className={cn("rounded-lg border bg-card p-4 space-y-3 cursor-pointer transition-shadow", isTerminal && "opacity-60", isExpanded && "ring-1 ring-primary/30 shadow-sm")}
                onClick={() => setExpandedRunId(isExpanded ? null : run.slotId)}
              >
                <div className="flex items-start gap-3">
                  <span className={cn(
                    "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold",
                    run.legType === "A" ? "bg-primary/10 text-primary" : run.legType === "B" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400" : "bg-muted text-muted-foreground"
                  )}>
                    {run.legType}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{run.patientName}</p>
                      {!run.patientHasRecord && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {timeStr && <><span className="font-medium">@ {timeStr}</span> · </>}
                      {resolvePickup()} → {resolveDropoff()}
                    </p>
                    <p className="text-xs text-muted-foreground">{transportLabel}</p>
                  </div>
                  <span className={cn("shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold", pcr.color)}>
                    {pcr.label}
                  </span>
                </div>

                {isExpanded && (
                  <>
                    {/* Run progress badge + time taps */}
                    {(() => {
                      const rs = deriveRunStatus({
                        dispatch_time: run.dispatchTime,
                        at_scene_time: run.atSceneTime,
                        patient_contact_time: run.patientContactTime,
                        left_scene_time: run.leftSceneTime,
                        arrived_dropoff_at: run.arrivedDropoffAt,
                        in_service_time: run.inServiceTime,
                        pcr_status: run.pcrStatus,
                      });
                      const colorMap: Record<string, string> = {
                        gray: "bg-muted text-muted-foreground",
                        amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400",
                        blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
                        green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400",
                      };
                      return (
                        <div className="space-y-1">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${colorMap[rs.color] ?? colorMap.gray}`}>
                            {rs.label}
                          </span>
                          <TimeTapRow
                            dispatch_time={run.dispatchTime}
                            arrived_pickup_at={run.arrivedPickupAt}
                            at_scene_time={run.atSceneTime}
                            left_scene_time={run.leftSceneTime}
                            arrived_dropoff_at={run.arrivedDropoffAt}
                            in_service_time={run.inServiceTime}
                          />
                        </div>
                      );
                    })()}
                    {run.cancellationDisputed && run.cancellationDispatcherNote && (
                      <div className="rounded-md border border-amber-400/50 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700/50 px-3 py-2">
                        <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                          Cancellation disputed by dispatch: {run.cancellationDispatcherNote}
                        </p>
                      </div>
                    )}

                    {activeHold && (
                      <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                        <div className="flex items-center gap-2 text-xs font-medium text-destructive">
                          <Clock className="h-3.5 w-3.5 animate-pulse" />
                          {activeHold.holdType === "patient_not_ready" ? "Patient Not Ready" : "Facility Delay"}
                          <span className="font-mono">{formatElapsed(activeHold.startedAt)}</span>
                        </div>
                        <Button variant="outline" size="sm" className="h-7 text-xs" disabled={holdLoading === activeHold.id}
                          onClick={(e) => { e.stopPropagation(); resolveHold(activeHold.id); }}>
                          {holdLoading === activeHold.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Resolve"}
                        </Button>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {run.pcrStatus === "not_started" && (
                        <Button
                          className="flex-1 h-12 text-sm font-semibold gap-2 w-full"
                          onClick={() => openPCR(run)}
                        >
                          <FileText className="h-4 w-4" />Start PCR
                        </Button>
                      )}

                      {run.pcrStatus === "in_progress" && (
                        <>
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 dark:bg-amber-900/20 dark:border-amber-700 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-400">
                            <FileText className="h-3 w-3" /> PCR In Progress
                          </span>
                          <Button variant="link" size="sm" className="text-xs text-amber-700 dark:text-amber-400 px-1" onClick={() => openPCR(run)}>
                            Continue →
                          </Button>
                        </>
                      )}

                      {run.pcrStatus === "submitted" && (
                        <>
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-700 px-3 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                            <Check className="h-3 w-3" /> PCR Submitted
                          </span>
                          <Button variant="link" size="sm" className="text-xs text-emerald-700 dark:text-emerald-400 px-1" onClick={() => openPCR(run)}>
                            View →
                          </Button>
                        </>
                      )}

                      {/* Cancel Trip button */}
                      {!isTerminal && ["not_started", "in_progress"].includes(run.pcrStatus) && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-12 w-12 border-destructive/50 text-destructive hover:bg-destructive/5"
                          onClick={() => { setCancelTarget(run); setCancelReason(""); }}
                          title="Cancel Trip"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}

                      {run.tripId && !isTerminal && !activeHold && (
                        <>
                          {["arrived_pickup", "en_route"].includes(run.tripStatus) && (
                            <HoldConfirmButton
                              icon={<AlertTriangle className="h-4 w-4" />}
                              label="Start Patient Not Ready timer?"
                              confirmLabel="Start Timer"
                              loading={holdLoading === `${run.tripId}-patient_not_ready`}
                              onConfirm={() => startHold(run, "patient_not_ready")}
                            />
                          )}
                          {["arrived_dropoff", "loaded"].includes(run.tripStatus) && (
                            <HoldConfirmButton
                              icon={<Clock className="h-4 w-4" />}
                              label="Start Facility Delay timer?"
                              confirmLabel="Start Timer"
                              loading={holdLoading === `${run.tripId}-facility_delay`}
                              onConfirm={() => startHold(run, "facility_delay")}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Cancel Trip Dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) { setCancelTarget(null); setCancelReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Trip — {cancelTarget?.patientName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This will send a cancellation request to dispatch for review. Please provide a reason.
            </p>
            <Textarea
              placeholder="Reason for cancellation (minimum 10 characters)…"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="min-h-[80px]"
            />
            {cancelReason.length > 0 && cancelReason.trim().length < 10 && (
              <p className="text-xs text-destructive">Minimum 10 characters required</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCancelTarget(null); setCancelReason(""); }}>
              Back
            </Button>
            <Button
              variant="destructive"
              disabled={cancelReason.trim().length < 10 || cancelLoading}
              onClick={handleCancelTrip}
            >
              {cancelLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Request Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CrewLayout>
  );
}

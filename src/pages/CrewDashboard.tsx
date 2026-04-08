import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Truck, Users, Loader2, Clock, AlertTriangle, Ban, XCircle, Siren } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { CrewLayout } from "@/components/crew/CrewLayout";
import { cn } from "@/lib/utils";
import { CancellationDocForm } from "@/components/crew/CancellationDocForm";
import { deriveRunStatus } from "@/lib/trip-status";
import { TimeTapRow } from "@/components/dispatch/TimeTapRow";
import { useCrewPartner } from "@/hooks/useCrewPartner";
import { IncidentReportForm } from "@/components/incidents/IncidentReportForm";
import { EmergencyUpgradeDialog } from "@/components/emergency/EmergencyUpgradeDialog";
import { EmergencyBanner } from "@/components/emergency/EmergencyBanner";
import { EmergencyResolutionModal } from "@/components/emergency/EmergencyResolutionModal";
import { useEmergencyUpgrade } from "@/hooks/useEmergencyUpgrade";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

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
  // For past incomplete runs merged into the list
  runDate?: string;
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
  submitted: { label: "Submitted", color: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-700" },
  kicked_back: { label: "Returned", color: "bg-destructive/10 text-destructive border-destructive/30" },
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

export default function CrewDashboard() {
  const { user, profileId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [truckName, setTruckName] = useState("");
  const [_partnerName, setPartnerName] = useState("");
  const [runs, setRuns] = useState<RunCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [holdTimers, setHoldTimers] = useState<HoldTimer[]>([]);
  const [holdLoading, setHoldLoading] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<RunCard | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const { partnerName: crewPartnerName, loading: crewPartnerLoading } = useCrewPartner();
  const [incidentRun, setIncidentRun] = useState<RunCard | null>(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const emergency = useEmergencyUpgrade(activeCompanyId);
  const [showRunSelector, setShowRunSelector] = useState(false);
  const [selectedEmergencyRun, setSelectedEmergencyRun] = useState<RunCard | null>(null);
  const [cancelDocTarget, setCancelDocTarget] = useState<RunCard | null>(null);
  const [crewProfile, setCrewProfile] = useState<{ full_name: string; cert_level: string } | null>(null);

  const today = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`; })();

  const fetchData = useCallback(async () => {
    if (!profileId) return;

    const { data: crewRow } = await supabase
      .from("crews")
      .select("id, truck_id, company_id, member1_id, member2_id, member3_id, truck:trucks!crews_truck_id_fkey(name), member1:profiles!crews_member1_id_fkey(id, full_name), member2:profiles!crews_member2_id_fkey(id, full_name), member3:profiles!crews_member3_id_fkey(id, full_name)")
      .eq("active_date", today)
      .or(`member1_id.eq.${profileId},member2_id.eq.${profileId},member3_id.eq.${profileId}`)
      .maybeSingle();

    let todayTruckId: string | null = null;
    let todayCrewId: string | null = null;
    let crewCompanyId: string | null = null;

    if (crewRow) {
      todayTruckId = crewRow.truck_id;
      todayCrewId = crewRow.id;
      crewCompanyId = crewRow.company_id;

      setTruckName((crewRow.truck as any)?.name ?? "");
      const m1 = crewRow.member1 as any;
      const m2 = crewRow.member2 as any;
      setPartnerName((m1?.id === profileId ? m2?.full_name : m1?.full_name) ?? "");

      // Set activeCompanyId for emergency upgrade hook
      if (crewCompanyId) setActiveCompanyId(crewCompanyId);
    } else {
      setTruckName("");
      setPartnerName("");
    }

    const cards: RunCard[] = [];

    // --- Today's runs from truck_run_slots ---
    if (todayTruckId && todayCrewId) {
      const { data: slots } = await supabase
        .from("truck_run_slots")
        .select("id, leg_id, slot_order")
        .eq("truck_id", todayTruckId)
        .eq("run_date", today)
        .order("slot_order");

      if (slots?.length) {
        const legIds = slots.map(s => s.leg_id);

        const [{ data: legs }, { data: trips }] = await Promise.all([
          supabase.from("scheduling_legs").select("id, leg_type, pickup_location, destination_location, pickup_time, trip_type, patient_id, is_oneoff, oneoff_name, patient:patients!scheduling_legs_patient_id_fkey(first_name, last_name, pickup_address, dropoff_facility, location_type, facility_id, facility:facilities!patients_facility_id_fkey(name))").in("id", legIds),
          supabase.from("trip_records").select("id, leg_id, status, company_id, pcr_status, trip_type, pcr_type, origin_type, pickup_location, destination_location, dispatch_time, at_scene_time, patient_contact_time, left_scene_time, arrived_pickup_at, arrived_dropoff_at, in_service_time, scheduled_pickup_time, billing_blocked_reason, cancellation_reason, cancellation_disputed, cancellation_dispatcher_note").eq("run_date", today).eq("truck_id", todayTruckId!).in("leg_id", legIds),
        ]);

        const legMap = new Map((legs ?? []).map(l => [l.id, l]));
        const tripMap = new Map((trips ?? []).map(t => [t.leg_id, t]));

        const formatPatientName = (patient: any, leg: any): { name: string; hasRecord: boolean } => {
          if (patient?.first_name) {
            const firstInitial = patient.first_name.charAt(0).toUpperCase();
            return { name: `${firstInitial}. ${patient.last_name}`, hasRecord: true };
          }
          if (leg?.is_oneoff && leg?.oneoff_name) return { name: leg.oneoff_name, hasRecord: false };
          if (leg?.pickup_location) return { name: leg.pickup_location, hasRecord: false };
          return { name: "Unknown Patient", hasRecord: false };
        };

        for (const slot of slots) {
          const leg = legMap.get(slot.leg_id);
          const trip = tripMap.get(slot.leg_id);
          const patient = leg?.patient as any;
          const { name: patientName, hasRecord } = formatPatientName(patient, leg);
          const legTypeRaw = (leg as any)?.leg_type ?? null;
          const legType = legTypeRaw === "a_leg" || legTypeRaw === "A" ? "A" : legTypeRaw === "b_leg" || legTypeRaw === "B" ? "B" : "—";
          cards.push({
            slotId: slot.id, slotOrder: slot.slot_order, legId: slot.leg_id,
            legType, legTypeRaw, patientName, patientHasRecord: hasRecord,
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
            truckId: todayTruckId!, crewId: todayCrewId!,
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
          });
        }
      }
    }

    setRuns(cards);

    // --- Fetch incomplete PCRs from previous days based on crew history ---
    const { data: allCrewRows } = await supabase
      .from("crews")
      .select("id")
      .or(`member1_id.eq.${profileId},member2_id.eq.${profileId},member3_id.eq.${profileId}`);

    const allCrewIds = (allCrewRows ?? []).map(c => c.id);

    if (allCrewIds.length > 0) {
      const { data: pastIncompleteTrips } = await supabase
        .from("trip_records")
        .select("id, leg_id, run_date, status, company_id, pcr_status, trip_type, pcr_type, origin_type, pickup_location, destination_location, dispatch_time, at_scene_time, patient_contact_time, left_scene_time, arrived_pickup_at, arrived_dropoff_at, in_service_time, scheduled_pickup_time, cancellation_reason, cancellation_disputed, cancellation_dispatcher_note, patient_id, truck_id, crew_id")
        .in("crew_id", allCrewIds)
        .in("pcr_status", ["not_started", "in_progress"])
        .lt("run_date", today);

      if (pastIncompleteTrips && pastIncompleteTrips.length > 0) {
        const pastPatientIds = [...new Set(pastIncompleteTrips.map((t: any) => t.patient_id).filter(Boolean))] as string[];
        const { data: pastPatients } = pastPatientIds.length > 0
          ? await supabase.from("patients").select("id, first_name, last_name").in("id", pastPatientIds)
          : { data: [] };
        const pastPatientMap = new Map((pastPatients ?? []).map((p: any) => [p.id, p]));

        const pastCards = pastIncompleteTrips.map((trip: any) => {
          const patient = pastPatientMap.get(trip.patient_id);
          const patientName = patient
            ? `${(patient as any).first_name.charAt(0)}. ${(patient as any).last_name}`
            : "Unknown Patient";
          return {
            slotId: trip.id,
            slotOrder: 0,
            legId: trip.leg_id ?? "",
            legType: "—" as string,
            legTypeRaw: null as string | null,
            patientName,
            patientHasRecord: !!patient,
            pickupLocation: trip.pickup_location ?? "—",
            destinationLocation: trip.destination_location ?? "—",
            pickupTime: trip.scheduled_pickup_time ?? null,
            originType: trip.origin_type ?? null,
            patientPickupAddress: null as string | null,
            patientDropoffFacility: null as string | null,
            patientLocationType: null as string | null,
            patientFacilityName: null as string | null,
            dispatchTime: trip.dispatch_time ?? null,
            tripType: trip.trip_type ?? null,
            pcrType: trip.pcr_type ?? null,
            tripStatus: trip.status ?? "scheduled",
            tripId: trip.id as string | null,
            truckId: trip.truck_id ?? "",
            crewId: trip.crew_id ?? "",
            companyId: trip.company_id ?? crewCompanyId ?? null,
            pcrStatus: trip.pcr_status ?? "not_started",
            patientId: trip.patient_id ?? null,
            cancellationReason: trip.cancellation_reason ?? null,
            cancellationDisputed: trip.cancellation_disputed ?? false,
            cancellationDispatcherNote: trip.cancellation_dispatcher_note ?? null,
            atSceneTime: trip.at_scene_time ?? null,
            patientContactTime: trip.patient_contact_time ?? null,
            leftSceneTime: trip.left_scene_time ?? null,
            arrivedPickupAt: trip.arrived_pickup_at ?? null,
            arrivedDropoffAt: trip.arrived_dropoff_at ?? null,
            inServiceTime: trip.in_service_time ?? null,
            runDate: trip.run_date as string,
          };
        });
        pastCards.sort((a: any, b: any) => a.runDate.localeCompare(b.runDate));
        setIncompletePastRuns(pastCards);
      } else {
        setIncompletePastRuns([]);
      }
    } else {
      setIncompletePastRuns([]);
    }

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

    // Fetch crew profile for cancellation doc form
    if (profileId) {
      supabase.from("profiles").select("full_name, cert_level").eq("id", profileId).maybeSingle().then(({ data }) => {
        if (data) setCrewProfile({ full_name: data.full_name, cert_level: data.cert_level });
      });
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

  // Auto-open PCR when navigated from schedule tab with state — redirect to PCR tab
  useEffect(() => {
    if (location.state?.openPCRForTripId && runs.length > 0) {
      const run = runs.find(r => r.tripId === location.state.openPCRForTripId || r.legId === location.state.openPCRForLegId);
      if (run && run.tripId) {
        navigate(`/pcr?tripId=${run.tripId}`, { replace: true });
      }
      window.history.replaceState({}, document.title);
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
        {/* Emergency Banner */}
        {emergency.isActive && (
          <EmergencyBanner
            patientName={runs.find(r => r.tripId === emergency.originalTripId)?.patientName ?? "Unknown"}
            truckName={truckName}
            upgradeAt={emergency.upgradeAt!}
            canUndo={emergency.canUndo}
            secondsRemaining={emergency.secondsRemaining}
            loading={emergency.loading}
            onUndo={async () => {
              const origId = await emergency.undoUpgrade();
              if (origId) navigate(`/pcr?tripId=${origId}`);
              return origId;
            }}
            onResolve={() => setResolveOpen(true)}
          />
        )}

        {/* Upgrade to Emergency — permanent prominent button */}
        {(() => {
          const eligibleRuns = runs.filter(r =>
            r.tripId &&
            r.pcrType !== "emergency" &&
            !["completed", "cancelled", "no_show", "ready_for_billing", "pending_cancellation", "voided", "emergency_upgraded"].includes(r.tripStatus)
          );
          const disabled = eligibleRuns.length === 0;
          const handleClick = () => {
            if (disabled) return;
            if (eligibleRuns.length === 1) {
              setSelectedEmergencyRun(eligibleRuns[0]);
            } else {
              setShowRunSelector(true);
            }
          };
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-12 text-sm font-semibold gap-2 border-destructive/40 text-destructive hover:bg-destructive/5",
                        disabled && "opacity-50 cursor-not-allowed"
                      )}
                      disabled={disabled}
                      onClick={handleClick}
                    >
                      <Siren className="h-4.5 w-4.5" />
                      Upgrade to Emergency
                    </Button>
                  </div>
                </TooltipTrigger>
                {disabled && (
                  <TooltipContent>
                    <p>No active runs today</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          );
        })()}

      {/* Truck & Partner Header */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Truck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">{truckName || "No Truck Assigned"}</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {crewPartnerLoading ? "Loading..." : crewPartnerName ? `Your partner today: ${crewPartnerName}` : "No partner assigned for today"}
              </p>
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

        {/* Post-cancellation documentation prompt */}
        {(() => {
          const needsDoc = runs.filter(r =>
            ["cancelled", "pending_cancellation"].includes(r.tripStatus) &&
            r.pcrStatus === "cancelled_with_pcr" &&
            r.tripId
          );
          if (needsDoc.length === 0) return null;
          return (
            <div className="space-y-2">
              {needsDoc.map(run => (
                <div key={run.slotId} className="rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700/50 p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                      Documentation required for cancelled run — {run.patientName}
                    </p>
                    <p className="text-xs text-amber-700/80 dark:text-amber-400/70 mt-0.5">This run was cancelled — complete required documentation.</p>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={() => setCancelDocTarget(run)}
                  >
                    Complete Documentation
                  </Button>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Incomplete PCRs from previous days */}
        {incompletePastRuns.length > 0 && (
          <div className="space-y-2">
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <p className="text-sm font-bold text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Incomplete PCRs — Action Required
              </p>
              <p className="text-xs text-destructive/80 mt-0.5">These PCRs from previous days still need to be completed and submitted.</p>
            </div>
            {incompletePastRuns.map((run) => (
              <div key={run.slotId} className="rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700/50 p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{run.patientName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Run Date: <span className="font-medium text-amber-700 dark:text-amber-400">{run.runDate}</span>
                      {run.pickupTime && <> · @ {run.pickupTime.substring(0, 5)}</>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{run.pickupLocation} → {run.destinationLocation}</p>
                  </div>
                  <span className={cn("shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold",
                    run.pcrStatus === "in_progress"
                      ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700"
                      : "bg-destructive/10 text-destructive border-destructive/30"
                  )}>
                    {run.pcrStatus === "in_progress" ? "In Progress" : "Not Started"}
                  </span>
                </div>
                <Button
                  className="w-full h-10 text-sm bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => {
                    if (run.tripId) navigate(`/pcr?tripId=${run.tripId}`);
                  }}
                >
                  Complete PCR
                </Button>
              </div>
            ))}
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

                      {/* Emergency Upgrade button removed — now at dashboard level */}

                      {/* Report Incident button */}
                      {!isTerminal && run.tripId && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-12 w-12 border-amber-400/50 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                          onClick={() => setIncidentRun(run)}
                          title="Report Incident"
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </Button>
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

      {/* Incident Report Form */}
      <IncidentReportForm
        open={!!incidentRun}
        onClose={() => setIncidentRun(null)}
        defaultTruckId={incidentRun?.truckId}
        defaultTruckName={truckName}
        defaultTripId={incidentRun?.tripId}
        defaultPatientName={incidentRun?.patientName}
        defaultCompanyId={incidentRun?.companyId}
      />

      {/* Run Selector for Emergency Upgrade */}
      <Dialog open={showRunSelector} onOpenChange={setShowRunSelector}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Siren className="h-5 w-5" />
              Which run is being upgraded?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {runs
              .filter(r =>
                r.tripId &&
                r.pcrType !== "emergency" &&
                !["completed", "cancelled", "no_show", "ready_for_billing", "pending_cancellation", "voided", "emergency_upgraded"].includes(r.tripStatus)
              )
              .map(run => (
                <button
                  key={run.slotId}
                  className="w-full rounded-lg border border-border bg-card p-3 text-left hover:border-destructive/50 hover:bg-destructive/5 transition-colors"
                  onClick={() => {
                    setShowRunSelector(false);
                    setSelectedEmergencyRun(run);
                  }}
                >
                  <p className="text-sm font-semibold text-foreground">{run.patientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {run.pickupTime ? `@ ${run.pickupTime.substring(0, 5)}` : "No time"} · {run.pickupLocation} → {run.destinationLocation}
                  </p>
                </button>
              ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRunSelector(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Emergency Upgrade Confirmation Dialog */}
      <EmergencyUpgradeDialog
        open={!!selectedEmergencyRun}
        onOpenChange={(o) => { if (!o) setSelectedEmergencyRun(null); }}
        patientName={selectedEmergencyRun?.patientName ?? ""}
        truckName={truckName}
        loading={emergency.loading}
        onConfirm={async () => {
          if (!selectedEmergencyRun?.tripId) return;
          const emergId = await emergency.triggerUpgrade(
            selectedEmergencyRun.tripId,
            selectedEmergencyRun.patientName,
            truckName,
            selectedEmergencyRun.truckId
          );
          setSelectedEmergencyRun(null);
          if (emergId) navigate(`/pcr?tripId=${emergId}`);
        }}
      />

      {/* Cancellation Documentation Form */}
      <CancellationDocForm
        open={!!cancelDocTarget}
        onOpenChange={(o) => { if (!o) setCancelDocTarget(null); }}
        tripId={cancelDocTarget?.tripId ?? ""}
        patientName={cancelDocTarget?.patientName ?? ""}
        cancelledAt={(cancelDocTarget as any)?.cancelledAt ?? null}
        crewMemberName={crewProfile?.full_name ?? ""}
        crewMemberCert={crewProfile?.cert_level ?? ""}
        onComplete={() => { setCancelDocTarget(null); fetchData(); }}
      />

      {/* Emergency Resolution Modal */}
      <EmergencyResolutionModal
        open={resolveOpen}
        onOpenChange={setResolveOpen}
        canUndo={emergency.canUndo}
        loading={emergency.loading}
        onResolve={async (type, details) => {
          const resultId = await emergency.resolveEmergency(type, details);
          if (resultId) navigate(`/pcr?tripId=${resultId}`);
          return resultId;
        }}
      />
    </CrewLayout>
  );
}

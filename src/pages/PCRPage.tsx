import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { usePCRData } from "@/hooks/usePCRData";
import { usePCRSectionRules } from "@/hooks/usePCRSectionRules";
import { CrewLayout } from "@/components/crew/CrewLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { MedicSelector } from "@/components/pcr/MedicSelector";
import { TimesCard } from "@/components/pcr/TimesCard";
import { getTimeSequenceWarnings } from "@/components/pcr/TimesCard";
import { PatientInfoCard } from "@/components/pcr/PatientInfoCard";
import { VitalsCard } from "@/components/pcr/VitalsCard";
import { ConditionOnArrivalCard } from "@/components/pcr/ConditionCard";
import { MedicalNecessityCard } from "@/components/pcr/MedicalNecessityCard";
import { EquipmentCard } from "@/components/pcr/EquipmentCard";
import { AssessmentCard, PhysicalExamCard } from "@/components/pcr/AssessmentCards";
import { SendingFacilityCard, HospitalOutcomeCard } from "@/components/pcr/FacilityCards";
import { SignaturesCard } from "@/components/pcr/SignaturesCard";
import { NarrativeCard } from "@/components/pcr/NarrativeCard";
import { BillingCard } from "@/components/pcr/BillingCard";
import { StretcherMobilityCard } from "@/components/pcr/StretcherMobilityCard";
import { IsolationPrecautionsCard } from "@/components/pcr/IsolationPrecautionsCard";
import { LockedSectionOverlay } from "@/components/pcr/LockedSectionOverlay";
import { CrewSignaturesSection, areAllCrewSigned } from "@/components/pcr/CrewSignaturesSection";
import { DocumentAttachments } from "@/components/documents/DocumentAttachments";
import { IncidentReportForm } from "@/components/incidents/IncidentReportForm";
import { PCR_CARDS_BY_TRANSPORT, getPCRTransportKey, type PCRCardType, type PCRCardConfig } from "@/lib/pcr-dropdowns";
import { CancellationDocForm } from "@/components/crew/CancellationDocForm";
import { checkDuplicateTrip } from "@/lib/duplicate-trip-check";
import { evaluatePCRFieldCompletion } from "@/lib/pcr-field-requirements";
import { SectionCompletionBadge } from "@/components/pcr/PCRFieldIndicator";
import { KickbackChecklist } from "@/components/pcr/KickbackChecklist";
import { logAuditEvent } from "@/lib/audit-logger";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, Check, Loader2, Send, AlertCircle, Lock, AlertTriangle, Eye, Ban } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CrewMember { id: string; name: string; cert: string; }

interface RunForPCR {
  tripId: string | null;
  legId: string;
  slotId: string | null;
  legType: string;
  patientName: string;
  pickupTime: string | null;
  pickupLocation: string;
  destinationLocation: string;
  tripType: string | null;
  pcrStatus: string;
  tripStatus: string;
  truckId: string;
  crewId: string;
  companyId: string | null;
  patientId: string | null;
  legTypeRaw: string | null;
  cancellationReason: string | null;
}

function PCRRunSelector({ onSelect }: { onSelect: (tripId: string) => void }) {
  const { profileId } = useAuth();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<RunForPCR[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [dupWarning, setDupWarning] = useState<{ run: RunForPCR; existingTrips: { id: string; pickup_time: string | null; status: string }[] } | null>(null);
  const [inspectionGated, setInspectionGated] = useState(false);
  const [crewTruckId, setCrewTruckId] = useState<string | null>(null);

  const today = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`; })();

  // Fix 15: Check inspection gate as a reusable function
  const checkInspectionGate = useCallback(async (truckId: string, companyId: string) => {
    const { data: template } = await supabase
      .from("vehicle_inspection_templates" as any)
      .select("gate_enabled")
      .eq("truck_id", truckId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (!(template as any)?.gate_enabled) {
      setInspectionGated(false);
      return false;
    }

    const { count } = await supabase
      .from("vehicle_inspections" as any)
      .select("id", { count: "exact", head: true })
      .eq("truck_id", truckId)
      .eq("run_date", today);

    const gated = (count ?? 0) === 0;
    setInspectionGated(gated);
    return gated;
  }, [today]);

  // Fix 15: Realtime subscription + 30s polling for inspection gate unlock
  useEffect(() => {
    if (!crewTruckId || !inspectionGated) return;

    // 30-second polling fallback
    const interval = setInterval(async () => {
      const { count } = await supabase
        .from("vehicle_inspections" as any)
        .select("id", { count: "exact", head: true })
        .eq("truck_id", crewTruckId)
        .eq("run_date", today);
      if ((count ?? 0) > 0) {
        setInspectionGated(false);
      }
    }, 30000);

    // Realtime subscription
    const channel = supabase
      .channel(`inspection-gate-${crewTruckId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "INSERT",
          schema: "public",
          table: "vehicle_inspections",
        },
        (payload: any) => {
          if (payload.new?.truck_id === crewTruckId && payload.new?.run_date === today) {
            setInspectionGated(false);
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [crewTruckId, inspectionGated, today]);

  useEffect(() => {
    if (!profileId) return;
    (async () => {
      const items: RunForPCR[] = [];

      // --- 1. Try to find today's crew assignment ---
      const { data: crewRow } = await supabase
        .from("crews")
        .select("id, truck_id, company_id, active_date")
        .eq("active_date", today)
        .or(`member1_id.eq.${profileId},member2_id.eq.${profileId},member3_id.eq.${profileId}`)
        .maybeSingle();

      let todayTruckId: string | null = crewRow?.truck_id ?? null;
      let todayCrewId: string | null = crewRow?.id ?? null;
      let todayCompanyId: string | null = crewRow?.company_id ?? null;

      if (crewRow) {
        setCrewTruckId(crewRow.truck_id);

        // Check inspection gate
        const gated = await checkInspectionGate(crewRow.truck_id, crewRow.company_id);
        if (gated) {
          setLoading(false);
          return;
        }
      }

      // --- 2. Get today's runs from truck_run_slots if we have a truck ---
      if (todayTruckId && todayCrewId) {
        const { data: slots } = await supabase
          .from("truck_run_slots")
          .select("id, leg_id, slot_order")
          .eq("truck_id", todayTruckId)
          .eq("run_date", today)
          .order("slot_order");

        const legIds = (slots ?? []).map(s => s.leg_id);

        const [{ data: legs }, { data: trips }] = await Promise.all([
          legIds.length > 0
            ? supabase.from("scheduling_legs").select("id, leg_type, pickup_location, destination_location, pickup_time, trip_type, patient_id, is_oneoff, oneoff_name, patient:patients!scheduling_legs_patient_id_fkey(first_name, last_name)").in("id", legIds)
            : Promise.resolve({ data: [] }),
          legIds.length > 0
            ? supabase.from("trip_records").select("id, leg_id, status, company_id, pcr_status, trip_type, pcr_type, cancellation_reason").eq("run_date", today).eq("truck_id", todayTruckId!).in("leg_id", legIds)
            : Promise.resolve({ data: [] }),
        ]);

        const legMap = new Map((legs ?? []).map(l => [l.id, l]));
        const tripMap = new Map((trips ?? []).map(t => [t.leg_id, t]));

        for (const slot of (slots ?? [])) {
          const leg = legMap.get(slot.leg_id) as any;
          const trip = tripMap.get(slot.leg_id) as any;
          const patient = leg?.patient;
          const patientName = patient?.first_name
            ? `${patient.first_name.charAt(0)}. ${patient.last_name}`
            : (leg?.is_oneoff && leg?.oneoff_name) ? leg.oneoff_name
            : leg?.pickup_location || "Unknown Patient";
          const legTypeRaw = leg?.leg_type ?? null;
          const legType = legTypeRaw === "a_leg" || legTypeRaw === "A" ? "A" : legTypeRaw === "b_leg" || legTypeRaw === "B" ? "B" : "—";

          items.push({
            tripId: trip?.id ?? null,
            legId: slot.leg_id,
            slotId: slot.id,
            legType,
            legTypeRaw,
            patientName,
            pickupTime: leg?.pickup_time ?? null,
            pickupLocation: leg?.pickup_location ?? "—",
            destinationLocation: leg?.destination_location ?? "—",
            tripType: trip?.trip_type ?? leg?.trip_type ?? null,
            pcrStatus: trip?.pcr_status ?? "not_started",
            tripStatus: trip?.status ?? "scheduled",
            truckId: todayTruckId!,
            crewId: todayCrewId!,
            companyId: trip?.company_id ?? todayCompanyId ?? null,
            patientId: leg?.patient_id ?? null,
            cancellationReason: trip?.cancellation_reason ?? null,
          });
        }
      }

      // --- 2b. Fallback: if no crew row today, check trip_records directly ---
      if (!crewRow) {
        const { data: directTrips } = await supabase
          .from("trip_records")
          .select("id, leg_id, status, company_id, pcr_status, trip_type, pcr_type, cancellation_reason, truck_id, crew_id, scheduled_pickup_time, pickup_location, destination_location, patient_id")
          .eq("run_date", today)
          .in("pcr_status", ["not_started", "in_progress"]);

        // Filter to trips where crew_id matches a crew the user was on
        if (directTrips && directTrips.length > 0) {
          const crewIds = [...new Set(directTrips.map((t: any) => t.crew_id).filter(Boolean))] as string[];
          let userCrewIds = new Set<string>();
          if (crewIds.length > 0) {
            const { data: crewRows } = await supabase
              .from("crews")
              .select("id")
              .in("id", crewIds)
              .or(`member1_id.eq.${profileId},member2_id.eq.${profileId},member3_id.eq.${profileId}`);
            userCrewIds = new Set((crewRows ?? []).map(c => c.id));
          }

          const relevantTrips = directTrips.filter((t: any) => t.crew_id && userCrewIds.has(t.crew_id));
          if (relevantTrips.length > 0) {
            const patientIds = [...new Set(relevantTrips.map((t: any) => t.patient_id).filter(Boolean))] as string[];
            const { data: patients } = patientIds.length > 0
              ? await supabase.from("patients").select("id, first_name, last_name").in("id", patientIds)
              : { data: [] };
            const patientMap = new Map((patients ?? []).map((p: any) => [p.id, p]));

            for (const trip of relevantTrips) {
              const p = patientMap.get((trip as any).patient_id);
              const patientName = p ? `${(p as any).first_name.charAt(0)}. ${(p as any).last_name}` : "Unknown Patient";
              items.push({
                tripId: trip.id,
                legId: (trip as any).leg_id ?? "",
                slotId: null,
                legType: "—",
                legTypeRaw: null,
                patientName,
                pickupTime: (trip as any).scheduled_pickup_time ?? null,
                pickupLocation: (trip as any).pickup_location ?? "—",
                destinationLocation: (trip as any).destination_location ?? "—",
                tripType: (trip as any).trip_type ?? null,
                pcrStatus: (trip as any).pcr_status ?? "not_started",
                tripStatus: (trip as any).status ?? "scheduled",
                truckId: (trip as any).truck_id ?? "",
                crewId: (trip as any).crew_id ?? "",
                companyId: (trip as any).company_id ?? null,
                patientId: (trip as any).patient_id ?? null,
                cancellationReason: (trip as any).cancellation_reason ?? null,
              });
            }
          }
        }
      }

      // --- 3. Fetch incomplete PCRs from previous days based on crew history ---
      const { data: allCrewRows } = await supabase
        .from("crews")
        .select("id")
        .or(`member1_id.eq.${profileId},member2_id.eq.${profileId},member3_id.eq.${profileId}`);

      const allCrewIds = (allCrewRows ?? []).map(c => c.id);

      if (allCrewIds.length > 0) {
        const { data: pastIncomplete } = await supabase
          .from("trip_records")
          .select("id, leg_id, status, company_id, pcr_status, trip_type, pcr_type, cancellation_reason, run_date, patient_id, truck_id, crew_id, scheduled_pickup_time, pickup_location, destination_location")
          .in("crew_id", allCrewIds)
          .in("pcr_status", ["not_started", "in_progress"])
          .lt("run_date", today);

        if (pastIncomplete && pastIncomplete.length > 0) {
          const existingTripIds = new Set(items.map(i => i.tripId).filter(Boolean));
          const newPast = pastIncomplete.filter((t: any) => !existingTripIds.has(t.id));

          if (newPast.length > 0) {
            const pastPatientIds = [...new Set(newPast.map((t: any) => t.patient_id).filter(Boolean))] as string[];
            const { data: pastPatients } = pastPatientIds.length > 0
              ? await supabase.from("patients").select("id, first_name, last_name").in("id", pastPatientIds)
              : { data: [] };
            const pastPatientMap = new Map((pastPatients ?? []).map((p: any) => [p.id, p]));

            const pastItems: RunForPCR[] = newPast.map((trip: any) => {
              const patient = pastPatientMap.get(trip.patient_id);
              const patientName = patient
                ? `${(patient as any).first_name.charAt(0)}. ${(patient as any).last_name}`
                : "Unknown Patient";
              return {
                tripId: trip.id,
                legId: trip.leg_id ?? "",
                slotId: null,
                legType: "—",
                legTypeRaw: null,
                patientName: `${patientName} (${trip.run_date})`,
                pickupTime: trip.scheduled_pickup_time ?? null,
                pickupLocation: trip.pickup_location ?? "—",
                destinationLocation: trip.destination_location ?? "—",
                tripType: trip.trip_type ?? null,
                pcrStatus: trip.pcr_status ?? "not_started",
                tripStatus: trip.status ?? "scheduled",
                truckId: trip.truck_id ?? "",
                crewId: trip.crew_id ?? "",
                companyId: trip.company_id ?? null,
                patientId: trip.patient_id ?? null,
                cancellationReason: trip.cancellation_reason ?? null,
              };
            });
            // Put incomplete past runs at the top
            items.unshift(...pastItems);
          }
        }
      }

      setRuns(items);
      setLoading(false);

      // Auto-select if only one non-cancelled run with a trip record
      const activeRuns = items.filter(r => !["cancelled", "pending_cancellation"].includes(r.tripStatus));
      if (activeRuns.length === 1 && activeRuns[0].tripId) {
        onSelect(activeRuns[0].tripId);
      }
    })();
  }, [profileId, today]);

  const getOriginDestination = (tripType: string, legType: string) => {
    if (legType === "B") {
      const origin = tripType === "dialysis" ? "Dialysis Facility" : tripType === "ift" ? "Hospital" : "Healthcare Facility";
      return { origin_type: origin, destination_type: "Residence" };
    }
    const destination = tripType === "dialysis" ? "Dialysis Facility" : tripType === "ift" ? "Hospital" : "Healthcare Facility";
    return { origin_type: "Residence", destination_type: destination };
  };

  const createTripForRun = async (run: RunForPCR) => {
    setCreating(run.legId);
    const companyId = run.companyId;
    if (!companyId) {
      toast.error("No company association found");
      setCreating(null);
      return;
    }
    const derived = getOriginDestination(run.tripType ?? "", run.legType);
    const insertData: any = {
      leg_id: run.legId, truck_id: run.truckId, crew_id: run.crewId,
      company_id: companyId, patient_id: run.patientId,
      run_date: today, status: "scheduled" as any,
      pickup_location: run.pickupLocation, destination_location: run.destinationLocation,
      scheduled_pickup_time: run.pickupTime, trip_type: run.tripType as any,
      pcr_type: run.tripType as any, pcr_status: "not_started",
      origin_type: derived.origin_type, destination_type: derived.destination_type,
    };
    if (run.slotId) insertData.slot_id = run.slotId;
    const { data: newTrip, error } = await supabase.from("trip_records").insert(insertData).select("id").single();

    if (error || !newTrip) {
      // Handle unique constraint violation on leg_id — fetch existing record instead
      if (error?.code === "23505" && run.legId) {
        const { data: existingTrip } = await supabase
          .from("trip_records")
          .select("id")
          .eq("leg_id", run.legId)
          .maybeSingle();
        if (existingTrip) {
          if (run.legTypeRaw) sessionStorage.setItem("pcr_leg_type", run.legTypeRaw);
          onSelect(existingTrip.id);
          setCreating(null);
          return;
        }
      }
      toast.error(error?.message ?? "Failed to create trip record");
      setCreating(null);
      return;
    }
    if (run.legTypeRaw) sessionStorage.setItem("pcr_leg_type", run.legTypeRaw);
    onSelect(newTrip.id);
    setCreating(null);
  };

  const handleSelect = async (run: RunForPCR) => {
    const isCancelled = ["cancelled", "pending_cancellation"].includes(run.tripStatus);
    if (isCancelled) return;

    if (run.tripId) {
      if (run.legTypeRaw) sessionStorage.setItem("pcr_leg_type", run.legTypeRaw);
      onSelect(run.tripId);
      return;
    }

    // Duplicate trip detection
    if (run.patientId) {
      const dupResult = await checkDuplicateTrip(run.patientId, today, run.pickupTime);
      if (dupResult.isDuplicate) {
        setDupWarning({ run, existingTrips: dupResult.existingTrips });
        return;
      }
    }

    await createTripForRun(run);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6">
        <p className="text-muted-foreground text-sm">No runs assigned.</p>
      </div>
    );
  }

  const PCR_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    not_started: { label: "Not Started", color: "bg-muted text-muted-foreground" },
    in_progress: { label: "In Progress", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400" },
    completed: { label: "Completed", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400" },
    submitted: { label: "Submitted", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400" },
    kicked_back: { label: "Returned", color: "bg-destructive/10 text-destructive border-destructive/30" },
  };

  if (inspectionGated) {
    return (
      <div className="flex flex-col items-center justify-center p-10 space-y-4 text-center">
        <Lock className="h-10 w-10 text-muted-foreground" />
        <h3 className="text-lg font-bold text-foreground">Pre-Trip Inspection Required</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Pre-trip inspection required before accessing PCR. Complete the inspection in the Checklist tab.
        </p>
        <Button onClick={() => navigate("/crew-checklist")}>
          Go to Checklist
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-3">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Select a run to open PCR</p>
      {runs.map(run => {
        const isCancelled = ["cancelled", "pending_cancellation"].includes(run.tripStatus);
        const pcr = PCR_STATUS_CONFIG[run.pcrStatus] ?? PCR_STATUS_CONFIG.not_started;

        return (
          <button
            key={run.legId}
            onClick={() => handleSelect(run)}
            disabled={isCancelled || creating === run.legId}
            className={cn(
              "w-full text-left rounded-lg border p-4 transition-colors",
              isCancelled
                ? "bg-muted/40 opacity-60 cursor-not-allowed"
                : "bg-card hover:bg-accent/50 cursor-pointer"
            )}
          >
            <div className="flex items-start gap-3">
              <Badge variant="secondary" className={cn(
                "text-xs px-1.5 py-0 mt-0.5 shrink-0",
                run.legType === "A" ? "bg-primary/10 text-primary" : run.legType === "B" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" : ""
              )}>
                {run.legType}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{run.patientName}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {run.pickupTime && <><span className="font-medium">@ {run.pickupTime?.substring(0,5)}</span> · </>}
                  {run.pickupLocation} → {run.destinationLocation}
                </p>
              </div>
              <div className="shrink-0">
                {isCancelled ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                    <Ban className="h-3 w-3" />
                    {run.tripStatus === "pending_cancellation" ? "Pending Cancel" : "Cancelled"}
                  </span>
                ) : creating === run.legId ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold", pcr.color)}>
                    {run.pcrStatus === "not_started" ? "Start PCR" :
                     run.pcrStatus === "in_progress" ? "Continue" :
                     run.pcrStatus === "submitted" ? "View" :
                     run.pcrStatus === "kicked_back" ? "Correct" : pcr.label}
                  </span>
                )}
              </div>
            </div>
            {isCancelled && run.cancellationReason && (
              <p className="text-xs text-muted-foreground italic mt-2 pl-8">Reason: {run.cancellationReason}</p>
            )}
          </button>
        );
      })}

      {/* Duplicate Trip Warning Dialog */}
      <Dialog open={!!dupWarning} onOpenChange={o => { if (!o) setDupWarning(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Potential Duplicate Trip
            </DialogTitle>
            <DialogDescription>
              A trip already exists for this patient on this date with a pickup time within 30 minutes. Are you sure you want to create another trip record?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {dupWarning?.existingTrips.map(t => (
              <div key={t.id} className="rounded-md border bg-muted/30 p-2 text-xs">
                <span className="font-medium">Pickup: {t.pickup_time?.substring(0, 5) ?? "N/A"}</span>
                <span className="ml-3 text-muted-foreground">Status: {t.status}</span>
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDupWarning(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const run = dupWarning!.run;
                setDupWarning(null);
                logAuditEvent({ action: "duplicate_override", tableName: "trip_records", notes: `Crew confirmed duplicate trip for patient ${run.patientId} on ${today}` });
                await createTripForRun(run);
              }}
            >
              Create Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PCRPage() {
  const { profileId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const tripId = searchParams.get("tripId");
  const { trip, loading, saving, updateField, updateMultipleFields, recordTime, refetch } = usePCRData(tripId);

  // Resolve leg type from joined data or sessionStorage fallback
  const activeLegType = trip?.leg_type ?? sessionStorage.getItem("pcr_leg_type") ?? null;

  const [activeCard, setActiveCard] = useState<PCRCardType | null>(null);
  const [truckName, setTruckName] = useState("");
  const [crewMembers, setCrewMembers] = useState<{ m1: CrewMember | null; m2: CrewMember | null; m3: CrewMember | null }>({ m1: null, m2: null, m3: null });
  const [submitting, setSubmitting] = useState(false);
  // showUpgradeDialog and upgrading removed — emergency upgrade now handled via crew dashboard
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [assignedCrewCount, setAssignedCrewCount] = useState(0);
  const [cancelDocOpen, setCancelDocOpen] = useState(false);

  // Central section rules driven by pcr_type
  const sectionRules = usePCRSectionRules(trip?.pcr_type || trip?.trip_type);

  // Fetch crew info for medic selection + count assigned crew
  useEffect(() => {
    if (!trip?.crew_id) return;
    (async () => {
      const { data: crew } = await supabase
        .from("crews")
        .select("truck_id, member1_id, member2_id, member3_id, truck:trucks!crews_truck_id_fkey(name), member1:profiles!crews_member1_id_fkey(id, full_name, cert_level), member2:profiles!crews_member2_id_fkey(id, full_name, cert_level), member3:profiles!crews_member3_id_fkey(id, full_name, cert_level)")
        .eq("id", trip.crew_id)
        .maybeSingle();
      if (crew) {
        setTruckName((crew.truck as any)?.name || "");
        const m1 = crew.member1 as any;
        const m2 = crew.member2 as any;
        const m3 = (crew as any).member3 as any;
        setCrewMembers({
          m1: m1 ? { id: m1.id, name: m1.full_name, cert: m1.cert_level } : null,
          m2: m2 ? { id: m2.id, name: m2.full_name, cert: m2.cert_level } : null,
          m3: m3 ? { id: m3.id, name: m3.full_name, cert: m3.cert_level } : null,
        });
        let count = 0;
        if (crew.member1_id) count++;
        if (crew.member2_id) count++;
        if ((crew as any).member3_id) count++;
        setAssignedCrewCount(count);
      }
    })();
  }, [trip?.crew_id]);

  // Audit log: record PCR view
  useEffect(() => {
    if (!trip?.id || !profileId) return;
    logAuditEvent({
      action: "view",
      tableName: "trip_records",
      recordId: trip.id,
      notes: "PCR viewed",
    });
  }, [trip?.id, profileId]);

  // If no tripId, show run selector
  if (!tripId) {
    return (
      <CrewLayout>
        <PCRRunSelector onSelect={(id) => setSearchParams({ tripId: id })} />
      </CrewLayout>
    );
  }

  if (loading) {
    return <CrewLayout><div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></CrewLayout>;
  }

  if (!trip) {
    return (
      <CrewLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-6">
          <p className="text-muted-foreground font-medium">You are not assigned to this run</p>
          <p className="text-xs text-muted-foreground mt-1">If you believe this is an error, contact your dispatcher.</p>
          <Button className="mt-4" onClick={() => setSearchParams({})}>Back to Run List</Button>
        </div>
      </CrewLayout>
    );
  }

  // Check if the run is cancelled — show documentation prompt if PCR was started
  const isTripCancelled = ["cancelled", "pending_cancellation"].includes(trip.status);
  const needsCancelDoc = isTripCancelled && (trip as any).pcr_status === "cancelled_with_pcr";
  
  if (isTripCancelled) {
    return (
      <CrewLayout>
        <div className="p-4 max-w-2xl mx-auto space-y-4">
          {needsCancelDoc && (
            <div className="rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700/50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <h2 className="text-sm font-bold text-amber-800 dark:text-amber-300">This run has been cancelled — cancellation documentation is required</h2>
              </div>
              <Button
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => setCancelDocOpen(true)}
              >
                Complete Documentation
              </Button>
            </div>
          )}
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
            <Ban className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="text-lg font-bold text-foreground">Run Cancelled</h2>
            <p className="text-sm text-muted-foreground">
              {trip.status === "pending_cancellation"
                ? "This run has a pending cancellation request. PCR editing is locked until dispatch resolves it."
                : (trip as any).pcr_status === "cancelled_documented"
                ? "This run has been cancelled and documentation has been completed."
                : "This run has been cancelled. The PCR can no longer be edited."}
            </p>
            {(trip as any).cancellation_reason && (
              <p className="text-xs text-muted-foreground italic">Reason: {(trip as any).cancellation_reason}</p>
            )}
          </div>
          <Button variant="outline" className="w-full" onClick={() => setSearchParams({})}>
            ← Back to Run List
          </Button>

          <CancellationDocForm
            open={cancelDocOpen}
            onOpenChange={setCancelDocOpen}
            tripId={trip.id}
            patientName={trip.patient ? `${trip.patient.first_name} ${trip.patient.last_name}` : "Unknown"}
            cancelledAt={(trip as any).cancelled_at ?? null}
            crewMemberName={crewMembers.m1?.name ?? crewMembers.m2?.name ?? ""}
            crewMemberCert={crewMembers.m1?.cert ?? crewMembers.m2?.cert ?? ""}
            onComplete={() => { setCancelDocOpen(false); refetch(); }}
          />
        </div>
      </CrewLayout>
    );
  }

  // Medic selection prompt
  const isReadOnly = trip.pcr_status === "submitted";
  const isKickedBack = trip.pcr_status === "kicked_back";

  if (!trip.attending_medic_id) {
    const handleMedicSelect = async (medic: CrewMember) => {
      await updateMultipleFields({
        attending_medic_id: medic.id,
        attending_medic_name: medic.name,
        attending_medic_cert: medic.cert,
        pcr_status: "in_progress",
      });
    };
    return (
      <CrewLayout>
        <MedicSelector crewMember1={crewMembers.m1} crewMember2={crewMembers.m2} crewMember3={crewMembers.m3} onSelect={handleMedicSelect} />
      </CrewLayout>
    );
  }

  const transportKey = getPCRTransportKey(trip.trip_type || trip.pcr_type);
  const cards = PCR_CARDS_BY_TRANSPORT[transportKey] || PCR_CARDS_BY_TRANSPORT.dialysis;

  // Helper to get card rule — handles combined stretcher_mobility card
  const getEffectiveCardRule = (cardType: string) => {
    if (cardType === "stretcher_mobility") {
      const sp = sectionRules.getRule("stretcher_placement");
      const pm = sectionRules.getRule("patient_mobility");
      // If either is required, the combined card is required
      if (sp.state === "required" || pm.state === "required") return { state: "required" as const, lockedReason: "" };
      if (sp.state === "locked" && pm.state === "locked") return sp;
      return { state: "optional" as const, lockedReason: "" };
    }
    return sectionRules.getCardRule(cardType);
  };
  // Determine card completion status
  const isCardComplete = (card: PCRCardConfig): boolean => {
    switch (card.type) {
      case "times": return !!(trip.dispatch_time && trip.at_scene_time && trip.left_scene_time && trip.arrived_dropoff_at && trip.in_service_time);
      case "patient_info": return !!trip.patient;
      case "vitals": return (trip.vitals_json || []).length > 0 && !!(trip.vitals_json[0]?.bp_systolic);
      case "condition_on_arrival": return !!(trip.level_of_consciousness && trip.skin_condition);
      case "medical_necessity": return !!trip.medical_necessity_reason;
      case "equipment": {
        const eq = trip.equipment_used_json || {};
        return Object.values(eq).some((v: any) => !!v);
      }
      case "signatures": return (trip.signatures_json || []).length > 0;
      case "narrative": return !!trip.narrative;
      case "billing": return true;
      case "sending_facility": return !!(trip.sending_facility_json?.facility_name);
      case "assessment": case "chief_complaint": return !!(trip.chief_complaint || trip.primary_impression);
      case "physical_exam": return Object.keys(trip.physical_exam_json || {}).some((k: string) => (trip.physical_exam_json[k]?.findings || []).length > 0);
      case "hospital_outcome": return !!(trip.hospital_outcome_json?.chief_complaint || trip.disposition);
      case "stretcher_mobility": return !!(trip.stretcher_placement && trip.patient_mobility);
      case "isolation_precautions": {
        const iso = trip.isolation_precautions || {};
        return iso.required === true ? ((iso.types || []).length > 0) : (iso.required === false);
      }
      default: return false;
    }
  };

  const getCardColor = (card: PCRCardConfig): string => {
    const rule = getEffectiveCardRule(card.type);
    if (rule.state === "locked") return "border-muted bg-muted/20 opacity-60";
    const complete = isCardComplete(card);
    if (complete) return "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/10";
    if (rule.state === "required") return "border-destructive/50 bg-destructive/5";
    // Optional and incomplete → neutral
    return "border-border";
  };

  const getCardDot = (card: PCRCardConfig): string => {
    const rule = getEffectiveCardRule(card.type);
    if (rule.state === "locked") return "bg-muted-foreground/20";
    const complete = isCardComplete(card);
    if (complete) return "bg-emerald-500";
    if (rule.state === "required") return "bg-destructive";
    return "bg-muted-foreground/30";
  };

  const getCardStateLabel = (card: PCRCardConfig): React.ReactNode => {
    const rule = getEffectiveCardRule(card.type);
    if (rule.state === "locked") {
      return <Lock className="h-4 w-4 text-muted-foreground/40" />;
    }
    if (isCardComplete(card)) {
      return <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
    }
    if (rule.state === "required") {
      return <span className="text-[10px] font-bold uppercase text-destructive">Required</span>;
    }
    return <span className="text-[10px] font-medium uppercase text-muted-foreground">Optional</span>;
  };

  // Render card content — locked cards show overlay instead
  const renderCard = (type: PCRCardType) => {
    const rule = getEffectiveCardRule(type);
    if (rule.state === "locked") {
      return <LockedSectionOverlay reason={rule.lockedReason} />;
    }
    switch (type) {
      case "times": return <TimesCard trip={trip} recordTime={recordTime} updateField={updateField} updateMultipleFields={updateMultipleFields} />;
      case "patient_info": return <PatientInfoCard trip={trip} updateField={updateField} />;
      case "vitals": return <VitalsCard trip={trip} updateField={updateField} />;
      case "condition_on_arrival": return <ConditionOnArrivalCard trip={trip} updateField={updateField} />;
      case "medical_necessity": return <MedicalNecessityCard trip={trip} updateField={updateField} updateMultipleFields={updateMultipleFields} />;
      case "equipment": return <EquipmentCard trip={trip} updateField={updateField} />;
      case "signatures": return <SignaturesCard trip={trip} updateField={updateField} legType={activeLegType} />;
      case "narrative": return <NarrativeCard trip={trip} truckName={truckName} updateField={updateField} />;
      case "billing": return <BillingCard trip={trip} updateField={updateField} />;
      case "sending_facility": return <SendingFacilityCard trip={trip} updateField={updateField} tripType={trip.trip_type || trip.pcr_type || ""} />;
      case "assessment": case "chief_complaint": return <AssessmentCard trip={trip} updateField={updateField} />;
      case "physical_exam": return <PhysicalExamCard trip={trip} updateField={updateField} />;
      case "hospital_outcome": return <HospitalOutcomeCard trip={trip} updateField={updateField} />;
      case "stretcher_mobility": return <StretcherMobilityCard trip={trip} updateField={updateField} />;
      case "isolation_precautions": return <IsolationPrecautionsCard trip={trip} updateField={updateField} />;
      default: return <p className="text-sm text-muted-foreground">Coming soon.</p>;
    }
  };

  // handleEmergencyUpgrade removed — now handled via crew dashboard useEmergencyUpgrade hook

  // Only require completion of sections marked "required" by rules
  const getMissingItems = (): string[] => {
    const missing: string[] = [];
    for (const card of cards) {
      const rule = getEffectiveCardRule(card.type);
      if (rule.state === "required" && !isCardComplete(card)) {
        missing.push(card.label);
      }
    }
    // Odometer fields required on all PCR types — 0 is valid (trip counter reset)
    if (trip.odometer_at_scene == null) missing.push("Odometer at Scene");
    if (trip.odometer_at_destination == null) missing.push("Odometer at Destination");
    // Crew signatures required
    if (assignedCrewCount > 0 && !areAllCrewSigned(trip.signatures_json || [], assignedCrewCount)) {
      missing.push("Crew Signatures");
    }
    return missing;
  };

  const handleSubmit = async () => {
    const missing = getMissingItems();
    if (missing.length > 0) {
      toast.error(`Complete these sections first: ${missing.join(", ")}`);
      return;
    }
    setSubmitting(true);
    try {
      await supabase.from("trip_records").update({
        pcr_status: "submitted",
        pcr_completed_at: new Date().toISOString(),
        pcr_submitted_by: profileId,
        status: "ready_for_billing",
        claim_ready: true,
        documentation_complete: true,
        // Clear kickback fields on resubmit
        kickback_reasons: [],
        kickback_note: null,
        kicked_back_by: null,
        kicked_back_at: null,
        updated_at: new Date().toISOString(),
        updated_by: profileId,
      } as any).eq("id", trip.id);

      // Auto-create QA review
      if (trip.company_id) {
        await supabase.from("qa_reviews").insert({
          company_id: trip.company_id,
          trip_id: trip.id,
          flag_reason: isKickedBack ? "PCR resubmitted after kickback — pending QA review" : "PCR auto-submitted — pending QA review",
          status: "pending",
        });
      }

      // Fire-and-forget: create biller task for new claim
      try {
        const patientName = trip.patient
          ? `${trip.patient.first_name} ${trip.patient.last_name}`
          : "Unknown Patient";
        // Only insert if no pending/in_progress task of this type exists for this trip
        const { data: existing } = await supabase
          .from("biller_tasks")
          .select("id")
          .eq("trip_id", trip.id)
          .eq("task_type", "new_claim_ready")
          .in("status", ["pending", "in_progress"])
          .limit(1);
        if (!existing || existing.length === 0) {
          await supabase.from("biller_tasks").insert({
            company_id: trip.company_id,
            trip_id: trip.id,
            task_type: "new_claim_ready",
            priority: 4,
            title: "New trip ready to bill",
            description: `${patientName} — ${trip.run_date}`,
            status: "pending",
            due_date: new Date().toISOString().split("T")[0],
          });
        }
      } catch (taskErr) {
        console.error("Failed to create biller task (non-blocking):", taskErr);
      }

      toast.success("PCR submitted — trip is ready for billing!");
      navigate("/crew-dashboard");
    } catch (err: any) {
      toast.error("Failed to submit PCR");
    }
    setSubmitting(false);
  };

  // If a card is open, show its content
  if (activeCard) {
    const cardConfig = cards.find(c => c.type === activeCard);
    return (
      <CrewLayout>
        <div className="p-4 pb-24 min-h-screen">
          <button onClick={() => setActiveCard(null)} className="mb-3 flex items-center gap-1 text-sm text-muted-foreground">
            <ChevronLeft className="h-4 w-4" /> Back to PCR
          </button>
          {isReadOnly && (
            <div className="mb-3 rounded-lg border border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 p-2 text-center">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1">
                <Eye className="h-3.5 w-3.5" /> View Only — Submitted PCR
              </p>
            </div>
          )}
          <h2 className="text-lg font-bold text-foreground mb-4">{cardConfig?.label}</h2>
          {saving && !isReadOnly && <p className="text-xs text-muted-foreground mb-2">Saving...</p>}
          <fieldset disabled={isReadOnly} className={isReadOnly ? "pointer-events-none opacity-80" : ""}>
            {renderCard(activeCard)}
          </fieldset>
        </div>
      </CrewLayout>
    );
  }

  // Card overview
  const patient = trip.patient;
  const requiredCards = cards.filter(c => getEffectiveCardRule(c.type).state === "required");
  const completedRequired = requiredCards.filter(c => isCardComplete(c)).length;
  const totalRequired = requiredCards.length;

  // Field-level completion tracking
  const fieldCompletion = evaluatePCRFieldCompletion(trip);
  const timeWarningCount = getTimeSequenceWarnings(trip).size;

  return (
    <CrewLayout>
      <div className="p-4 pb-24 min-h-screen">
        {/* Kickback checklist — dynamic resolution tracking */}
        {isKickedBack && <KickbackChecklist trip={trip} />}

        {/* Read-only submitted banner */}
        {isReadOnly && (
          <div className="mb-4 rounded-lg border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-800/30 flex items-center justify-center">
                <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">PCR Submitted</p>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">
                  {trip.pcr_completed_at ? new Date(trip.pcr_completed_at).toLocaleString() : "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Attending: {trip.attending_medic_name} ({trip.attending_medic_cert})
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs font-medium text-emerald-700/60 dark:text-emerald-400/60 flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" /> View Only — Submitted PCR
            </p>
          </div>
        )}

        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{truckName}</p>
          <h2 className="text-lg font-bold text-foreground">
            {patient ? `${patient.first_name} ${patient.last_name}` : "PCR"}
          </h2>
          <p className="text-sm text-muted-foreground capitalize">{sectionRules.type.replace(/_/g, " ")} Transport</p>
          {!isReadOnly && (
            <p className="text-xs text-muted-foreground mt-1">
              Attending: {trip.attending_medic_name} ({trip.attending_medic_cert})
            </p>
          )}
          {!isReadOnly && (
            <>
              <div className="mt-2 flex items-center gap-2 min-w-0 overflow-hidden">
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden min-w-0">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${totalRequired > 0 ? (completedRequired / totalRequired) * 100 : 0}%` }} />
                </div>
                <span className="text-xs font-medium text-muted-foreground shrink-0">{completedRequired}/{totalRequired}</span>
              </div>
              <p className={cn("text-xs font-medium mt-1", fieldCompletion.completedRequired === fieldCompletion.totalRequired ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                {fieldCompletion.completedRequired} of {fieldCompletion.totalRequired} required fields complete
              </p>
              {timeWarningCount > 0 && (
                <p className="text-xs font-medium text-destructive/80 mt-0.5 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {timeWarningCount} time sequence {timeWarningCount === 1 ? "warning" : "warnings"}
                </p>
              )}
            </>
          )}
        </div>

        {/* Emergency Upgrade removed — now on crew dashboard only */}

        <div className="space-y-3">
          {cards.map((card) => {
            const rule = getEffectiveCardRule(card.type);
            const isLockedCard = rule.state === "locked";

            return (
              <button
                key={card.type}
                onClick={() => !isLockedCard && setActiveCard(card.type)}
                disabled={isLockedCard}
                className={cn(
                  "w-full rounded-lg border-2 p-4 text-left transition-all",
                  isLockedCard ? "cursor-not-allowed" : "active:scale-[0.98]",
                  getCardColor(card)
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("h-3 w-3 rounded-full shrink-0", getCardDot(card))} />
                  <span className={cn("flex-1 text-sm font-semibold", isLockedCard ? "text-muted-foreground/50" : "text-foreground")}>
                    {card.label}
                  </span>
                  {!isLockedCard && (() => {
                    const sectionKey = card.type === "chief_complaint" ? "assessment" : card.type;
                    const sec = fieldCompletion.bySection[sectionKey];
                    if (sec && sec.total > 0 && rule.state === "required") {
                      return <SectionCompletionBadge completed={sec.completed} total={sec.total} />;
                    }
                    return null;
                  })()}
                  {getCardStateLabel(card)}
                </div>
                {isLockedCard && (
                  <p className="text-[10px] text-muted-foreground/40 mt-1 ml-6">{rule.lockedReason}</p>
                )}
              </button>
            );
          })}
        </div>

        {/* Odometer validation indicator — 0 is valid (trip counter reset) */}
        {!isReadOnly && (
          <div className={cn("mt-3 rounded-lg border-2 p-3", 
            trip.odometer_at_scene != null && trip.odometer_at_destination != null && Number(trip.odometer_at_destination) >= Number(trip.odometer_at_scene)
              ? "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/10"
              : "border-destructive bg-destructive/5"
          )}>
            <p className="text-xs font-bold text-foreground mb-1">Odometer Readings (Required)</p>
            <div className="flex gap-4 text-xs">
              <span className={trip.odometer_at_scene != null ? "text-emerald-600 dark:text-emerald-400" : "text-destructive font-bold"}>
                At Scene: {trip.odometer_at_scene != null ? trip.odometer_at_scene : "Missing"}
              </span>
              <span className={trip.odometer_at_destination != null ? "text-emerald-600 dark:text-emerald-400" : "text-destructive font-bold"}>
                At Destination: {trip.odometer_at_destination != null ? trip.odometer_at_destination : "Missing"}
              </span>
            </div>
            {trip.odometer_at_scene != null && trip.odometer_at_destination != null && (
              Number(trip.odometer_at_destination) >= Number(trip.odometer_at_scene) ? (
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1">
                  ✓ Loaded Miles: {(Number(trip.odometer_at_destination) - Number(trip.odometer_at_scene)).toFixed(1)}
                </p>
              ) : (
                <p className="text-xs font-bold text-destructive mt-1">
                  ⚠ Destination reading must be greater than or equal to scene reading
                </p>
              )
            )}
          </div>
        )}

        {/* Crew Signatures Section */}
        {!isReadOnly && (
          <div className="mt-3">
            <CrewSignaturesSection trip={trip} updateField={updateField} />
          </div>
        )}

        {/* Document Attachments */}
        <div className="mt-3">
          <DocumentAttachments
            recordType="pcr"
            recordId={trip.id}
            companyId={trip.company_id}
            allowUpload={!isReadOnly}
          />
        </div>

        {/* Incident Report */}
        {!isReadOnly && (
          <div className="mt-3">
            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setIncidentOpen(true)}>
              <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
              Report Incident
            </Button>
          </div>
        )}

        {/* Submit — only when not read-only */}
        {!isReadOnly && (
          <div className="mt-6">
            {getMissingItems().length > 0 && (
              <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-destructive">Missing sections:</p>
                    <p className="text-xs text-destructive/80">{getMissingItems().join(", ")}</p>
                  </div>
                </div>
              </div>
            )}
            <Button
              className="w-full h-14 text-base font-bold"
              disabled={submitting || getMissingItems().length > 0}
              onClick={handleSubmit}
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Send className="h-5 w-5 mr-2" />}
              Submit PCR
            </Button>
          </div>
        )}

        {/* Emergency Upgrade Dialog removed — now handled via crew dashboard */}

        {/* Incident Report Dialog */}
        <IncidentReportForm
          open={incidentOpen}
          onClose={() => setIncidentOpen(false)}
          defaultTruckId={trip.truck_id}
          defaultPatientName={trip.patient ? `${trip.patient.first_name} ${trip.patient.last_name}` : undefined}
        />
      </div>
    </CrewLayout>
  );
}

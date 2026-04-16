import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { IncidentReportForm } from "@/components/incidents/IncidentReportForm";
import { PageLoader } from "@/components/ui/page-loader";
import { getLocalToday } from "@/lib/local-date";
import { supabase } from "@/integrations/supabase/client";
import { TruckCard } from "@/components/dispatch/TruckCard";
import { AlertsPanel } from "@/components/dispatch/AlertsPanel";
import { OperationalAlertsPanel, type OperationalAlert } from "@/components/dispatch/OperationalAlertsPanel";
import { PendingCancellationPanel, type PendingCancellation } from "@/components/dispatch/PendingCancellationPanel";
import { CommunicationsSection } from "@/components/dispatch/CommunicationsSection";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useSchedulingStore } from "@/hooks/useSchedulingStore";
import { computeCleanTripStatus } from "@/lib/billing-utils";
import { computeRevenueStrength, type RevenueStrength } from "@/components/dispatch/RevenueStrengthBadge";
import { evaluateSafetyRules, hasCompletePatientNeeds, type SafetyStatus } from "@/lib/safety-rules";
import { ChevronLeft, ChevronRight, CalendarIcon, Expand, Shrink } from "lucide-react";

import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { TrialBanner } from "@/components/onboarding/TrialBanner";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";

type RunStatus = Database["public"]["Enums"]["run_status"];
type BillingStatus = "clean" | "missing_pcs" | "blocked_auth" | "blocked_other" | "not_ready" | null;

interface TruckData {
  id: string;
  name: string;
  crewNames: string[];
  scheduledLegsCount: number;
  runs: {
    id: string;
    patient_name: string;
    pickup_time: string | null;
    status: string;
    trip_type: string;
    is_current: boolean;
    patient_weight?: number | null;
    billing_status?: BillingStatus;
    billing_issues?: string[];
    hcpcs_codes?: string[];
    hcpcs_modifiers?: string[];
    loaded_miles?: number | null;
    estimated_charge?: number | null;
    destination_name?: string | null;
    leg_id?: string | null;
    // PCR time taps
    dispatch_time?: string | null;
    arrived_pickup_at?: string | null;
    at_scene_time?: string | null;
    patient_contact_time?: string | null;
    left_scene_time?: string | null;
    arrived_dropoff_at?: string | null;
    in_service_time?: string | null;
    pcr_status?: string | null;
  }[];
  overallStatus: "green" | "yellow" | "red";
  downStatus: "down_maintenance" | "down_out_of_service" | null;
  downReason: string | null;
  revenueStrength: RevenueStrength;
  medicareCount: number;
  facilityContractCount: number;
}

interface AlertData {
  id: string;
  message: string;
  severity: "yellow" | "red";
  created_at: string;
  hold_timer_started_at?: string | null;
}

// Issue 6: Updated computeOverallStatus — yellow when no runs have progressed past assigned
function computeOverallStatus(runs: { status: RunStatus }[]): "green" | "yellow" | "red" {
  if (runs.length === 0) return "green";
  const statuses = runs.map((r) => r.status);
  // Any cancelled or no_show = red
  // Yellow if ALL runs are still in pre-progress statuses
  const preProgressStatuses = ["pending", "scheduled", "assigned"];
  const allPreProgress = statuses.every((s) => preProgressStatuses.includes(s));
  if (allPreProgress) return "yellow";
  return "green";
}

function deriveBillingStatus(trip: any, payerRulesMap: Map<string, any>): { status: BillingStatus; issues: string[] } {
  if (!trip) return { status: null, issues: [] };
  const completedStatuses = ["completed", "ready_for_billing"];
  if (!completedStatuses.includes(trip.status)) return { status: "not_ready", issues: [] };

  const result = computeCleanTripStatus(
    trip,
    payerRulesMap.get(trip.payer_type ?? "") ?? null,
    { auth_required: trip.auth_required, auth_expiration: trip.auth_expiration }
  );

  if (result.level === "clean") return { status: "clean", issues: [] };
  if (result.level === "review") {
    if (result.issues.some(i => i.toLowerCase().includes("pcs"))) return { status: "missing_pcs", issues: result.issues };
    return { status: "missing_pcs", issues: result.issues };
  }
  if (result.issues.some(i => i.toLowerCase().includes("auth"))) return { status: "blocked_auth", issues: result.issues };
  return { status: "blocked_other", issues: result.issues };
}

export default function DispatchBoard() {
  const { selectedDate, setSelectedDate } = useSchedulingStore();
  
  const [trucks, setTrucks] = useState<TruckData[]>([]);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [operationalAlerts, setOperationalAlerts] = useState<OperationalAlert[]>([]);
  const [pendingCancellations, setPendingCancellations] = useState<PendingCancellation[]>([]);
  const [loading, setLoading] = useState(true);
  const [overriddenLegIds, setOverriddenLegIds] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);

  // Issue 8: Abort controller ref
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = async () => {
    // Cancel in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const [
      { data: truckRows },
      { data: slotRows },
      { data: alertRows },
      { data: availRows },
      { data: tripRows },
      { data: payerRules },
      { data: crewCapRows },
      { data: overrideRows },
      { data: holdTimerRows },
      { data: exceptionRows },
      { data: opAlertRows },
    ] = await Promise.all([
      supabase.from("trucks").select("*").eq("active", true).order("name"),
      supabase
        .from("truck_run_slots")
        .select("id, truck_id, leg_id, slot_order, status, leg:scheduling_legs!truck_run_slots_leg_id_fkey(id, pickup_time, trip_type, destination_location, is_oneoff, oneoff_name, oneoff_weight_lbs, oneoff_mobility, oneoff_oxygen, oneoff_notes, patient:patients!scheduling_legs_patient_id_fkey(first_name, last_name, weight_lbs, primary_payer, auth_required, auth_expiration, mobility, stairs_required, stair_chair_required, oxygen_required, oxygen_lpm, special_equipment_required, bariatric))")
        .eq("run_date", selectedDate)
        .order("slot_order"),
      supabase.from("alerts").select("*").eq("dismissed", false).order("created_at", { ascending: false }),
      supabase.from("truck_availability" as any).select("*").lte("start_date", selectedDate).gte("end_date", selectedDate),
      supabase.from("trip_records" as any).select("*").eq("run_date", selectedDate),
      supabase.from("payer_billing_rules" as any).select("*"),
      supabase.from("crews")
        .select("*, member1:profiles!crews_member1_id_fkey(id, full_name, sex, stair_chair_trained, bariatric_trained, oxygen_handling_trained, lift_assist_ok), member2:profiles!crews_member2_id_fkey(id, full_name, sex, stair_chair_trained, bariatric_trained, oxygen_handling_trained, lift_assist_ok), member3:profiles!crews_member3_id_fkey(id, full_name, sex, stair_chair_trained, bariatric_trained, oxygen_handling_trained, lift_assist_ok)")
        .eq("active_date", selectedDate),
      supabase.from("safety_overrides").select("leg_id").not("leg_id", "is", null),
      supabase.from("hold_timers").select("*").eq("is_active", true),
      supabase.from("leg_exceptions" as any).select("*").eq("run_date", selectedDate),
      supabase.from("operational_alerts").select("*").eq("run_date", selectedDate).eq("status", "open"),
    ]);

    // Issue 8: If aborted, bail out
    if (controller.signal.aborted) return;

    // Build exception map by scheduling_leg_id
    const exceptionMap = new Map<string, any>(
      ((exceptionRows ?? []) as any[]).map((e: any) => [e.scheduling_leg_id, e])
    );

    const overriddenIds = new Set<string>(
      ((overrideRows ?? []) as any[]).map((r: any) => r.leg_id).filter(Boolean)
    );
    setOverriddenLegIds(overriddenIds);

    const availMap = new Map<string, { status: string; reason: string | null }>(
      ((availRows ?? []) as any[]).map((a: any) => [a.truck_id, { status: a.status, reason: a.reason ?? null }])
    );

    const tripBySlot = new Map<string, any>();
    const tripByLeg = new Map<string, any>();
    ((tripRows ?? []) as any[]).forEach((t: any) => {
      if (t.slot_id) tripBySlot.set(t.slot_id, t);
      if (t.leg_id) tripByLeg.set(t.leg_id, t);
    });

    const prMap = new Map<string, any>();
    ((payerRules ?? []) as any[]).forEach((r: any) => prMap.set(r.payer_type, r));

    // Issue 1: Build operational alerts with truck/patient names
    const opAlertsEnriched: OperationalAlert[] = ((opAlertRows ?? []) as any[]).map((oa: any) => {
      const truck = (truckRows ?? []).find((t: any) => t.id === oa.truck_id);
      const slot = ((slotRows ?? []) as any[]).find((s: any) => s.leg_id === oa.leg_id && s.truck_id === oa.truck_id);
      const leg = slot?.leg as any;
      const patient = leg?.patient;
      const patientName = leg?.is_oneoff
        ? (leg?.oneoff_name ?? "One-Off")
        : (patient ? `${patient.first_name} ${patient.last_name}` : "Unknown");
      return {
        id: oa.id,
        truck_id: oa.truck_id,
        leg_id: oa.leg_id,
        note: oa.note,
        created_at: oa.created_at,
        status: oa.status,
        run_date: oa.run_date,
        truck_name: truck?.name ?? "Unknown Truck",
        patient_name: patientName,
        pickup_time: leg?.pickup_time ?? null,
        slot_order: slot ? (slot as any).slot_order : null,
      };
    });
    setOperationalAlerts(opAlertsEnriched);

    const truckData: TruckData[] = (truckRows ?? []).map((t: any) => {
      const crew = (crewCapRows as any[])?.find((c: any) => c.truck_id === t.id);
      const crewNames: string[] = [];
      if (crew) {
        if (crew.member1?.full_name) crewNames.push(crew.member1.full_name);
        if (crew.member2?.full_name) crewNames.push(crew.member2.full_name);
        if (crew.member3?.full_name) crewNames.push(crew.member3.full_name);
      }

      const crewCapability = {
        member1: crew?.member1 ? {
          sex: crew.member1.sex ?? null,
          stair_chair_trained: crew.member1.stair_chair_trained ?? false,
          bariatric_trained: crew.member1.bariatric_trained ?? false,
          oxygen_handling_trained: crew.member1.oxygen_handling_trained ?? false,
          lift_assist_ok: crew.member1.lift_assist_ok ?? false,
        } : null,
        member2: crew?.member2 ? {
          sex: crew.member2.sex ?? null,
          stair_chair_trained: crew.member2.stair_chair_trained ?? false,
          bariatric_trained: crew.member2.bariatric_trained ?? false,
          oxygen_handling_trained: crew.member2.oxygen_handling_trained ?? false,
          lift_assist_ok: crew.member2.lift_assist_ok ?? false,
        } : null,
      };
      const truckEquipment = {
        has_power_stretcher: t.has_power_stretcher ?? false,
        has_stair_chair: t.has_stair_chair ?? false,
        has_oxygen_mount: t.has_oxygen_mount ?? false,
      };

      const truckSlots = ((slotRows ?? []) as any[])
        .filter((s) => s.truck_id === t.id)
        .sort((a, b) => (a.slot_order ?? 0) - (b.slot_order ?? 0));

      const truckRuns = truckSlots.map((s) => {
        const leg = s.leg as any;
        const patient = leg?.patient;
        const isOneoff = leg?.is_oneoff ?? false;
        const patientName = isOneoff
          ? (leg?.oneoff_name ?? "One-Off")
          : (patient ? `${patient.first_name} ${patient.last_name}` : "Unknown");

        const tripRecord = tripBySlot.get(s.id) ?? tripByLeg.get(leg?.id);
        const billingData = deriveBillingStatus(
          tripRecord ? { ...tripRecord, auth_required: patient?.auth_required, auth_expiration: patient?.auth_expiration, payer_type: patient?.primary_payer } : null,
          prMap
        );

        const patientNeeds = isOneoff ? {
          weight_lbs: leg?.oneoff_weight_lbs ?? null,
          mobility: leg?.oneoff_mobility ?? null,
          stairs_required: null,
          stair_chair_required: null,
          oxygen_required: leg?.oneoff_oxygen ?? null,
          oxygen_lpm: null,
          special_equipment_required: null,
          bariatric: null,
        } : {
          weight_lbs: patient?.weight_lbs ?? null,
          mobility: patient?.mobility ?? null,
          stairs_required: patient?.stairs_required ?? null,
          stair_chair_required: patient?.stair_chair_required ?? null,
          oxygen_required: patient?.oxygen_required ?? null,
          oxygen_lpm: patient?.oxygen_lpm ?? null,
          special_equipment_required: patient?.special_equipment_required ?? null,
          bariatric: patient?.bariatric ?? null,
        };
        const safetyResult = evaluateSafetyRules(patientNeeds, crewCapability, truckEquipment);
        const needsCheck = hasCompletePatientNeeds(patientNeeds);

        const legException = exceptionMap.get(leg?.id);
        const effectivePickupTime = legException?.pickup_time ?? leg?.pickup_time ?? null;
        const effectiveDestination = legException?.destination_location ?? leg?.destination_location ?? null;

        return {
          id: s.id,
          patient_name: patientName,
          pickup_time: effectivePickupTime,
          status: (tripRecord?.status ?? s.status ?? "pending") as RunStatus,
          trip_type: leg?.trip_type ?? "dialysis",
          is_current: false,
          patient_weight: isOneoff ? (leg?.oneoff_weight_lbs ?? null) : (patient?.weight_lbs ?? null),
          billing_status: billingData.status,
          billing_issues: billingData.issues,
          hcpcs_codes: tripRecord?.hcpcs_codes ?? [],
          hcpcs_modifiers: tripRecord?.hcpcs_modifiers ?? [],
          loaded_miles: tripRecord?.loaded_miles ?? null,
          estimated_charge: null,
          patient_needs: patientNeeds,
          safety_status: safetyResult.status as SafetyStatus,
          safety_reasons: safetyResult.reasons,
          needs_missing: needsCheck.missing,
          is_oneoff: isOneoff,
          destination_name: effectiveDestination,
          leg_id: leg?.id ?? null,
          dispatch_time: tripRecord?.dispatch_time ?? null,
          arrived_pickup_at: tripRecord?.arrived_pickup_at ?? null,
          at_scene_time: tripRecord?.at_scene_time ?? null,
          patient_contact_time: tripRecord?.patient_contact_time ?? null,
          left_scene_time: tripRecord?.left_scene_time ?? null,
          arrived_dropoff_at: tripRecord?.arrived_dropoff_at ?? null,
          in_service_time: tripRecord?.in_service_time ?? null,
          pcr_status: tripRecord?.pcr_status ?? null,
        };
      });

      const doneStatuses = ["completed", "ready_for_billing", "cancelled", "no_show"];
      const currentIdx = truckRuns.findIndex((r) => !doneStatuses.includes(r.status));
      if (currentIdx >= 0) truckRuns[currentIdx].is_current = true;

      const avail = availMap.get(t.id);

      const medicareCount = truckRuns.filter(r => {
        const trip = truckSlots.find(s => s.id === r.id);
        const patient = (trip?.leg as any)?.patient;
        return patient?.primary_payer?.toLowerCase()?.includes("medicare");
      }).length;
      const facilityContractCount = truckRuns.filter(r => {
        const trip = truckSlots.find(s => s.id === r.id);
        const patient = (trip?.leg as any)?.patient;
        const payer = patient?.primary_payer?.toLowerCase() ?? "";
        return payer.includes("facility") || payer.includes("contract");
      }).length;
      const revenueStrength = computeRevenueStrength(truckRuns.length, medicareCount, facilityContractCount);

      return {
        id: t.id,
        name: t.name,
        crewNames,
        scheduledLegsCount: truckSlots.length,
        runs: truckRuns,
        overallStatus: computeOverallStatus(truckRuns),
        downStatus: (avail?.status as "down_maintenance" | "down_out_of_service" | null) ?? null,
        downReason: avail?.reason ?? null,
        revenueStrength,
        medicareCount,
        facilityContractCount,
      };
    });

    setTrucks(truckData);

    // Build alerts: standard alerts + hold timer alerts
    const standardAlerts: AlertData[] = (alertRows ?? []).map((a) => ({
      id: a.id,
      message: a.message,
      severity: a.severity as "yellow" | "red",
      created_at: a.created_at,
    }));

    const holdTimerAlerts: AlertData[] = ((holdTimerRows ?? []) as any[]).map((ht: any) => {
      const trip = ((tripRows ?? []) as any[]).find((t: any) => t.id === ht.trip_id);
      // Try slot_id from hold_timer first, then fall back to trip's leg/truck lookup
      const slot =
        ((slotRows ?? []) as any[]).find((s: any) => s.id === ht.slot_id) ??
        ((slotRows ?? []) as any[]).find((s: any) => s.leg_id === trip?.leg_id) ??
        ((slotRows ?? []) as any[]).find((s: any) => s.truck_id === trip?.truck_id && s.leg_id === trip?.leg_id);
      const leg = slot?.leg as any;
      const truck = (truckRows ?? []).find((t: any) => t.id === (trip?.truck_id ?? slot?.truck_id));
      const patient = leg?.patient;
      const patientName = leg?.is_oneoff
        ? (leg?.oneoff_name ?? "One-Off")
        : (patient ? `${patient.first_name} ${patient.last_name}` : "Unknown Patient");
      const truckName = truck?.name ?? "Unknown Truck";
      const holdLabel = (ht.hold_type === "wait_patient" || ht.hold_type === "patient_not_ready") ? "Patient Not Ready" : "Facility Delay";
      return {
        id: `hold-${ht.id}`,
        message: `${holdLabel} — ${truckName} · ${patientName}`,
        severity: (ht.current_level === "red" ? "red" : "yellow") as "yellow" | "red",
        created_at: ht.started_at,
        hold_timer_started_at: ht.started_at,
      };
    });

    setAlerts([...holdTimerAlerts, ...standardAlerts]);

    // Extract pending cancellation trips
    const pendingTrips = ((tripRows ?? []) as any[]).filter(
      (t: any) => t.status === "pending_cancellation"
    );
    const cancellations: PendingCancellation[] = pendingTrips.map((t: any) => {
      const truck = (truckRows ?? []).find((tr: any) => tr.id === t.truck_id);
      const slot = ((slotRows ?? []) as any[]).find((s: any) =>
        s.leg_id === t.leg_id && s.truck_id === t.truck_id
      );
      const leg = slot?.leg as any;
      const patient = leg?.patient;
      const patientName = patient
        ? `${patient.first_name} ${patient.last_name}`
        : "Unknown Patient";
      const crew = (crewCapRows as any[])?.find((c: any) => c.truck_id === t.truck_id);
      const crewMemberIds: string[] = [];
      if (crew?.member1?.id) crewMemberIds.push(crew.member1.id);
      if (crew?.member2?.id) crewMemberIds.push(crew.member2.id);
      let cancelledByName = "Crew";
      if (crew?.member1?.id === t.cancelled_by) cancelledByName = crew.member1.full_name;
      else if (crew?.member2?.id === t.cancelled_by) cancelledByName = crew.member2.full_name;

      return {
        tripId: t.id,
        patientName,
        cancellationReason: t.cancellation_reason ?? "",
        cancelledAt: t.cancelled_at ?? t.created_at,
        cancelledByName,
        truckName: truck?.name ?? "Unknown Truck",
        truckId: t.truck_id ?? "",
        legId: t.leg_id ?? null,
        slotId: t.slot_id ?? null,
        companyId: t.company_id ?? null,
        crewMemberIds,
      };
    });
    setPendingCancellations(cancellations);

    // Issue 10: Cleanup old dismissed alerts (background, non-blocking)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    supabase
      .from("alerts")
      .delete()
      .eq("dismissed", true)
      .lt("created_at", thirtyDaysAgo.toISOString())
      .then(() => {});

    setLoading(false);
  };

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;
  const debouncedFetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchDataRef.current(), 400);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData();

    const pollInterval = setInterval(() => {
      fetchDataRef.current();
    }, 30_000);

    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      const companyFilter = companyId ? `company_id=eq.${companyId}` : undefined;

      channel = supabase
        .channel(`dispatch-board-${selectedDate}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "trip_records", filter: companyFilter }, () => debouncedFetch())
        .on("postgres_changes", { event: "*", schema: "public", table: "truck_run_slots", filter: companyFilter }, () => debouncedFetch())
        .on("postgres_changes", { event: "*", schema: "public", table: "scheduling_legs", filter: companyFilter }, () => debouncedFetch())
        .on("postgres_changes", { event: "*", schema: "public", table: "alerts", filter: companyFilter }, () => debouncedFetch())
        .on("postgres_changes", { event: "*", schema: "public", table: "crews", filter: companyFilter }, () => debouncedFetch())
        // Issue 9: Scope truck_availability and safety_overrides to company
        .on("postgres_changes", { event: "*", schema: "public", table: "truck_availability", filter: companyFilter }, () => debouncedFetch())
        .on("postgres_changes", { event: "*", schema: "public", table: "operational_alerts", filter: companyFilter }, () => debouncedFetch())
        .on("postgres_changes", { event: "*", schema: "public", table: "hold_timers", filter: companyFilter }, () => debouncedFetch())
        .on("postgres_changes", { event: "*", schema: "public", table: "safety_overrides", filter: companyFilter }, () => debouncedFetch())
        .subscribe();
    })();

    return () => {
      clearInterval(pollInterval);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (channel) supabase.removeChannel(channel);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [selectedDate]);

  const dismissAlert = async (id: string) => {
    await supabase.from("alerts").update({ dismissed: true }).eq("id", id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  // Issue 1: Resolve operational alert
  const resolveOperationalAlert = async (id: string) => {
    const { error } = await supabase.from("operational_alerts").update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: "dispatcher",
    } as any).eq("id", id);
    if (error) {
      toast.error("Failed to resolve alert");
      return;
    }
    setOperationalAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  // Issue 7: Date navigation helpers
  const navigateDate = (offset: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split("T")[0]);
  };
  const goToToday = () => setSelectedDate(getLocalToday());

  const dateLabel = new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
  const isToday = selectedDate === getLocalToday();

  const [incidentOpen, setIncidentOpen] = useState(false);

  return (
    <AdminLayout>
      <IncidentReportForm open={incidentOpen} onClose={() => setIncidentOpen(false)} />
      {loading ? (
        <PageLoader label="Loading dispatch board…" />
      ) : (
        <div className="space-y-6">
          <TrialBanner />
          <OnboardingChecklist />

          {/* Issue 7: Date navigation */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateDate(-1)} title="Previous day">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Dispatch Board</p>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  {dateLabel}
                  {isToday && (
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      Today
                    </span>
                  )}
                </h2>
              </div>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateDate(1)} title="Next day">
                <ChevronRight className="h-4 w-4" />
              </Button>
              {!isToday && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={goToToday}>Today</Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setIncidentOpen(true)} className="text-xs">
                Report Incident
              </Button>
            </div>
          </div>

          {/* Pending Cancellations */}
          {pendingCancellations.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Pending Crew Cancellations · {pendingCancellations.length}
              </h3>
              <PendingCancellationPanel cancellations={pendingCancellations} onResolved={fetchData} />
            </section>
          )}

          {/* Issue 1: Operational Alerts */}
          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[hsl(var(--status-red))]">
              Patient Alerts · {operationalAlerts.filter(a => a.status === "open").length}
            </h3>
            <OperationalAlertsPanel alerts={operationalAlerts} onResolve={resolveOperationalAlert} />
          </section>

          {/* Alerts */}
          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Alerts
            </h3>
            <AlertsPanel alerts={alerts} onDismiss={dismissAlert} />
          </section>

          {/* Communications */}
          <CommunicationsSection selectedDate={selectedDate} trucks={trucks} />

          {/* Trucks */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Trucks
              </h3>
              {trucks.some(t => t.runs.length > 4) && (
                <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setAllExpanded(prev => !prev)}>
                  {allExpanded ? <Shrink className="h-3 w-3" /> : <Expand className="h-3 w-3" />}
                  {allExpanded ? "Collapse All" : "Expand All"}
                </Button>
              )}
            </div>
            {trucks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No trucks configured. Add trucks in the Trucks & Crews section.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {trucks.map((t) => (
                  <TruckCard
                    key={t.id}
                    truckName={t.name}
                    crewNames={t.crewNames}
                    scheduledLegsCount={t.scheduledLegsCount}
                    runs={t.runs}
                    overallStatus={t.overallStatus}
                    downStatus={t.downStatus}
                    downReason={t.downReason}
                    revenueStrength={t.revenueStrength}
                    medicareCount={t.medicareCount}
                    facilityContractCount={t.facilityContractCount}
                    readOnly
                    overriddenLegIds={overriddenLegIds}
                    forceExpanded={allExpanded}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </AdminLayout>
  );
}

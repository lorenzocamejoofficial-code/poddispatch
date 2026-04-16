import { useState, useCallback, useEffect, useRef } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { getLocalToday } from "@/lib/local-date";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressComboInput } from "@/components/scheduling/AddressComboInput";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Plus, Zap, AlertTriangle, ArrowRight,
  Wand2, ChevronLeft, ChevronRight, CalendarDays, ArrowLeft,
  GitBranch, GripVertical, AlertCircle, BellRing, X, Search, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { getEarliestBLegPickup, isBLegTooEarly } from "@/lib/dialysis-validation";
import { PCRTooltip } from "@/components/pcr/PCRTooltip";
import { ADMIN_TOOLTIPS } from "@/lib/admin-tooltips";
import { useAuth } from "@/hooks/useAuth";
import { TruckBuilder } from "@/components/scheduling/TruckBuilder";
import { DispatcherCancelDialog } from "@/components/scheduling/DispatcherCancelDialog";
import { RunPool } from "@/components/scheduling/RunPool";
import { TemplateControls } from "@/components/scheduling/TemplateControls";
import { UpcomingNonDialysisPanel } from "@/components/scheduling/UpcomingNonDialysisPanel";
import { NotifyCrewModal } from "@/components/scheduling/NotifyCrewModal";
import { OperationalAlertsPanel, type OperationalAlert } from "@/components/dispatch/OperationalAlertsPanel";
import { CommsOutbox } from "@/components/dispatch/CommsOutbox";
import { useSchedulingStore, type LegDisplay } from "@/hooks/useSchedulingStore";
import { RunReassignmentDialog } from "@/components/scheduling/RunReassignmentDialog";
import { detectTimeConflicts, type TimeConflict } from "@/lib/time-conflict";
import {
  DndContext,
  closestCenter,
  rectIntersection,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type CollisionDetection,
  DragOverlay,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";

// Custom collision: always check pool-droppable first so dragging from a
// truck back to the pool reliably registers even when sortable items are nearby
const poolFirstCollision: CollisionDetection = (args) => {
  const poolCollisions = rectIntersection({
    ...args,
    droppableContainers: args.droppableContainers.filter(c => c.id === "pool-droppable"),
  });
  if (poolCollisions.length > 0) return poolCollisions;
  return closestCenter(args);
};

function getWeekDates(refDate: string): string[] {
  const d = new Date(refDate + "T12:00:00");
  const day = d.getDay();
  const sun = new Date(d);
  sun.setDate(d.getDate() - day);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const curr = new Date(sun);
    curr.setDate(sun.getDate() + i);
    dates.push(curr.toISOString().split("T")[0]);
  }
  return dates;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface DaySummary {
  date: string;
  legCount: number;
  truckCount: number;
  assignedCount: number;
}

export default function Scheduling() {
  const { profileId } = useAuth();
  
  const {
    selectedDate, setSelectedDate,
    legs, patients, trucks, crews,
    legForm, setLegForm, resetLegForm,
    pendingLegType, setPendingLegType,
    dialogOpen, setDialogOpen,
    refresh, autoGenerateLegs, optimisticUpdateLegs,
  } = useSchedulingStore();

  // Dispatcher cancel dialog state
  const [dispatcherCancelData, setDispatcherCancelData] = useState<{
    legId: string; patientName: string; truckId: string; truckName: string; companyId: string | null; tripId: string | null;
  } | null>(null);

  const [generating, setGenerating] = useState(false);
  const [weekView, setWeekView] = useState(true);
  const [weekSummaries, setWeekSummaries] = useState<DaySummary[]>([]);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyTargetWeek, setCopyTargetWeek] = useState("");
  const [copying, setCopying] = useState(false);

  // Active share tokens for "Link active" indicators on truck cards
  const [activeShareTokens, setActiveShareTokens] = useState<{ truck_id: string; valid_from: string; valid_until: string }[]>([]);

  // Operational alerts (Patient Not Ready signals from crew)
  const [operationalAlerts, setOperationalAlerts] = useState<OperationalAlert[]>([]);

  // Schedule change notification tracking
  const [notifyBannerVisible, setNotifyBannerVisible] = useState(false);
  const [notifyModalOpen, setNotifyModalOpen] = useState(false);
  const legsSnapshotRef = useRef<string>("");

  // Track schedule changes by comparing leg assignments
  useEffect(() => {
    const currentSnapshot = legs
      .filter(l => l.assigned_truck_id)
      .map(l => `${l.id}:${l.assigned_truck_id}:${l.slot_order}:${l.slot_status}:${l.pickup_time}`)
      .sort()
      .join("|");

    if (legsSnapshotRef.current && legsSnapshotRef.current !== currentSnapshot) {
      setNotifyBannerVisible(true);
    }
    legsSnapshotRef.current = currentSnapshot;
  }, [legs]);

  // Helper: log a schedule change
  const logScheduleChange = useCallback(async (params: {
    change_type: string;
    change_summary: string;
    old_value?: string | null;
    new_value?: string | null;
    truck_id?: string | null;
    leg_id?: string | null;
  }) => {
    if (!profileId) return;
    const { data: companyId } = await supabase.rpc("get_my_company_id");
    await supabase.from("schedule_change_log").insert({
      company_id: companyId,
      truck_id: params.truck_id ?? null,
      leg_id: params.leg_id ?? null,
      change_type: params.change_type,
      change_summary: params.change_summary,
      old_value: params.old_value ?? null,
      new_value: params.new_value ?? null,
      changed_by: profileId,
    });
  }, [profileId]);

  const fetchOperationalAlerts = useCallback(async () => {
    const { data: alertRows } = await supabase
      .from("operational_alerts" as any)
      .select("*")
      .eq("run_date", selectedDate)
      .eq("alert_type", "PATIENT_NOT_READY")
      .order("created_at", { ascending: false });

    if (!alertRows) return;

    // Enrich with truck names and patient info
    const truckIds = [...new Set((alertRows as any[]).map((a: any) => a.truck_id))];
    const legIds = [...new Set((alertRows as any[]).map((a: any) => a.leg_id))];

    const [{ data: truckRows }, { data: legRows }, { data: slotRows }] = await Promise.all([
      truckIds.length > 0 ? supabase.from("trucks").select("id, name").in("id", truckIds) : Promise.resolve({ data: [] }),
      legIds.length > 0
        ? supabase.from("scheduling_legs")
            .select("id, pickup_time, patient:patients!scheduling_legs_patient_id_fkey(first_name, last_name)")
            .in("id", legIds)
        : Promise.resolve({ data: [] }),
      legIds.length > 0
        ? supabase.from("truck_run_slots").select("leg_id, slot_order, truck_id").eq("run_date", selectedDate).in("leg_id", legIds)
        : Promise.resolve({ data: [] }),
    ]);

    const truckMap = new Map((truckRows ?? []).map((t: any) => [t.id, t.name]));
    const legMap = new Map((legRows ?? []).map((l: any) => [l.id, l]));
    const slotMap = new Map((slotRows ?? []).map((s: any) => [s.leg_id, s]));

    // Build sorted slots per truck to find "next" pickup after each alert
    const truckSlots = new Map<string, { leg_id: string; slot_order: number; pickup_time?: string }[]>();
    for (const s of slotRows ?? []) {
      const arr = truckSlots.get((s as any).truck_id) ?? [];
      const leg = legMap.get((s as any).leg_id);
      arr.push({ leg_id: (s as any).leg_id, slot_order: (s as any).slot_order, pickup_time: (leg as any)?.pickup_time });
      truckSlots.set((s as any).truck_id, arr);
    }

    const enriched: OperationalAlert[] = (alertRows as any[]).map((a: any) => {
      const leg = legMap.get(a.leg_id) as any;
      const slot = slotMap.get(a.leg_id) as any;
      const truckSlotList = (truckSlots.get(a.truck_id) ?? []).sort((x, y) => x.slot_order - y.slot_order);
      const myIdx = truckSlotList.findIndex((s) => s.leg_id === a.leg_id);
      const nextSlot = myIdx >= 0 && myIdx < truckSlotList.length - 1 ? truckSlotList[myIdx + 1] : null;

      return {
        id: a.id,
        truck_id: a.truck_id,
        leg_id: a.leg_id,
        note: a.note,
        created_at: a.created_at,
        status: a.status,
        run_date: a.run_date,
        truck_name: truckMap.get(a.truck_id) ?? "Unknown Truck",
        patient_name: leg?.patient ? `${leg.patient.first_name} ${leg.patient.last_name}` : undefined,
        pickup_time: leg?.pickup_time ?? null,
        slot_order: slot?.slot_order ?? null,
        next_pickup_time: nextSlot?.pickup_time ?? null,
      };
    });

    setOperationalAlerts(enriched);
  }, [selectedDate]);

  useEffect(() => {
    supabase
      .from("crew_share_tokens")
      .select("truck_id, valid_from, valid_until")
      .eq("active", true)
      .then(({ data }) => setActiveShareTokens((data ?? []) as any[]));

    fetchOperationalAlerts();
  }, [selectedDate, fetchOperationalAlerts]);

  // Realtime subscription for operational alerts, crews, and slot updates
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      const companyFilter = companyId ? `company_id=eq.${companyId}` : undefined;

      channel = supabase
        .channel("scheduling-realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "operational_alerts", filter: companyFilter }, () => fetchOperationalAlerts())
        .on("postgres_changes", { event: "*", schema: "public", table: "crews", filter: companyFilter }, () => refresh())
        .on("postgres_changes", { event: "*", schema: "public", table: "truck_run_slots", filter: companyFilter }, () => refresh())
        .subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [fetchOperationalAlerts, refresh]);

  const resolveOperationalAlert = async (id: string) => {
    await supabase
      .from("operational_alerts" as any)
      .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: "dispatch" })
      .eq("id", id);
    toast.success("Alert resolved");
    setOperationalAlerts((prev) => prev.map((a) => a.id === id ? { ...a, status: "resolved" } : a));
  };

  // Drag state
  const [activeDragLeg, setActiveDragLeg] = useState<LegDisplay | null>(null);

  // Reassignment dialog state
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [reassignLeg, setReassignLeg] = useState<LegDisplay | null>(null);
  const [reassignSourceTruck, setReassignSourceTruck] = useState<string | null>(null);
  const [reassignTargetTruck, setReassignTargetTruck] = useState<string>("");

  // Exception editing state
  const [exceptionDialogOpen, setExceptionDialogOpen] = useState(false);
  const [editingExceptionLeg, setEditingExceptionLeg] = useState<LegDisplay | null>(null);
  const [exceptionForm, setExceptionForm] = useState({
    pickup_time: "", pickup_location: "", destination_location: "", notes: "",
  });
  const [exceptionNewDate, setExceptionNewDate] = useState("");
  const [savingException, setSavingException] = useState(false);

  // B-leg validation state
  const [bLegEarliest, setBLegEarliest] = useState<string | null>(null);
  const [bLegTooEarly, setBLegTooEarly] = useState(false);
  const [bLegOverrideOpen, setBLegOverrideOpen] = useState(false);
  const [bLegOverrideReason, setBLegOverrideReason] = useState("");
  const [bLegPendingSave, setBLegPendingSave] = useState<(() => Promise<void>) | null>(null);
  // B-leg validation for create dialog
  const [createBLegEarliest, setCreateBLegEarliest] = useState<string | null>(null);
  const [createBLegTooEarly, setCreateBLegTooEarly] = useState(false);

  const weekDates = getWeekDates(selectedDate);
  const today = getLocalToday();

  const fetchWeekSummaries = useCallback(async () => {
    const startDate = weekDates[0];
    const endDate = weekDates[6];

    const { data: companyId } = await supabase.rpc("get_my_company_id");
    const [{ data: legData }, { data: slotData }] = await Promise.all([
      supabase.from("scheduling_legs").select("id, run_date").eq("company_id", companyId).gte("run_date", startDate).lte("run_date", endDate),
      supabase.from("truck_run_slots").select("id, run_date, truck_id").eq("company_id", companyId).gte("run_date", startDate).lte("run_date", endDate),
    ]);

    const summaries: DaySummary[] = weekDates.map((date) => {
      const dayLegs = (legData ?? []).filter((l) => l.run_date === date);
      const daySlots = (slotData ?? []).filter((s) => s.run_date === date);
      const uniqueTrucks = new Set(daySlots.map((s) => s.truck_id));
      return { date, legCount: dayLegs.length, truckCount: trucks.length, assignedCount: uniqueTrucks.size };
    });

    setWeekSummaries(summaries);
  }, [weekDates[0], trucks.length]);

  useEffect(() => {
    if (weekView) fetchWeekSummaries();
  }, [weekView, fetchWeekSummaries]);

  const navigateWeek = (direction: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    // In day view, move by day; in week view, move by week
    d.setDate(d.getDate() + direction * (weekView ? 7 : 1));
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const goToToday = () => setSelectedDate(today);

  const openDay = (date: string) => {
    setSelectedDate(date);
    setWeekView(false);
  };

  // One-off form state
  const [isOneOff, setIsOneOff] = useState(false);
  const [oneoffForm, setOneoffForm] = useState({
    name: "", pickup_location: "", destination_location: "", trip_type: "dialysis",
    pickup_time: "", notes: "", service_level: "BLS",
    pickup_location_type: "", destination_type: "",
    needs_b_leg: false, b_leg_pickup_time: "", b_leg_duration_hours: "0", b_leg_duration_minutes: "0",
    // Demographics for PCR carry-over
    dob: "", sex: "", weight_lbs: "", mobility: "ambulatory", oxygen: false,
    primary_payer: "", member_id: "",
  });
  const resetOneoffForm = () => setOneoffForm({
    name: "", pickup_location: "", destination_location: "", trip_type: "dialysis",
    pickup_time: "", notes: "", service_level: "BLS",
    pickup_location_type: "", destination_type: "",
    needs_b_leg: false, b_leg_pickup_time: "", b_leg_duration_hours: "0", b_leg_duration_minutes: "0",
    dob: "", sex: "", weight_lbs: "", mobility: "ambulatory", oxygen: false,
    primary_payer: "", member_id: "",
  });

  const normalizeTripType = (tripType: string) => {
    if (tripType === "wound_care") return "woundcare";
    return tripType;
  };

  // Existing patient form extra state
  const [legPickupLocationType, setLegPickupLocationType] = useState("");
  const [legDestinationType, setLegDestinationType] = useState("");
  const [legNeedsBLeg, setLegNeedsBLeg] = useState(false);
  const [legBLegPickupTime, setLegBLegPickupTime] = useState("");
  const [legBLegDurationHours, setLegBLegDurationHours] = useState("0");
  const [legBLegDurationMinutes, setLegBLegDurationMinutes] = useState("0");

  // Copy from previous run
  const [copySearchOpen, setCopySearchOpen] = useState(false);
  const [copySearchQuery, setCopySearchQuery] = useState("");
  const [copySearchResults, setCopySearchResults] = useState<any[]>([]);
  const [copySearching, setCopySearching] = useState(false);
  // Same for one-off form
  const [oneoffCopySearchOpen, setOneoffCopySearchOpen] = useState(false);
  const [oneoffCopySearchQuery, setOneoffCopySearchQuery] = useState("");
  const [oneoffCopySearchResults, setOneoffCopySearchResults] = useState<any[]>([]);
  const [oneoffCopySearching, setOneoffCopySearching] = useState(false);

  const searchPreviousRuns = useCallback(async (query: string, target: "existing" | "oneoff") => {
    if (query.length < 2) {
      target === "existing" ? setCopySearchResults([]) : setOneoffCopySearchResults([]);
      return;
    }
    target === "existing" ? setCopySearching(true) : setOneoffCopySearching(true);
    try {
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      const { data } = await supabase
        .from("scheduling_legs")
        .select("id, run_date, leg_type, pickup_time, pickup_location, destination_location, trip_type, estimated_duration_minutes, notes, is_oneoff, oneoff_name, oneoff_weight_lbs, oneoff_mobility, oneoff_oxygen, oneoff_dob, oneoff_sex, oneoff_primary_payer, oneoff_member_id, patient:patients!scheduling_legs_patient_id_fkey(first_name, last_name)")
        .eq("company_id", companyId)
        .lt("run_date", selectedDate)
        .order("run_date", { ascending: false })
        .limit(100);

      const lowerQ = query.toLowerCase();
      const filtered = (data ?? []).filter((r: any) => {
        const name = r.is_oneoff
          ? (r.oneoff_name ?? "")
          : (r.patient ? `${r.patient.first_name} ${r.patient.last_name}` : "");
        return name.toLowerCase().includes(lowerQ);
      }).slice(0, 10);

      target === "existing" ? setCopySearchResults(filtered) : setOneoffCopySearchResults(filtered);
    } finally {
      target === "existing" ? setCopySearching(false) : setOneoffCopySearching(false);
    }
  }, [selectedDate]);

  const applyCopyResult = (result: any, target: "existing" | "oneoff") => {
    const normalizedTripType = normalizeTripType(result.trip_type ?? "dialysis");

    if (target === "oneoff") {
      setOneoffForm(f => ({
        ...f,
        name: result.is_oneoff ? (result.oneoff_name ?? "") : (result.patient ? `${result.patient.first_name} ${result.patient.last_name}` : ""),
        pickup_location: result.pickup_location ?? "",
        destination_location: result.destination_location ?? "",
        trip_type: normalizedTripType,
        pickup_time: result.pickup_time ?? "",
        notes: result.notes ?? "",
        weight_lbs: result.oneoff_weight_lbs != null ? String(result.oneoff_weight_lbs) : "",
        mobility: result.oneoff_mobility ?? "ambulatory",
        oxygen: result.oneoff_oxygen ?? false,
        dob: result.oneoff_dob ?? "",
        sex: result.oneoff_sex ?? "",
        primary_payer: result.oneoff_primary_payer ?? "",
        member_id: result.oneoff_member_id ?? "",
      }));
      setOneoffCopySearchOpen(false);
      setOneoffCopySearchQuery("");
    } else {
      setLegForm(f => ({
        ...f,
        pickup_location: result.pickup_location ?? "",
        destination_location: result.destination_location ?? "",
        trip_type: normalizedTripType,
        pickup_time: result.pickup_time ?? "",
        notes: result.notes ?? "",
        estimated_duration_minutes: result.estimated_duration_minutes?.toString() ?? "",
      }));
      setCopySearchOpen(false);
      setCopySearchQuery("");
    }
    toast.info("Fields pre-filled from previous run — review before saving");
  };

  const openCreateDialog = (type: "A" | "B") => {
    setPendingLegType(type);
    resetLegForm();
    resetOneoffForm();
    setIsOneOff(false);
    setLegPickupLocationType("");
    setLegDestinationType("");
    setLegNeedsBLeg(false);
    setLegBLegPickupTime("");
    setLegBLegDurationHours("0");
    setLegBLegDurationMinutes("0");
    setCopySearchOpen(false);
    setCopySearchQuery("");
    setCopySearchResults([]);
    setOneoffCopySearchOpen(false);
    setOneoffCopySearchQuery("");
    setOneoffCopySearchResults([]);
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    if (isOneOff) {
      if (!oneoffForm.name || !oneoffForm.pickup_location || !oneoffForm.destination_location) {
        toast.error("Name, pickup location, and destination are required");
        return;
      }
      const normalizedTripType = normalizeTripType(oneoffForm.trip_type);
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      const { error } = await supabase.from("scheduling_legs").insert({
        patient_id: null,
        leg_type: pendingLegType as any,
        pickup_time: oneoffForm.pickup_time || null,
        chair_time: null,
        pickup_location: oneoffForm.pickup_location,
        destination_location: oneoffForm.destination_location,
        trip_type: normalizedTripType as any,
        estimated_duration_minutes: null,
        notes: oneoffForm.notes || null,
        run_date: selectedDate,
        company_id: companyId,
        is_oneoff: true,
        oneoff_name: oneoffForm.name,
        oneoff_pickup_address: oneoffForm.pickup_location,
        oneoff_dropoff_address: oneoffForm.destination_location,
        oneoff_weight_lbs: oneoffForm.weight_lbs ? Number(oneoffForm.weight_lbs) : null,
        oneoff_mobility: oneoffForm.mobility || "ambulatory",
        oneoff_oxygen: oneoffForm.oxygen,
        oneoff_notes: oneoffForm.notes || null,
        oneoff_dob: oneoffForm.dob || null,
        oneoff_sex: oneoffForm.sex || null,
        oneoff_primary_payer: oneoffForm.primary_payer || null,
        oneoff_member_id: oneoffForm.member_id || null,
        origin_type: oneoffForm.pickup_location_type || null,
        destination_type: oneoffForm.destination_type || null,
        service_level: oneoffForm.service_level || "BLS",
      } as any);
      if (error) { console.error("Leg creation error:", error); toast.error(`Failed to create one-off leg: ${error.message}`); return; }

      if (oneoffForm.needs_b_leg) {
        const bDuration = (parseInt(oneoffForm.b_leg_duration_hours) || 0) * 60 + (parseInt(oneoffForm.b_leg_duration_minutes) || 0);
        await supabase.from("scheduling_legs").insert({
          patient_id: null,
          leg_type: "B" as any,
          pickup_time: oneoffForm.b_leg_pickup_time || null,
          chair_time: null,
          pickup_location: oneoffForm.destination_location,
          destination_location: oneoffForm.pickup_location,
          trip_type: normalizedTripType as any,
          estimated_duration_minutes: bDuration || null,
          notes: oneoffForm.notes || null,
          run_date: selectedDate,
          company_id: companyId,
          is_oneoff: true,
          oneoff_name: oneoffForm.name,
          oneoff_pickup_address: oneoffForm.destination_location,
          oneoff_dropoff_address: oneoffForm.pickup_location,
          oneoff_weight_lbs: oneoffForm.weight_lbs ? Number(oneoffForm.weight_lbs) : null,
          oneoff_mobility: oneoffForm.mobility || "ambulatory",
          oneoff_oxygen: oneoffForm.oxygen,
          oneoff_notes: oneoffForm.notes || null,
          oneoff_dob: oneoffForm.dob || null,
          oneoff_sex: oneoffForm.sex || null,
          oneoff_primary_payer: oneoffForm.primary_payer || null,
          oneoff_member_id: oneoffForm.member_id || null,
          origin_type: oneoffForm.destination_type || null,
          destination_type: oneoffForm.pickup_location_type || null,
          service_level: oneoffForm.service_level || "BLS",
        } as any);
      }

      toast.success(`One-off ${pendingLegType}-Leg created${oneoffForm.needs_b_leg ? " + B-leg" : ""}`);
      setDialogOpen(false);
      refresh();
      return;
    }

    if (!legForm.patient_id || !legForm.pickup_location || !legForm.destination_location) {
      toast.error("Patient, pickup location, and destination are required");
      return;
    }

    const patient = patients.find(p => p.id === legForm.patient_id);
    if (patient && patient.status !== "active") {
      toast.warning(`Warning: ${patient.name} is ${patient.status.replace("_", " ")}. Scheduling anyway.`);
    }

    const normalizedTripType = normalizeTripType(legForm.trip_type);
    const { data: companyId } = await supabase.rpc("get_my_company_id");

    const { error } = await supabase.from("scheduling_legs").insert({
      patient_id: legForm.patient_id,
      leg_type: pendingLegType as any,
      pickup_time: legForm.pickup_time || null,
      chair_time: legForm.chair_time || null,
      pickup_location: legForm.pickup_location,
      destination_location: legForm.destination_location,
      trip_type: normalizedTripType as any,
      estimated_duration_minutes: legForm.estimated_duration_minutes ? parseInt(legForm.estimated_duration_minutes) : null,
      notes: legForm.notes || null,
      run_date: selectedDate,
      company_id: companyId,
      origin_type: legPickupLocationType || null,
      destination_type: legDestinationType || null,
      service_level: legForm.service_level || "BLS",
    } as any);

    if (error) { console.error("Leg creation error:", error); toast.error(`Failed to create leg: ${error.message}`); return; }

    if (legNeedsBLeg) {
      const bDuration = (parseInt(legBLegDurationHours) || 0) * 60 + (parseInt(legBLegDurationMinutes) || 0);
      await supabase.from("scheduling_legs").insert({
        patient_id: legForm.patient_id,
        leg_type: "B" as any,
        pickup_time: legBLegPickupTime || null,
        chair_time: null,
        pickup_location: legForm.destination_location,
        destination_location: legForm.pickup_location,
        trip_type: normalizedTripType as any,
        estimated_duration_minutes: bDuration || null,
        notes: legForm.notes || null,
        run_date: selectedDate,
        company_id: companyId,
        origin_type: legDestinationType || null,
        destination_type: legPickupLocationType || null,
        service_level: legForm.service_level || "BLS",
      } as any);
    }

    const patientName = patient?.name ?? "Unknown";

    toast.success(`${pendingLegType}-Leg created${legNeedsBLeg ? " + B-leg" : ""}`);
    setDialogOpen(false);
    refresh();
  };

  const deleteLeg = async (id: string) => {
    await supabase.from("scheduling_legs").delete().eq("id", id);
    toast.success("Leg removed");
    refresh();
  };

  const handleAutoGenerate = async () => {
    setGenerating(true);
    try {
      const count = await autoGenerateLegs();
      if (count === 0) {
        toast.info("No new legs to generate. Either no patients match this day's recurrence, or legs already exist.");
      } else {
        toast.success(`Generated A & B legs for ${count} patient${count > 1 ? "s" : ""}`);
      }
    } finally {
      setGenerating(false);
    }
  };

  // ── B-leg validation helper ──
  const checkBLegTime = async (patientId: string | null, pickupTime: string | null): Promise<{ tooEarly: boolean; earliest: string | null }> => {
    if (!patientId || !pickupTime) return { tooEarly: false, earliest: null };
    const { data: patient } = await supabase
      .from("patients")
      .select("chair_time, chair_time_duration_hours, chair_time_duration_minutes")
      .eq("id", patientId)
      .maybeSingle();
    if (!patient) return { tooEarly: false, earliest: null };
    const durH = (patient as any).chair_time_duration_hours ?? 0;
    const durM = (patient as any).chair_time_duration_minutes ?? 0;
    if (durH === 0 && durM === 0) return { tooEarly: false, earliest: null };
    const earliest = getEarliestBLegPickup(patient.chair_time, durH, durM);
    const tooEarly = isBLegTooEarly(pickupTime, patient.chair_time, durH, durM);
    return { tooEarly, earliest };
  };

  // Open exception edit dialog
  const openExceptionEdit = (leg: LegDisplay) => {
    if (leg.slot_status === "completed") {
      toast.error("Cannot edit a completed run");
      return;
    }
    setEditingExceptionLeg(leg);
    setExceptionForm({
      pickup_time: leg.pickup_time ?? "",
      pickup_location: leg.pickup_location,
      destination_location: leg.destination_location,
      notes: leg.notes ?? "",
    });
    setExceptionNewDate("");
    setBLegEarliest(null);
    setBLegTooEarly(false);
    setExceptionDialogOpen(true);
  };

  // Check B-leg time when exception pickup_time changes
  const handleExceptionPickupTimeChange = async (time: string) => {
    setExceptionForm(f => ({ ...f, pickup_time: time }));
    if (editingExceptionLeg?.leg_type === "B" && editingExceptionLeg.patient_id) {
      const result = await checkBLegTime(editingExceptionLeg.patient_id, time);
      setBLegEarliest(result.earliest);
      setBLegTooEarly(result.tooEarly);
    }
  };

  const doSaveException = async () => {
    if (!editingExceptionLeg) return;
    setSavingException(true);
    try {
      // If date is being changed, move the leg to the new date
      if (exceptionNewDate && exceptionNewDate !== selectedDate) {
        // Update the scheduling_leg's run_date
        const { error: legErr } = await supabase
          .from("scheduling_legs")
          .update({ run_date: exceptionNewDate } as any)
          .eq("id", editingExceptionLeg.id);
        if (legErr) { toast.error("Failed to move run to new date"); return; }

        // Remove from current truck assignment (goes to pool on new date)
        if (editingExceptionLeg.assigned_truck_id) {
          await supabase.from("truck_run_slots").delete().eq("leg_id", editingExceptionLeg.id).eq("run_date", selectedDate);
        }

        // Clean up any exception for the old date
        await supabase
          .from("leg_exceptions" as any)
          .delete()
          .eq("scheduling_leg_id", editingExceptionLeg.id)
          .eq("run_date", selectedDate);

        await logScheduleChange({
          change_type: "run_date_changed",
          change_summary: `${editingExceptionLeg.patient_name} moved from ${selectedDate} to ${exceptionNewDate}`,
          old_value: selectedDate,
          new_value: exceptionNewDate,
          truck_id: editingExceptionLeg.assigned_truck_id ?? null,
          leg_id: editingExceptionLeg.id,
        });

        toast.success(`Run moved to ${exceptionNewDate} — it will appear in that day's run pool`);
        setExceptionDialogOpen(false);
        refresh();
        return;
      }

      const payload: any = {
        scheduling_leg_id: editingExceptionLeg.id,
        run_date: selectedDate,
        pickup_time: exceptionForm.pickup_time || null,
        pickup_location: exceptionForm.pickup_location || null,
        destination_location: exceptionForm.destination_location || null,
        notes: exceptionForm.notes || null,
      };
      const { error } = await supabase
        .from("leg_exceptions" as any)
        .upsert(payload, { onConflict: "scheduling_leg_id,run_date" });

      if (error) { toast.error("Failed to save exception"); return; }

      // Log time change
      if (exceptionForm.pickup_time && exceptionForm.pickup_time !== (editingExceptionLeg.pickup_time ?? "")) {
        await logScheduleChange({
          change_type: "time_changed",
          change_summary: `Pickup time changed from ${editingExceptionLeg.pickup_time ?? "none"} to ${exceptionForm.pickup_time} for ${editingExceptionLeg.patient_name}`,
          old_value: editingExceptionLeg.pickup_time ?? null,
          new_value: exceptionForm.pickup_time,
          truck_id: editingExceptionLeg.assigned_truck_id ?? null,
          leg_id: editingExceptionLeg.id,
        });
      }
      // Log location change
      if (exceptionForm.pickup_location !== editingExceptionLeg.pickup_location || exceptionForm.destination_location !== editingExceptionLeg.destination_location) {
        await logScheduleChange({
          change_type: "location_changed",
          change_summary: `Pickup location updated for ${editingExceptionLeg.patient_name}`,
          truck_id: editingExceptionLeg.assigned_truck_id ?? null,
          leg_id: editingExceptionLeg.id,
        });
      }

      toast.success("Run exception saved for this date only");
      setExceptionDialogOpen(false);
      refresh();
    } finally {
      setSavingException(false);
    }
  };

  const handleSaveException = async () => {
    // If B-leg and too early, require override
    if (editingExceptionLeg?.leg_type === "B" && bLegTooEarly && exceptionForm.pickup_time) {
      setBLegOverrideReason("");
      setBLegPendingSave(() => async () => {
        // Save the exception first
        await doSaveException();
        // Then log the override
        const { data: companyId } = await supabase.rpc("get_my_company_id");
        await supabase.from("billing_overrides").insert({
          trip_id: editingExceptionLeg!.id, // leg_id as reference
          override_reason: `Dispatcher overrode B-leg early pickup: ${bLegOverrideReason}`,
          is_active: false,
          snapshot: {
            action: "b_leg_early_override",
            patient_id: editingExceptionLeg!.patient_id,
            chair_time: null,
            b_leg_pickup_time: exceptionForm.pickup_time,
            override_reason: bLegOverrideReason,
          },
        } as any);
        await supabase.from("audit_logs").insert({
          action: "b_leg_time_override",
          actor_user_id: (await supabase.auth.getUser()).data.user?.id,
          table_name: "scheduling_legs",
          record_id: editingExceptionLeg!.id,
          notes: `B-leg pickup time ${exceptionForm.pickup_time} is before treatment end. Override reason: ${bLegOverrideReason}`,
          company_id: companyId,
        });
      });
      setBLegOverrideOpen(true);
      return;
    }
    await doSaveException();
  };

  const handleDeleteException = async () => {
    if (!editingExceptionLeg) return;
    await supabase
      .from("leg_exceptions" as any)
      .delete()
      .eq("scheduling_leg_id", editingExceptionLeg.id)
      .eq("run_date", selectedDate);
    toast.success("Exception removed — restored to series defaults");
    setExceptionDialogOpen(false);
    refresh();
  };

  const handleCopyWeek = async () => {
    if (!copyTargetWeek) { toast.error("Select a target week start date"); return; }
    setCopying(true);
    try {
      const targetWeekDates = getWeekDates(copyTargetWeek);
      const { data: srcCrews } = await supabase
        .from("crews").select("truck_id, member1_id, member2_id, active_date")
        .gte("active_date", weekDates[0]).lte("active_date", weekDates[6]);
      const { data: existingCrews } = await supabase
        .from("crews").select("active_date, truck_id")
        .gte("active_date", targetWeekDates[0]).lte("active_date", targetWeekDates[6]);
      const existingKeys = new Set((existingCrews ?? []).map((c) => `${c.active_date}_${c.truck_id}`));
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      const newCrews: any[] = [];
      for (const crew of srcCrews ?? []) {
        const srcDayIdx = weekDates.indexOf(crew.active_date);
        if (srcDayIdx === -1) continue;
        const targetDate = targetWeekDates[srcDayIdx];
        const key = `${targetDate}_${crew.truck_id}`;
        if (existingKeys.has(key)) continue;
        newCrews.push({ truck_id: crew.truck_id, member1_id: crew.member1_id, member2_id: crew.member2_id, active_date: targetDate, company_id: companyId });
      }
      if (newCrews.length > 0) await supabase.from("crews").insert(newCrews);
      toast.success(`Copied ${newCrews.length} crew assignment(s). Use "Auto-Fill" on each day to generate runs.`);
      setCopyDialogOpen(false);
      setCopyTargetWeek("");
    } catch { toast.error("Failed to copy week"); }
    finally { setCopying(false); }
  };

  const nextWeekStart = (() => {
    const d = new Date(weekDates[6] + "T12:00:00");
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  })();

  const unassignedLegs = legs.filter(l => !l.assigned_truck_id);

  // ── DnD sensors — 8px activation distance for fast response ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { data } = event.active;
    const leg = data.current?.leg as LegDisplay | undefined;
    const resolved = leg ?? legs.find(l => l.id === event.active.id);
    if (resolved) setActiveDragLeg(resolved);
  };

  // Master drag-end handler: optimistic UI first, DB write in background
  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragLeg(null);
    const { active, over } = event;
    if (!over) return;

    const sourceData = active.data.current as any;
    const targetData = over.data.current as any;

    const activeLeg: LegDisplay | undefined =
      sourceData?.leg ?? legs.find(l => l.id === active.id);
    if (!activeLeg) return;

    // Block dragging completed runs
    if (activeLeg.slot_status === "completed") {
      toast.error("Cannot move a completed run");
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // ── Case 1: Drop on pool drop zone (unassign) ──
    if (overId === "pool-droppable") {
      if (!activeLeg.assigned_truck_id) return;

      // Optimistic update
      optimisticUpdateLegs(prev =>
        prev.map(l => l.id === activeId ? { ...l, assigned_truck_id: null, slot_order: null } : l)
      );
      toast.success("Run returned to pool");

      const { error } = await supabase
        .from("truck_run_slots")
        .delete()
        .eq("leg_id", activeId)
        .eq("run_date", selectedDate);
      if (error) {
        toast.error("Assignment failed — reverting");
        refresh();
      }
      return;
    }

    // ── Case 2: Drop on a truck zone or within a truck ──
    const targetTruckId: string | undefined =
      targetData?.type === "truck-zone" ? targetData.truckId :
      targetData?.type === "assigned-leg" ? targetData.leg?.assigned_truck_id :
      legs.find(l => l.id === overId)?.assigned_truck_id;

    if (!targetTruckId) return;

    const currentTruckId = activeLeg.assigned_truck_id;

    if (currentTruckId === targetTruckId) {
      // ── Reorder within same truck ──
      const tLegs = legs
        .filter(l => l.assigned_truck_id === targetTruckId)
        .sort((a, b) => {
          if (a.slot_order != null && b.slot_order != null) return a.slot_order - b.slot_order;
          if (a.slot_order != null) return -1;
          if (b.slot_order != null) return 1;
          return (a.pickup_time ?? "").localeCompare(b.pickup_time ?? "");
        });
      const oldIdx = tLegs.findIndex(l => l.id === activeId);
      const newIdx = tLegs.findIndex(l => l.id === overId);
      if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;
      const reordered = arrayMove(tLegs, oldIdx, newIdx);

      // Optimistic reorder
      optimisticUpdateLegs(prev => {
        const reorderMap = new Map(reordered.map((l, idx) => [l.id, idx]));
        return prev.map(l =>
          reorderMap.has(l.id) ? { ...l, slot_order: reorderMap.get(l.id)! } : l
        );
      });

      // DB write (fire and forget, realtime will reconcile if needed)
      await Promise.all(
        reordered.map((leg, idx) =>
          supabase.from("truck_run_slots")
            .update({ slot_order: idx } as any)
            .eq("leg_id", leg.id)
            .eq("run_date", selectedDate)
            .eq("truck_id", targetTruckId)
        )
      );
      return;
    }

    // ── Move to different truck (or assign from pool) ──
    const targetLegs = legs.filter(l => l.assigned_truck_id === targetTruckId);
    if (targetLegs.length >= 10) { toast.error("Truck is full (10 run slots max)"); return; }

    const truckName = trucks.find(t => t.id === targetTruckId)?.name ?? "truck";

    // Issue #6: Check if target truck is marked as down
    const { data: downRows } = await supabase
      .from("truck_availability" as any)
      .select("status, reason")
      .eq("truck_id", targetTruckId)
      .lte("start_date", selectedDate)
      .gte("end_date", selectedDate)
      .limit(1);
    const downRecord = ((downRows ?? []) as any[])[0];
    if (downRecord && (downRecord.status === "down_maintenance" || downRecord.status === "down_out_of_service")) {
      toast.error(`Cannot assign to ${truckName} — truck is DOWN${downRecord.reason ? `: ${downRecord.reason}` : ""}`);
      return;
    }

    // If moving from one truck to another, open the reassignment dialog
    if (currentTruckId) {
      setReassignLeg(activeLeg);
      setReassignSourceTruck(currentTruckId);
      setReassignTargetTruck(targetTruckId);
      setReassignDialogOpen(true);
      return;
    }

    // Assign from pool (no dialog needed)
    optimisticUpdateLegs(prev =>
      prev.map(l => l.id === activeId
        ? { ...l, assigned_truck_id: targetTruckId, slot_order: targetLegs.length }
        : l
      )
    );

    toast.success(`Run assigned to ${truckName}`);
    const { data: companyId } = await supabase.rpc("get_my_company_id");
    const { error } = await supabase.from("truck_run_slots").insert({
      truck_id: targetTruckId,
      leg_id: activeId,
      run_date: selectedDate,
      slot_order: targetLegs.length,
      company_id: companyId,
    } as any);
    if (error) {
      if (error.code === "23505") {
        toast.error("This leg is already assigned to a truck");
      } else {
        console.error("Assignment error:", error);
        toast.error(`Assignment failed: ${error.message}`);
      }
      refresh();
    }
  };

  // ── Daily Ops Snapshot metrics ──
  const OVERLOAD_THRESHOLD = 8; // configurable
  const activeTrucks = trucks.filter(t => legs.some(l => l.assigned_truck_id === t.id));
  const totalRuns = legs.length;
  const unassignedCount = unassignedLegs.length;
  const truckRunCounts = trucks.map(t => legs.filter(l => l.assigned_truck_id === t.id).length);
  const avgRunsPerTruck = activeTrucks.length > 0
    ? (truckRunCounts.reduce((s, c) => s + c, 0) / trucks.length).toFixed(1)
    : "0.0";
  const zeroRunTrucks = trucks.filter(t => !legs.some(l => l.assigned_truck_id === t.id)).length;
  const overloadedTrucks = trucks.filter(t => legs.filter(l => l.assigned_truck_id === t.id).length > OVERLOAD_THRESHOLD).length;
  // Down trucks and crew missing are computed from availability/crews loaded by TruckBuilder — we track them via a callback
  const [downTruckCount, setDownTruckCount] = useState(0);
  const crewMissingTrucks = trucks.filter(t => !crews.some(c => c.truck_id === t.id)).length;

  const weekLabel = (() => {
    const start = new Date(weekDates[0] + "T12:00:00");
    const end = new Date(weekDates[6] + "T12:00:00");
    const mo = start.toLocaleString("default", { month: "short" });
    const mo2 = end.toLocaleString("default", { month: "short" });
    if (mo === mo2) return `${mo} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
    return `${mo} ${start.getDate()} – ${mo2} ${end.getDate()}, ${end.getFullYear()}`;
  })();

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Week navigation header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {!weekView && (
              <Button variant="ghost" size="icon" onClick={() => setWeekView(true)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <Button variant="outline" size="icon" onClick={() => navigateWeek(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              <CalendarDays className="mr-1.5 h-3.5 w-3.5" /> Today
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigateWeek(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold text-foreground">
              {weekView
                ? weekLabel
                : new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </span>
          </div>

          {weekView ? (
            <Button variant="outline" size="sm" onClick={() => { setCopyTargetWeek(nextWeekStart); setCopyDialogOpen(true); }}>
              Copy Crew Assignments Forward
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleAutoGenerate} disabled={generating}>
                <Wand2 className="mr-1.5 h-4 w-4" /> {generating ? "Generating..." : "Auto-Fill from Templates"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => openCreateDialog("A")}>
                <Plus className="mr-1.5 h-4 w-4" /> A Leg
              </Button>
              <Button variant="outline" size="sm" onClick={() => openCreateDialog("B")}>
                <Plus className="mr-1.5 h-4 w-4" /> B Leg
              </Button>
            </div>
          )}
        </div>

        {/* WEEKLY VIEW */}
        {weekView ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {weekDates.map((date, idx) => {
                const summary = weekSummaries.find((s) => s.date === date);
                const isToday = date === today;
                const isSelected = date === selectedDate;
                return (
                  <button
                    key={date}
                    onClick={() => openDay(date)}
                    className={`rounded-lg border p-3 text-left transition-colors hover:border-primary/50 ${
                      isToday ? "border-primary bg-primary/5" : isSelected ? "border-primary/30" : "bg-card"
                    }`}
                  >
                    <div className="text-xs font-semibold uppercase text-muted-foreground">{DAY_LABELS[idx]}</div>
                    <div className={`text-lg font-bold ${isToday ? "text-primary" : "text-card-foreground"}`}>{formatShortDate(date)}</div>
                    {summary && (
                      <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                        <div>{summary.legCount} leg{summary.legCount !== 1 ? "s" : ""}</div>
                        <div>{summary.assignedCount}/{summary.truckCount} trucks active</div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Upcoming Non-Dialysis Alerts Panel ── */}
            <UpcomingNonDialysisPanel onGoToDay={openDay} />
          </div>
        ) : (
          /* DAILY DRILL-DOWN VIEW */
          <DndContext
            sensors={sensors}
            collisionDetection={poolFirstCollision}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {/* ── SCHEDULE CHANGE NOTIFY BANNER ── */}
            {notifyBannerVisible && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 sm:px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mb-2">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <BellRing className="h-4 w-4 shrink-0" />
                  Schedule has been updated
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="default" className="h-7 text-xs gap-1.5" onClick={() => setNotifyModalOpen(true)}>
                    <BellRing className="h-3 w-3" /> Preview & Notify Crew
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setNotifyBannerVisible(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
            {/* ── DAILY OPS SNAPSHOT ── */}
            <section className="rounded-lg border bg-card p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Daily Ops Snapshot</span>
                <span className="text-[10px] text-muted-foreground/70">
                  {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs">
                  <span className="text-muted-foreground">Active trucks</span>
                  <span className="font-bold text-foreground">{activeTrucks.length}/{trucks.length}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs">
                  <span className="text-muted-foreground">Total runs</span>
                  <span className="font-bold text-foreground">{totalRuns}</span>
                </div>
                <div className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${unassignedCount > 0 ? "border-[hsl(var(--status-yellow))]/40 bg-[hsl(var(--status-yellow-bg))]" : "bg-background"}`}>
                  <span className="text-muted-foreground">Unassigned</span>
                  <span className={`font-bold ${unassignedCount > 0 ? "text-[hsl(var(--status-yellow))]" : "text-foreground"}`}>{unassignedCount}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs">
                  <span className="text-muted-foreground">Avg/truck</span>
                  <span className="font-bold text-foreground">{avgRunsPerTruck}</span>
                </div>
                <div className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${zeroRunTrucks > 0 ? "border-[hsl(var(--status-red))]/30 bg-[hsl(var(--status-red))]/5" : "bg-background"}`}>
                  <span className="text-muted-foreground">Empty trucks</span>
                  <span className={`font-bold ${zeroRunTrucks > 0 ? "text-[hsl(var(--status-red))]" : "text-foreground"}`}>{zeroRunTrucks}</span>
                </div>
                <div className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${overloadedTrucks > 0 ? "border-[hsl(var(--status-yellow))]/40 bg-[hsl(var(--status-yellow-bg))]" : "bg-background"}`}>
                  <span className="text-muted-foreground">Overloaded (&gt;{OVERLOAD_THRESHOLD})</span>
                  <span className={`font-bold ${overloadedTrucks > 0 ? "text-[hsl(var(--status-yellow))]" : "text-foreground"}`}>{overloadedTrucks}</span>
                </div>
                <div className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${downTruckCount > 0 ? "border-destructive/40 bg-destructive/5" : "bg-background"}`}>
                  <span className="text-muted-foreground">DOWN trucks</span>
                  <span className={`font-bold ${downTruckCount > 0 ? "text-destructive" : "text-foreground"}`}>{downTruckCount}</span>
                </div>
                <div className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${crewMissingTrucks > 0 ? "border-[hsl(var(--status-yellow))]/40 bg-[hsl(var(--status-yellow-bg))]" : "bg-background"}`}>
                  <span className="text-muted-foreground">No crew</span>
                  <span className={`font-bold ${crewMissingTrucks > 0 ? "text-[hsl(var(--status-yellow))]" : "text-foreground"}`}>{crewMissingTrucks}</span>
                </div>
              </div>
            </section>

            {/* ── PATIENT NOT READY ALERTS ── */}
            {(() => {
              const openAlerts = operationalAlerts.filter((a) => a.status === "open");
              return (
                <>
                  <section>
                    <div className="mb-2 flex items-center gap-2">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Patient Not Ready Alerts
                      </h3>
                      {openAlerts.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--status-red))]/15 px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--status-red))]">
                          <AlertCircle className="h-3 w-3" />
                          {openAlerts.length} open
                        </span>
                      )}
                    </div>
                    <OperationalAlertsPanel
                      alerts={operationalAlerts}
                      onResolve={resolveOperationalAlert}
                    />
                  </section>
                  <CommsOutbox selectedDate={selectedDate} />
                </>
              );
            })()}

            {/* ── RUN POOL (scalable, collapsible, grouped) ── */}
            <RunPool
              unassigned={unassignedLegs}
              onDelete={deleteLeg}
              onEditException={openExceptionEdit}
            />

            {/* ── TRUCK BUILDER ── */}
            <TruckBuilder
              trucks={trucks}
              legs={legs}
              crews={crews}
              selectedDate={selectedDate}
              onRefresh={refresh}
              onEditException={openExceptionEdit}
              onDownCountChange={setDownTruckCount}
              activeTokens={activeShareTokens}
              operationalAlerts={operationalAlerts}
              onLogChange={logScheduleChange}
              onDispatcherCancel={async (legId: string) => {
                const leg = legs.find(l => l.id === legId);
                if (!leg) return;
                const truckId = leg.assigned_truck_id ?? "";
                const truckName = trucks.find(t => t.id === truckId)?.name ?? "Unknown";
                const { data: companyId } = await supabase.rpc("get_my_company_id");
                // Look up existing trip_id for this leg + date
                const { data: tripRow } = await supabase
                  .from("trip_records" as any)
                  .select("id")
                  .eq("leg_id", legId)
                  .eq("run_date", selectedDate)
                  .maybeSingle();
                setDispatcherCancelData({
                  legId,
                  patientName: leg.patient_name,
                  truckId,
                  truckName,
                  companyId,
                  tripId: (tripRow as any)?.id ?? null,
                });
              }}
            />

            {/* ── TEMPLATE CONTROLS (bottom of truck builder area) ── */}
            <TemplateControls
              selectedDate={selectedDate}
              trucks={trucks}
              legs={legs}
              onRefresh={refresh}
            />

            {/* Drag overlay — compact ghost card shown while dragging */}
            <DragOverlay dropAnimation={null}>
              {activeDragLeg && (
                <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-xl ring-1 ring-primary/40 pointer-events-none w-56">
                  <div className="flex items-center gap-1.5">
                    <GripVertical className="h-3 w-3 text-muted-foreground" />
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold shrink-0 ${
                      activeDragLeg.leg_type === "A" ? "bg-primary/10 text-primary" : "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]"
                    }`}>{activeDragLeg.leg_type}</span>
                    <span className="font-medium text-card-foreground truncate">{activeDragLeg.patient_name}</span>
                    {activeDragLeg.pickup_time && <span className="text-muted-foreground shrink-0">{activeDragLeg.pickup_time}</span>}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className="truncate">{activeDragLeg.pickup_location}</span>
                    <ArrowRight className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{activeDragLeg.destination_location}</span>
                  </div>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}

        {/* Run Reassignment Dialog */}
        <RunReassignmentDialog
          open={reassignDialogOpen}
          onOpenChange={setReassignDialogOpen}
          leg={reassignLeg}
          sourceTruckId={reassignSourceTruck}
          targetTruckId={reassignTargetTruck}
          targetTruckName={trucks.find(t => t.id === reassignTargetTruck)?.name ?? "truck"}
          targetTruckLegs={legs.filter(l => l.assigned_truck_id === reassignTargetTruck)}
          selectedDate={selectedDate}
          onComplete={refresh}
          onLogChange={logScheduleChange}
        />

        {/* Create Leg Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>Create {pendingLegType}-Leg</DialogTitle>
              <DialogDescription>
                Schedule a {pendingLegType === "A" ? "pickup" : "return"} transport leg for {selectedDate}.
              </DialogDescription>
            </DialogHeader>

            {/* Toggle: Existing Patient vs One-Off */}
            <div className="flex rounded-md border overflow-hidden text-xs font-medium mb-1">
              <button
                className={`flex-1 px-3 py-2 transition-colors ${!isOneOff ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
                onClick={() => setIsOneOff(false)}
              >
                Existing Patient
              </button>
              <button
                className={`flex-1 px-3 py-2 transition-colors ${isOneOff ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
                onClick={() => setIsOneOff(true)}
              >
                One-Off Run
              </button>
            </div>

            {isOneOff ? (
              /* ── ONE-OFF FORM ── */
              <div className="grid gap-3 py-2">
                {/* Copy from previous run */}
                <Collapsible open={oneoffCopySearchOpen} onOpenChange={setOneoffCopySearchOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 text-xs text-primary hover:underline w-full">
                    <Search className="h-3 w-3" />
                    Copy from a previous run
                    <ChevronDown className={`h-3 w-3 ml-auto transition-transform ${oneoffCopySearchOpen ? "rotate-180" : ""}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <Input
                      placeholder="Search by patient name..."
                      value={oneoffCopySearchQuery}
                      onChange={(e) => { setOneoffCopySearchQuery(e.target.value); searchPreviousRuns(e.target.value, "oneoff"); }}
                      className="h-8 text-xs"
                    />
                    {oneoffCopySearching && <p className="text-[10px] text-muted-foreground mt-1">Searching...</p>}
                    {oneoffCopySearchResults.length > 0 && (
                      <div className="mt-1 max-h-32 overflow-y-auto rounded border divide-y">
                        {oneoffCopySearchResults.map((r: any) => (
                          <button key={r.id} className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted/50 transition-colors" onClick={() => applyCopyResult(r, "oneoff")}>
                            <span className="font-medium">{r.is_oneoff ? r.oneoff_name : `${r.patient?.first_name} ${r.patient?.last_name}`}</span>
                            <span className="text-muted-foreground ml-2">{r.trip_type} · {r.pickup_location} · {r.run_date}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>

                <div className="rounded-md border border-[hsl(var(--status-yellow))]/40 bg-[hsl(var(--status-yellow-bg))] px-3 py-2 text-xs text-[hsl(var(--status-yellow))]">
                  This run will NOT create a permanent patient record. It's for same-day dispatch only.
                </div>
                <div><Label>Patient Name *<PCRTooltip text={ADMIN_TOOLTIPS.one_off_name} /></Label><Input value={oneoffForm.name} onChange={(e) => setOneoffForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. John Smith" /></div>
                <div>
                  <Label>Transport Type<PCRTooltip text={ADMIN_TOOLTIPS.trip_type} /></Label>
                  <Select value={oneoffForm.trip_type} onValueChange={(v) => setOneoffForm(f => ({ ...f, trip_type: v, service_level: (v === "ift" || v === "ift_discharge") ? "ALS1" : "BLS" }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dialysis">Dialysis</SelectItem>
                      <SelectItem value="ift">IFT</SelectItem>
                      <SelectItem value="discharge">Discharge</SelectItem>
                      <SelectItem value="outpatient">Outpatient</SelectItem>
                      <SelectItem value="woundcare">Wound Care</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                      <SelectItem value="private_pay">Private Pay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Service Level</Label>
                  <Select value={oneoffForm.service_level} onValueChange={(v) => setOneoffForm(f => ({ ...f, service_level: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BLS">BLS</SelectItem>
                      <SelectItem value="ALS1">ALS1</SelectItem>
                      <SelectItem value="ALS2">ALS2</SelectItem>
                      <SelectItem value="bariatric">Bariatric</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Pickup Location Type</Label>
                    <Select value={oneoffForm.pickup_location_type || "none"} onValueChange={(v) => setOneoffForm(f => ({ ...f, pickup_location_type: v === "none" ? "" : v }))}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Select —</SelectItem>
                        <SelectItem value="Residence">Residence</SelectItem>
                        <SelectItem value="Dialysis Facility">Dialysis Facility</SelectItem>
                        <SelectItem value="Hospital">Hospital</SelectItem>
                        <SelectItem value="SNF">SNF</SelectItem>
                        <SelectItem value="Assisted Living">Assisted Living</SelectItem>
                        <SelectItem value="Outpatient Specialty">Outpatient Specialty</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Destination Type</Label>
                    <Select value={oneoffForm.destination_type || "none"} onValueChange={(v) => setOneoffForm(f => ({ ...f, destination_type: v === "none" ? "" : v }))}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Select —</SelectItem>
                        <SelectItem value="Residence">Residence</SelectItem>
                        <SelectItem value="Dialysis Facility">Dialysis Facility</SelectItem>
                        <SelectItem value="Hospital">Hospital</SelectItem>
                        <SelectItem value="SNF">SNF</SelectItem>
                        <SelectItem value="Assisted Living">Assisted Living</SelectItem>
                        <SelectItem value="Outpatient Specialty">Outpatient Specialty</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Pickup Address *<PCRTooltip text={ADMIN_TOOLTIPS.one_off_pickup} /></Label><Input value={oneoffForm.pickup_location} onChange={(e) => setOneoffForm(f => ({ ...f, pickup_location: e.target.value }))} placeholder="123 Main St, Atlanta GA" /></div>
                <div><Label>Destination Address *<PCRTooltip text={ADMIN_TOOLTIPS.one_off_dropoff} /></Label><Input value={oneoffForm.destination_location} onChange={(e) => setOneoffForm(f => ({ ...f, destination_location: e.target.value }))} placeholder="Facility name or address" /></div>
                <div><Label>Pickup Time<PCRTooltip text={ADMIN_TOOLTIPS.pickup_time} /></Label><Input type="time" value={oneoffForm.pickup_time} onChange={(e) => setOneoffForm(f => ({ ...f, pickup_time: e.target.value }))} /></div>

                {/* Patient Demographics for PCR */}
                <div className="rounded-md border bg-muted/20 p-3 space-y-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Patient Demographics (for PCR)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Date of Birth</Label><Input type="date" value={oneoffForm.dob} onChange={(e) => setOneoffForm(f => ({ ...f, dob: e.target.value }))} /></div>
                    <div>
                      <Label>Sex</Label>
                      <Select value={oneoffForm.sex || "none"} onValueChange={(v) => setOneoffForm(f => ({ ...f, sex: v === "none" ? "" : v }))}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Select —</SelectItem>
                          <SelectItem value="M">Male</SelectItem>
                          <SelectItem value="F">Female</SelectItem>
                          <SelectItem value="U">Unknown</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Weight (lbs)</Label><Input type="number" value={oneoffForm.weight_lbs} onChange={(e) => setOneoffForm(f => ({ ...f, weight_lbs: e.target.value }))} placeholder="lbs" /></div>
                    <div>
                      <Label>Mobility</Label>
                      <Select value={oneoffForm.mobility} onValueChange={(v) => setOneoffForm(f => ({ ...f, mobility: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ambulatory">Ambulatory</SelectItem>
                          <SelectItem value="wheelchair">Wheelchair</SelectItem>
                          <SelectItem value="stretcher">Stretcher</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={oneoffForm.oxygen} onCheckedChange={(v) => setOneoffForm(f => ({ ...f, oxygen: v }))} id="oneoff-o2" />
                    <Label htmlFor="oneoff-o2" className="cursor-pointer text-sm">Oxygen Required</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Primary Payer</Label><Input value={oneoffForm.primary_payer} onChange={(e) => setOneoffForm(f => ({ ...f, primary_payer: e.target.value }))} placeholder="e.g. Medicaid" /></div>
                    <div><Label>Member ID</Label><Input value={oneoffForm.member_id} onChange={(e) => setOneoffForm(f => ({ ...f, member_id: e.target.value }))} placeholder="e.g. GA2024-883341" /></div>
                  </div>
                </div>

                {/* B-leg toggle */}
                <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
                  <Switch checked={oneoffForm.needs_b_leg} onCheckedChange={(v) => setOneoffForm(f => ({ ...f, needs_b_leg: v }))} id="oneoff-bleg" />
                  <Label htmlFor="oneoff-bleg" className="cursor-pointer text-sm">This run needs a B-leg</Label>
                </div>
                {oneoffForm.needs_b_leg && (
                  <div className="space-y-3 rounded-md border bg-muted/20 p-3">
                    <div><Label>B-leg Pickup Time</Label><Input type="time" value={oneoffForm.b_leg_pickup_time} onChange={(e) => setOneoffForm(f => ({ ...f, b_leg_pickup_time: e.target.value }))} /></div>
                    <div>
                      <Label>Duration</Label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div><Label className="text-[10px] text-muted-foreground">Hours</Label><Input type="number" min={0} max={8} value={oneoffForm.b_leg_duration_hours} onChange={e => setOneoffForm(f => ({ ...f, b_leg_duration_hours: e.target.value }))} /></div>
                        <div><Label className="text-[10px] text-muted-foreground">Minutes</Label><Input type="number" min={0} max={59} value={oneoffForm.b_leg_duration_minutes} onChange={e => setOneoffForm(f => ({ ...f, b_leg_duration_minutes: e.target.value }))} /></div>
                      </div>
                    </div>
                  </div>
                )}

                <div><Label>Notes</Label><Textarea value={oneoffForm.notes} onChange={(e) => setOneoffForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Any special instructions for crew" /></div>
                <Button onClick={handleCreate}>Create One-Off {pendingLegType}-Leg</Button>
              </div>
            ) : (
              /* ── EXISTING PATIENT FORM ── */
              <div className="grid gap-3 py-2">
                {/* Copy from previous run */}
                <Collapsible open={copySearchOpen} onOpenChange={setCopySearchOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 text-xs text-primary hover:underline w-full">
                    <Search className="h-3 w-3" />
                    Copy from a previous run
                    <ChevronDown className={`h-3 w-3 ml-auto transition-transform ${copySearchOpen ? "rotate-180" : ""}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <Input
                      placeholder="Search by patient name..."
                      value={copySearchQuery}
                      onChange={(e) => { setCopySearchQuery(e.target.value); searchPreviousRuns(e.target.value, "existing"); }}
                      className="h-8 text-xs"
                    />
                    {copySearching && <p className="text-[10px] text-muted-foreground mt-1">Searching...</p>}
                    {copySearchResults.length > 0 && (
                      <div className="mt-1 max-h-32 overflow-y-auto rounded border divide-y">
                        {copySearchResults.map((r: any) => (
                          <button key={r.id} className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted/50 transition-colors" onClick={() => applyCopyResult(r, "existing")}>
                            <span className="font-medium">{r.is_oneoff ? r.oneoff_name : `${r.patient?.first_name} ${r.patient?.last_name}`}</span>
                            <span className="text-muted-foreground ml-2">{r.trip_type} · {r.pickup_location} · {r.run_date}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>

                <div>
                  <Label>Patient *</Label>
                  <Select value={legForm.patient_id} onValueChange={(v) => {
                    setLegForm(f => ({ ...f, patient_id: v }));
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                    <SelectContent>
                      {patients.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="flex items-center gap-2">
                            {p.name}
                            {p.status !== "active" && <AlertTriangle className="h-3 w-3 text-[hsl(var(--status-yellow))]" />}
                            {(p.weight ?? 0) > 200 && <Zap className="h-3 w-3 text-[hsl(var(--status-yellow))]" />}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Transport Type<PCRTooltip text={ADMIN_TOOLTIPS.trip_type} /></Label>
                  <Select value={legForm.trip_type} onValueChange={(v) => setLegForm(f => ({ ...f, trip_type: v, service_level: (v === "ift" || v === "ift_discharge") ? "ALS1" : "BLS" }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dialysis">Dialysis</SelectItem>
                      <SelectItem value="ift">IFT</SelectItem>
                      <SelectItem value="discharge">Discharge</SelectItem>
                      <SelectItem value="outpatient">Outpatient</SelectItem>
                      <SelectItem value="woundcare">Wound Care</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                      <SelectItem value="private_pay">Private Pay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Service Level</Label>
                  <Select value={legForm.service_level} onValueChange={(v) => setLegForm(f => ({ ...f, service_level: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BLS">BLS</SelectItem>
                      <SelectItem value="ALS1">ALS1</SelectItem>
                      <SelectItem value="ALS2">ALS2</SelectItem>
                      <SelectItem value="bariatric">Bariatric</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Pickup Location Type</Label>
                    <Select value={legPickupLocationType || "none"} onValueChange={(v) => setLegPickupLocationType(v === "none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Select —</SelectItem>
                        <SelectItem value="Residence">Residence</SelectItem>
                        <SelectItem value="Dialysis Facility">Dialysis Facility</SelectItem>
                        <SelectItem value="Hospital">Hospital</SelectItem>
                        <SelectItem value="SNF">SNF</SelectItem>
                        <SelectItem value="Assisted Living">Assisted Living</SelectItem>
                        <SelectItem value="Outpatient Specialty">Outpatient Specialty</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Destination Type</Label>
                    <Select value={legDestinationType || "none"} onValueChange={(v) => setLegDestinationType(v === "none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Select —</SelectItem>
                        <SelectItem value="Residence">Residence</SelectItem>
                        <SelectItem value="Dialysis Facility">Dialysis Facility</SelectItem>
                        <SelectItem value="Hospital">Hospital</SelectItem>
                        <SelectItem value="SNF">SNF</SelectItem>
                        <SelectItem value="Assisted Living">Assisted Living</SelectItem>
                        <SelectItem value="Outpatient Specialty">Outpatient Specialty</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Pickup Address *</Label><AddressComboInput value={legForm.pickup_location} onChange={(v) => setLegForm(f => ({ ...f, pickup_location: v }))} placeholder="Type or select from patient addresses" suggestions={(() => { const p = patients.find(x => x.id === legForm.patient_id); if (!p) return []; const opts = []; if (p.pickup_address) opts.push({ label: "Home Address", value: p.pickup_address }); if (p.dropoff_facility) opts.push({ label: "Facility", value: p.dropoff_facility }); return opts; })()} /></div>
                <div><Label>Destination Address *</Label><AddressComboInput value={legForm.destination_location} onChange={(v) => setLegForm(f => ({ ...f, destination_location: v }))} placeholder="Type or select from patient addresses" suggestions={(() => { const p = patients.find(x => x.id === legForm.patient_id); if (!p) return []; const opts = []; if (p.dropoff_facility) opts.push({ label: "Facility", value: p.dropoff_facility }); if (p.pickup_address) opts.push({ label: "Home Address", value: p.pickup_address }); return opts; })()} /></div>
                <div><Label>Pickup Time<PCRTooltip text={ADMIN_TOOLTIPS.pickup_time} /></Label><Input type="time" value={legForm.pickup_time} onChange={(e) => setLegForm(f => ({ ...f, pickup_time: e.target.value }))} /></div>

                {/* B-leg toggle */}
                <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
                  <Switch checked={legNeedsBLeg} onCheckedChange={setLegNeedsBLeg} id="existing-bleg" />
                  <Label htmlFor="existing-bleg" className="cursor-pointer text-sm">This run needs a B-leg</Label>
                </div>
                {legNeedsBLeg && (
                  <div className="space-y-3 rounded-md border bg-muted/20 p-3">
                    <div><Label>B-leg Pickup Time</Label><Input type="time" value={legBLegPickupTime} onChange={(e) => setLegBLegPickupTime(e.target.value)} /></div>
                    <div>
                      <Label>Duration</Label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div><Label className="text-[10px] text-muted-foreground">Hours</Label><Input type="number" min={0} max={8} value={legBLegDurationHours} onChange={e => setLegBLegDurationHours(e.target.value)} /></div>
                        <div><Label className="text-[10px] text-muted-foreground">Minutes</Label><Input type="number" min={0} max={59} value={legBLegDurationMinutes} onChange={e => setLegBLegDurationMinutes(e.target.value)} /></div>
                      </div>
                    </div>
                  </div>
                )}

                <div><Label>Notes</Label><Textarea value={legForm.notes} onChange={(e) => setLegForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
                <Button onClick={handleCreate}>Create {pendingLegType}-Leg</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Exception Edit Dialog */}
        <Dialog open={exceptionDialogOpen} onOpenChange={setExceptionDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-primary" />
                Edit This Run Only
              </DialogTitle>
              <DialogDescription>
                Changes apply <strong>only to {selectedDate}</strong> for {editingExceptionLeg?.patient_name}.
                The recurring series is not changed.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div>
                <Label>Move to Different Date</Label>
                <Input type="date" value={exceptionNewDate} onChange={(e) => setExceptionNewDate(e.target.value)} />
                {exceptionNewDate && exceptionNewDate !== selectedDate && (
                  <p className="text-[11px] text-primary mt-1">
                    This run will be unassigned from its current truck and moved to <strong>{exceptionNewDate}</strong>'s run pool.
                  </p>
                )}
              </div>
              {(!exceptionNewDate || exceptionNewDate === selectedDate) && (
                <>
                  <div>
                    <Label>Pickup Time<PCRTooltip text={ADMIN_TOOLTIPS.pickup_time} /></Label>
                    <Input type="time" value={exceptionForm.pickup_time} onChange={(e) => handleExceptionPickupTimeChange(e.target.value)} />
                    {editingExceptionLeg?.leg_type === "B" && bLegEarliest && (
                      <p className="text-[11px] text-muted-foreground mt-1">Earliest valid pickup: {bLegEarliest}</p>
                    )}
                    {editingExceptionLeg?.leg_type === "B" && bLegTooEarly && bLegEarliest && (
                      <p className="text-[11px] text-[hsl(var(--status-yellow))] mt-0.5">
                        <AlertTriangle className="inline h-3 w-3 mr-1" />
                        Too early — patient's treatment ends at approximately {bLegEarliest}. Override required.
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Pickup Location</Label>
                    <Input value={exceptionForm.pickup_location} onChange={(e) => setExceptionForm(f => ({ ...f, pickup_location: e.target.value }))} placeholder="e.g. City Hospital, Room 204" />
                  </div>
                  <div>
                    <Label>Destination</Label>
                    <Input value={exceptionForm.destination_location} onChange={(e) => setExceptionForm(f => ({ ...f, destination_location: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Notes for crew (this date only)</Label>
                    <Textarea value={exceptionForm.notes} onChange={(e) => setExceptionForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
                  </div>
                </>
              )}
              <div className="flex gap-2">
                <Button onClick={handleSaveException} disabled={savingException} className="flex-1">
                  {savingException ? "Saving..." : exceptionNewDate && exceptionNewDate !== selectedDate ? "Move Run" : "Save Exception"}
                </Button>
                {editingExceptionLeg?.has_exception && (!exceptionNewDate || exceptionNewDate === selectedDate) && (
                  <Button variant="outline" onClick={handleDeleteException} className="text-destructive border-destructive/40">
                    Remove Exception
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Copy Week Dialog */}
        <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Copy Crew Assignments Forward</DialogTitle>
              <DialogDescription>
                Copy crew-to-truck assignments from {weekLabel} to a target week. This does not copy scheduled runs or patient legs — only which crew members are assigned to which trucks each day. Existing crew assignments in the target week won't be overwritten.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div>
                <Label>Target Week (any date in that week)</Label>
                <Input type="date" value={copyTargetWeek} onChange={(e) => setCopyTargetWeek(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">This copies crew assignments only. After copying, use "Auto-Fill from Templates" on each day to generate patient runs.</p>
              <Button onClick={handleCopyWeek} disabled={copying}>
                {copying ? "Copying..." : "Copy Crew Assignments"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* B-Leg Override Confirmation Dialog */}
        <AlertDialog open={bLegOverrideOpen} onOpenChange={setBLegOverrideOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>B-Leg Early Pickup Override</AlertDialogTitle>
              <AlertDialogDescription>
                This pickup time is before the patient's treatment is expected to end ({bLegEarliest}). Enter an override reason to proceed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-2">
              <Label>Override Reason (min 10 characters)</Label>
              <Textarea value={bLegOverrideReason} onChange={(e) => setBLegOverrideReason(e.target.value)} rows={2} placeholder="Why is this early pickup necessary?" />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={bLegOverrideReason.trim().length < 10}
                onClick={async () => {
                  if (bLegPendingSave) await bLegPendingSave();
                  setBLegOverrideOpen(false);
                  setBLegPendingSave(null);
                }}
              >
                Override & Save
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dispatcher Cancel Dialog */}
        <DispatcherCancelDialog
          open={!!dispatcherCancelData}
          onOpenChange={(o) => { if (!o) setDispatcherCancelData(null); }}
          legId={dispatcherCancelData?.legId ?? ""}
          patientName={dispatcherCancelData?.patientName ?? ""}
          truckId={dispatcherCancelData?.truckId ?? ""}
          truckName={dispatcherCancelData?.truckName ?? ""}
          selectedDate={selectedDate}
          companyId={dispatcherCancelData?.companyId ?? null}
          tripId={dispatcherCancelData?.tripId ?? null}
          onCancelled={() => { setDispatcherCancelData(null); refresh(); }}
        />

        {/* Notify Crew Modal */}
        <NotifyCrewModal
          open={notifyModalOpen}
          onOpenChange={setNotifyModalOpen}
          selectedDate={selectedDate}
          onNotified={() => setNotifyBannerVisible(false)}
        />
      </div>
    </AdminLayout>
  );
}

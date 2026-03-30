import { memo, useEffect, useState, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Truck, Plus, Trash2, Zap, Users, GripVertical, GitBranch, Pencil, WrenchIcon, AlertTriangle, Clock, Link2, AlertCircle, XCircle, ShieldX, ShieldAlert, ArrowRight } from "lucide-react";
import { TruckRiskBadge } from "@/components/dispatch/TruckRiskBadge";
import { HoldTimerIndicator } from "@/components/dispatch/HoldTimerIndicator";
import { SafetyClassificationBadge } from "@/components/scheduling/SafetyClassificationBadge";
import { evaluateSafetyRules, hasCompletePatientNeeds, type PatientNeeds, type CrewCapability, type TruckEquipment } from "@/lib/safety-rules";
import { toast } from "sonner";
import { useSchedulingStore, type LegDisplay, type TruckOption, type CrewDisplay } from "@/hooks/useSchedulingStore";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { OperationalAlert } from "@/components/dispatch/OperationalAlertsPanel";

interface AvailabilityRecord {
  id: string;
  truck_id: string;
  status: "down_maintenance" | "down_out_of_service";
  start_date: string;
  end_date: string;
  reason: string | null;
}

interface SortableLegItemProps {
  leg: LegDisplay;
  hasAlert?: boolean;
  safetyStatus?: import("@/lib/safety-rules").SafetyStatus;
  safetyReasons?: string[];
  missingFields?: string[];
  overridden?: boolean;
  onRemove: () => void;
  onEditException: () => void;
  onCancel?: () => void;
  onRestore?: () => void;
  onSafetyOverride?: () => void;
}

const SortableLegItem = memo(function SortableLegItem({ leg, hasAlert, safetyStatus, safetyReasons, missingFields, overridden, onRemove, onEditException, onCancel, onRestore, onSafetyOverride }: SortableLegItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: leg.id,
    data: { type: "assigned-leg", leg },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 150ms ease",
    opacity: isDragging ? 0.4 : 1,
  };

  const isHeavy = (leg.patient_weight ?? 0) > 200;
  const isCancelled = leg.slot_status === "cancelled" || leg.slot_status === "pending_cancellation";
  const isPendingCancel = leg.slot_status === "pending_cancellation";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-md border px-2 py-1.5 text-xs ${
        isCancelled ? "bg-destructive/10 border-destructive/40 opacity-75" :
        "bg-card"
      } ${
        !isCancelled && hasAlert ? "border-[hsl(var(--status-red))]/50 bg-[hsl(var(--status-red))]/5" :
        !isCancelled && leg.has_exception ? "border-primary/40" : ""
      } ${isDragging ? "shadow-md ring-1 ring-primary/30" : ""}`}
    >
      {/* Top row: drag handle, leg badge, name, time */}
      <div className="flex items-center gap-1.5 min-w-0">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none shrink-0"
          tabIndex={-1}
        >
          <GripVertical className="h-3 w-3" />
        </button>
        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold shrink-0 ${
          leg.leg_type === "A" ? "bg-primary/10 text-primary" : "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]"
        }`}>{leg.leg_type}</span>
        <span className={`truncate font-medium ${isCancelled ? "line-through text-muted-foreground" : "text-card-foreground"}`}>{leg.patient_name}</span>
        {leg.pickup_time && <span className="text-muted-foreground shrink-0 ml-auto">{leg.pickup_time}</span>}
        <div className="flex items-center gap-0.5 shrink-0">
          {isCancelled ? (
            onRestore && (
              <Button variant="ghost" size="sm" className="h-5 text-[10px] text-primary hover:text-primary px-1.5" onClick={onRestore} title="Restore this run">
                Undo
              </Button>
            )
          ) : (
            <>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onEditException} title="Edit this run only">
                <Pencil className="h-2.5 w-2.5" />
              </Button>
              {onCancel && (
                <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive" onClick={onCancel} title="Cancel this run">
                  <XCircle className="h-2.5 w-2.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onRemove}>
                <Trash2 className="h-2.5 w-2.5" />
              </Button>
            </>
          )}
        </div>
      </div>
      {/* Second row: pickup address → destination, transport type, chair time */}
      {!isCancelled && (
        <div className="flex items-center gap-1 mt-0.5 pl-5 text-[10px] text-muted-foreground min-w-0">
          <span className="truncate">{leg.pickup_location}</span>
          <ArrowRight className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{leg.destination_location}</span>
          <span className="shrink-0 capitalize">· {leg.trip_type}</span>
          {leg.chair_time && <span className="shrink-0">· Chair {leg.chair_time}</span>}
        </div>
      )}
      {/* Third row: badges */}
      <div className="flex flex-wrap items-center gap-1 mt-1 pl-5">
        {leg.is_oneoff && (
          <span className="rounded-full bg-accent/80 text-accent-foreground px-1.5 py-0.5 text-[9px] font-bold shrink-0">ONE-OFF</span>
        )}
        {isCancelled && (
          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold shrink-0 ${
            isPendingCancel
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              : "bg-destructive/15 text-destructive"
          }`}>
            {isPendingCancel ? "PENDING CANCEL" : "CANCELLED"}
          </span>
        )}
        {isHeavy && <Zap className="h-3 w-3 text-[hsl(var(--status-yellow))] shrink-0" aria-label="Electric stretcher required" />}
        {leg.has_exception && <GitBranch className="h-3 w-3 text-primary shrink-0" aria-label="Exception override active" />}
        {hasAlert && (
          <span className="rounded-full bg-[hsl(var(--status-red))]/15 px-1.5 py-0.5 text-[9px] font-bold text-[hsl(var(--status-red))] shrink-0">
            NOT READY
          </span>
        )}
        {safetyStatus && (
          <SafetyClassificationBadge
            status={safetyStatus}
            reasons={safetyReasons ?? []}
            missingFields={missingFields ?? []}
            isOneoff={leg.is_oneoff}
            overridden={overridden}
            onOverride={safetyStatus === "BLOCKED" && !overridden && onSafetyOverride ? onSafetyOverride : undefined}
          />
        )}
      </div>
    </div>
  );
});

// Droppable zone for a truck — handles both pool→truck and truck→truck
const TruckDropZone = memo(function TruckDropZone({ truckId, isEmpty }: { truckId: string; isEmpty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `truck-drop-${truckId}`,
    data: { type: "truck-zone", truckId },
  });

  if (!isEmpty) return null;

  return (
    <div
      ref={setNodeRef}
      className={`rounded-md border-2 border-dashed px-3 py-3 text-center text-xs transition-colors duration-150 ${
        isOver
          ? "border-primary/60 bg-primary/5 text-primary"
          : "border-muted-foreground/20 text-muted-foreground/50"
      }`}
    >
      {isOver ? "Drop here to assign" : "Drop runs here"}
    </div>
  );
});

interface ActiveShareToken {
  truck_id: string;
  valid_from: string;
  valid_until: string;
}

interface TruckBuilderProps {
  trucks: TruckOption[];
  legs: LegDisplay[];
  crews: CrewDisplay[];
  selectedDate: string;
  onRefresh: () => void;
  onEditException: (leg: LegDisplay) => void;
  onDownCountChange?: (count: number) => void;
  activeTokens?: ActiveShareToken[];
  operationalAlerts?: OperationalAlert[];
  onLogChange?: (params: { change_type: string; change_summary: string; old_value?: string | null; new_value?: string | null; truck_id?: string | null; leg_id?: string | null }) => Promise<void>;
}

interface TruckRiskData {
  truck_id: string;
  late_probability: number;
  risk_color: string;
  collapse_index: number;
}

interface HoldTimerData {
  id: string;
  trip_id: string;
  hold_type: string;
  started_at: string;
  current_level: string;
  slot_id: string | null;
}

export function TruckBuilder({ trucks, legs, crews, selectedDate, onRefresh, onEditException, onDownCountChange, activeTokens = [], operationalAlerts = [], onLogChange }: TruckBuilderProps) {
  const { addingLeg, setAddingLeg } = useSchedulingStore();
  const [availability, setAvailability] = useState<AvailabilityRecord[]>([]);
  const [truckRisks, setTruckRisks] = useState<Map<string, TruckRiskData>>(new Map());
  const [holdTimers, setHoldTimers] = useState<HoldTimerData[]>([]);
  const [crewProfiles, setCrewProfiles] = useState<Map<string, { member1: any; member2: any }>>(new Map());
  const [truckEquipmentMap, setTruckEquipmentMap] = useState<Map<string, TruckEquipment>>(new Map());
  const [overriddenLegIds, setOverriddenLegIds] = useState<Set<string>>(new Set());

  // Safety override dialog state
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [pendingAssign, setPendingAssign] = useState<{ truckId: string; legId: string; reasons: string[] } | null>(null);

  // Fetch overridden leg IDs for this date
  const loadOverrides = useCallback(async () => {
    const { data } = await supabase
      .from("safety_overrides")
      .select("leg_id")
      .not("leg_id", "is", null);
    if (data) {
      setOverriddenLegIds(new Set((data as any[]).map(r => r.leg_id).filter(Boolean)));
    }
  }, []);

  // Fetch truck risk states + crew capabilities + truck equipment
  useEffect(() => {
    const loadRisks = async () => {
      const { data } = await supabase.from("truck_risk_state" as any).select("*");
      if (data) {
        const map = new Map((data as any[]).map((r: any) => [r.truck_id, r]));
        setTruckRisks(map);
      }
    };
    const loadTimers = async () => {
      const { data } = await supabase.from("hold_timers" as any).select("*").eq("is_active", true);
      setHoldTimers((data as any[]) ?? []);
    };
    const loadCrewCaps = async () => {
      const { data } = await supabase.from("crews")
        .select("truck_id, member1:profiles!crews_member1_id_fkey(sex, stair_chair_trained, bariatric_trained, oxygen_handling_trained, lift_assist_ok), member2:profiles!crews_member2_id_fkey(sex, stair_chair_trained, bariatric_trained, oxygen_handling_trained, lift_assist_ok)")
        .eq("active_date", selectedDate);
      const map = new Map<string, { member1: any; member2: any }>();
      for (const c of (data ?? []) as any[]) {
        map.set(c.truck_id, { member1: c.member1, member2: c.member2 });
      }
      setCrewProfiles(map);
    };
    const loadTruckEquip = async () => {
      const { data } = await supabase.from("trucks").select("id, has_power_stretcher, has_stair_chair, has_oxygen_mount").eq("active", true);
      const map = new Map<string, TruckEquipment>();
      for (const t of (data ?? []) as any[]) {
        map.set(t.id, {
          has_power_stretcher: t.has_power_stretcher ?? false,
          has_stair_chair: t.has_stair_chair ?? false,
          has_oxygen_mount: t.has_oxygen_mount ?? false,
        });
      }
      setTruckEquipmentMap(map);
    };
    loadRisks();
    loadTimers();
    loadCrewCaps();
    loadTruckEquip();
    loadOverrides();

    const channel = supabase
      .channel("truck-risk-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "truck_risk_state" }, () => loadRisks())
      .on("postgres_changes", { event: "*", schema: "public", table: "hold_timers" }, () => loadTimers())
      .on("postgres_changes", { event: "*", schema: "public", table: "safety_overrides" }, () => loadOverrides())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedDate, loadOverrides]);

  const hasActiveLinkForDate = useCallback((truckId: string): boolean =>
    activeTokens.some(t => t.truck_id === truckId && selectedDate >= t.valid_from && selectedDate <= t.valid_until),
    [activeTokens, selectedDate]
  );

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("truck_availability" as any)
        .select("*")
        .lte("start_date", selectedDate)
        .gte("end_date", selectedDate);
      const records = (data ?? []) as unknown as AvailabilityRecord[];
      setAvailability(records);
      onDownCountChange?.(records.length);
    };
    load();
  }, [selectedDate, onDownCountChange]);

  const getTruckDown = useCallback((truckId: string): AvailabilityRecord | undefined =>
    availability.find((a) => a.truck_id === truckId),
    [availability]
  );

  const truckLegs = useCallback((truckId: string) =>
    legs
      .filter((l) => l.assigned_truck_id === truckId)
      .sort((a, b) => {
        if (a.slot_order != null && b.slot_order != null) return a.slot_order - b.slot_order;
        if (a.slot_order != null) return -1;
        if (b.slot_order != null) return 1;
        if (!a.pickup_time) return 1;
        if (!b.pickup_time) return -1;
        return a.pickup_time.localeCompare(b.pickup_time);
      }),
    [legs]
  );

  const unassigned = legs.filter((l) => !l.assigned_truck_id);

  const crewForTruck = useCallback((truckId: string): CrewDisplay | undefined =>
    crews.find((c) => c.truck_id === truckId),
    [crews]
  );

  const getCrewCapability = useCallback((truckId: string): CrewCapability => {
    const cp = crewProfiles.get(truckId);
    return {
      member1: cp?.member1 ? {
        sex: cp.member1.sex ?? null,
        stair_chair_trained: cp.member1.stair_chair_trained ?? false,
        bariatric_trained: cp.member1.bariatric_trained ?? false,
        oxygen_handling_trained: cp.member1.oxygen_handling_trained ?? false,
        lift_assist_ok: cp.member1.lift_assist_ok ?? false,
      } : null,
      member2: cp?.member2 ? {
        sex: cp.member2.sex ?? null,
        stair_chair_trained: cp.member2.stair_chair_trained ?? false,
        bariatric_trained: cp.member2.bariatric_trained ?? false,
        oxygen_handling_trained: cp.member2.oxygen_handling_trained ?? false,
        lift_assist_ok: cp.member2.lift_assist_ok ?? false,
      } : null,
    };
  }, [crewProfiles]);

  const assignLeg = useCallback(async (truckId: string, legId: string) => {
    const currentSlots = truckLegs(truckId);
    if (currentSlots.length >= 10) {
      toast.error("Truck is full (10 run slots max)");
      return;
    }

    // Check safety: BLOCKED requires override before assignment
    const leg = legs.find(l => l.id === legId);
    if (leg) {
      const crewCap = getCrewCapability(truckId);
      const equip = truckEquipmentMap.get(truckId);
      if (equip) {
        const patientNeeds: PatientNeeds = {
          weight_lbs: leg.patient_weight,
          mobility: leg.patient_mobility ?? null,
          stairs_required: leg.patient_stairs_required ?? null,
          stair_chair_required: leg.patient_stair_chair_required ?? null,
          oxygen_required: leg.patient_oxygen_required ?? null,
          oxygen_lpm: leg.patient_oxygen_lpm ?? null,
          special_equipment_required: leg.patient_special_equipment ?? null,
          bariatric: leg.patient_bariatric ?? null,
        };
        const safetyResult = evaluateSafetyRules(patientNeeds, crewCap, equip);
        if (safetyResult.status === "BLOCKED") {
          // Show override dialog instead of assigning
          setPendingAssign({ truckId, legId, reasons: safetyResult.reasons });
          setOverrideReason("");
          setOverrideDialogOpen(true);
          return;
        }
      }
    }

    await doAssignLeg(truckId, legId);
  }, [truckLegs, legs, getCrewCapability, truckEquipmentMap]);

  const doAssignLeg = useCallback(async (truckId: string, legId: string) => {
    const currentSlots = truckLegs(truckId);
    const { data: companyId } = await supabase.rpc("get_my_company_id");
    const { error } = await supabase.from("truck_run_slots").insert({
      truck_id: truckId,
      leg_id: legId,
      run_date: selectedDate,
      slot_order: currentSlots.length,
      company_id: companyId,
    } as any);
    if (error) {
      if (error.code === "23505") {
        toast.error("This leg is already assigned to a truck for this date");
      } else {
        toast.error("Failed to assign leg");
      }
      return;
    }
    toast.success("Leg assigned to truck");
    const assignedLeg = legs.find(l => l.id === legId);
    const truckName = trucks.find(t => t.id === truckId)?.name ?? "truck";
    if (onLogChange && assignedLeg) {
      onLogChange({
        change_type: "run_added",
        change_summary: `Run assigned to ${truckName} for ${assignedLeg.patient_name} at ${assignedLeg.pickup_time ?? "TBD"}`,
        truck_id: truckId,
        leg_id: legId,
      });
    }
    setAddingLeg(null);
    onRefresh();
  }, [truckLegs, selectedDate, onRefresh, setAddingLeg]);

  const confirmBlockedOverride = useCallback(async () => {
    if (!pendingAssign || !overrideReason.trim()) {
      toast.error("Override reason is required");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { data: companyId } = await supabase.rpc("get_my_company_id");

    // Log override to safety_overrides table
    await supabase.from("safety_overrides").insert({
      leg_id: pendingAssign.legId,
      overridden_by: user?.id,
      override_reason: overrideReason.trim(),
      override_status: "BLOCKED",
      reasons: pendingAssign.reasons,
      company_id: companyId,
    } as any);

    setOverrideDialogOpen(false);
    const wasAlreadyAssigned = legs.find(l => l.id === pendingAssign.legId)?.assigned_truck_id;
    const savedAssign = { ...pendingAssign };
    setPendingAssign(null);
    setOverrideReason("");

    if (wasAlreadyAssigned) {
      toast.success("Safety override logged");
      onRefresh();
    } else {
      await doAssignLeg(savedAssign.truckId, savedAssign.legId);
      toast.success("Safety override logged — leg assigned");
    }
  }, [pendingAssign, overrideReason, doAssignLeg, legs, onRefresh]);

  const removeLeg = useCallback(async (legId: string) => {
    await supabase.from("truck_run_slots").delete().eq("leg_id", legId).eq("run_date", selectedDate);
    toast.success("Leg removed from truck");
    onRefresh();
  }, [selectedDate, onRefresh]);

  const cancelLeg = useCallback(async (legId: string) => {
    const leg = legs.find(l => l.id === legId);
    if (!leg) return;

    const { data: { user } } = await supabase.auth.getUser();

    // Set slot status to 'cancelled' instead of deleting
    await supabase.from("truck_run_slots")
      .update({ status: "cancelled" } as any)
      .eq("leg_id", legId)
      .eq("run_date", selectedDate);

    // Log cancellation to audit
    await supabase.from("audit_logs").insert({
      action: "run_cancelled",
      actor_user_id: user?.id,
      actor_email: user?.email,
      table_name: "scheduling_legs",
      record_id: legId,
      notes: `Cancelled ${leg.leg_type}-Leg for ${leg.patient_name} on ${selectedDate}`,
      new_data: { leg_type: leg.leg_type, patient_name: leg.patient_name, run_date: selectedDate },
    } as any);

    // If A-leg, auto-cancel linked B-leg
    if (leg.leg_type === "A") {
      const linkedB = legs.find(l => l.patient_id === leg.patient_id && l.leg_type === "B" && l.assigned_truck_id);
      if (linkedB) {
        await supabase.from("truck_run_slots")
          .update({ status: "cancelled" } as any)
          .eq("leg_id", linkedB.id)
          .eq("run_date", selectedDate);
        await supabase.from("audit_logs").insert({
          action: "run_cancelled",
          actor_user_id: user?.id,
          actor_email: user?.email,
          table_name: "scheduling_legs",
          record_id: linkedB.id,
          notes: `Auto-cancelled B-Leg (linked A-Leg cancelled) for ${linkedB.patient_name} on ${selectedDate}`,
          new_data: { leg_type: "B", patient_name: linkedB.patient_name, run_date: selectedDate, auto_cancelled: true },
        } as any);
        toast.success("A-Leg cancelled — linked B-Leg also cancelled");
      } else {
        toast.success("Run cancelled");
      }
    } else {
      toast.success("Run cancelled");
    }
    if (onLogChange) {
      onLogChange({
        change_type: "run_cancelled",
        change_summary: `Run cancelled for ${leg.patient_name}`,
        truck_id: leg.assigned_truck_id ?? null,
        leg_id: legId,
      });
    }
    onRefresh();
  }, [legs, selectedDate, onRefresh]);

  const restoreLeg = useCallback(async (legId: string) => {
    const leg = legs.find(l => l.id === legId);
    await supabase.from("truck_run_slots")
      .update({ status: "pending" } as any)
      .eq("leg_id", legId)
      .eq("run_date", selectedDate);
    toast.success("Run restored");
    if (onLogChange && leg) {
      onLogChange({
        change_type: "run_restored",
        change_summary: `Run restored for ${leg.patient_name}`,
        truck_id: leg.assigned_truck_id ?? null,
        leg_id: legId,
      });
    }
    onRefresh();
  }, [legs, selectedDate, onRefresh, onLogChange]);

  // getCrewCapability moved above assignLeg

  const utilizationColor = useCallback((count: number) => {
    if (count >= 6 && count <= 8) return "bg-[hsl(var(--status-green))]/20 text-[hsl(var(--status-green))] border-[hsl(var(--status-green))]/30";
    if (count >= 3 && count <= 5) return "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))] border-[hsl(var(--status-yellow))]/30";
    return "bg-[hsl(var(--status-red))]/10 text-[hsl(var(--status-red))] border-[hsl(var(--status-red))]/30";
  }, []);

  // Handle override from clicking BLOCKED badge on already-assigned legs
  const handleBadgeOverride = useCallback((legId: string, reasons: string[]) => {
    // Find which truck this leg is on
    const leg = legs.find(l => l.id === legId);
    const truckId = leg?.assigned_truck_id;
    if (!truckId) return;
    setPendingAssign({ truckId, legId, reasons });
    setOverrideReason("");
    setOverrideDialogOpen(true);
  }, [legs]);

  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Truck Builder
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {trucks.map((truck) => {
          const tLegs = truckLegs(truck.id);
          const hasHeavy = tLegs.some((l) => (l.patient_weight ?? 0) > 200);
          const crew = crewForTruck(truck.id);
          const downRecord = getTruckDown(truck.id);
          const isDown = !!downRecord;
          const hasRunsWhileDown = isDown && tLegs.length > 0;
          const times = tLegs.map(l => l.pickup_time).filter(Boolean) as string[];
          const first = times.length > 0 ? times.sort()[0] : null;
          const last = times.length > 0 ? [...times].sort().reverse()[0] : null;
          const hasLink = hasActiveLinkForDate(truck.id);
          const truckAlerts = operationalAlerts.filter(a => a.truck_id === truck.id && a.status === "open");
          const truckLegAlertIds = new Set(truckAlerts.map(a => a.leg_id));
          const riskData = truckRisks.get(truck.id);
          const truckTimers = holdTimers.filter(t => {
            const tripLegIds = tLegs.map(l => l.id);
            return true; // show all active timers for now
          });

          return (
            <TruckCard
              key={truck.id}
              truck={truck}
              tLegs={tLegs}
              crew={crew}
              downRecord={downRecord}
              isDown={isDown}
              hasRunsWhileDown={hasRunsWhileDown}
              hasHeavy={hasHeavy}
              first={first}
              last={last}
              hasActiveLink={hasLink}
              utilizationColor={utilizationColor}
              unassigned={unassigned}
              addingLeg={addingLeg}
              setAddingLeg={setAddingLeg}
              onAssignLeg={assignLeg}
              onRemoveLeg={removeLeg}
              onEditException={onEditException}
              onCancelLeg={cancelLeg}
              onRestoreLeg={restoreLeg}
              truckAlertCount={truckAlerts.length}
              legAlertIds={truckLegAlertIds}
              riskData={riskData}
              crewCapability={getCrewCapability(truck.id)}
              truckEquipment={truckEquipmentMap.get(truck.id)}
              onSafetyOverride={handleBadgeOverride}
              overriddenLegIds={overriddenLegIds}
            />
          );
        })}
      </div>
      {trucks.length === 0 && (
        <p className="text-sm text-muted-foreground">No trucks configured. Add trucks in the Trucks & Crews section.</p>
      )}

      {/* Safety Override Dialog for BLOCKED assignments */}
      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldX className="h-5 w-5" /> Safety Block — Override Required
            </DialogTitle>
            <DialogDescription>
              This run has been blocked due to safety concerns. You must provide a reason to override.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {pendingAssign?.reasons.map((r, i) => (
              <div key={i} className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                • {r}
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor="override-reason">Override Reason (required)</Label>
              <Textarea
                id="override-reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why this assignment is safe to proceed…"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setOverrideDialogOpen(false); setPendingAssign(null); }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={!overrideReason.trim()}
                onClick={confirmBlockedOverride}
              >
                Override & Assign
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

// ── Individual truck card with its own droppable zone ──
interface TruckCardProps {
  truck: TruckOption;
  tLegs: LegDisplay[];
  crew: CrewDisplay | undefined;
  downRecord: AvailabilityRecord | undefined;
  isDown: boolean;
  hasRunsWhileDown: boolean;
  hasHeavy: boolean;
  first: string | null;
  last: string | null;
  hasActiveLink: boolean;
  utilizationColor: (count: number) => string;
  unassigned: LegDisplay[];
  addingLeg: { truckId: string; legId: string } | null;
  setAddingLeg: (v: { truckId: string; legId: string } | null) => void;
  onAssignLeg: (truckId: string, legId: string) => void;
  onRemoveLeg: (legId: string) => void;
  onEditException: (leg: LegDisplay) => void;
  onCancelLeg?: (legId: string) => void;
  onRestoreLeg?: (legId: string) => void;
  truckAlertCount?: number;
  legAlertIds?: Set<string>;
  riskData?: TruckRiskData;
  crewCapability?: CrewCapability;
  truckEquipment?: TruckEquipment;
  onSafetyOverride?: (legId: string, reasons: string[]) => void;
  overriddenLegIds?: Set<string>;
}

const TruckCard = memo(function TruckCard({
  truck, tLegs, crew, downRecord, isDown, hasRunsWhileDown, hasHeavy,
  first, last, hasActiveLink, utilizationColor, unassigned, addingLeg, setAddingLeg,
  onAssignLeg, onRemoveLeg, onEditException, onCancelLeg, onRestoreLeg, truckAlertCount = 0, legAlertIds = new Set(), riskData,
  crewCapability, truckEquipment, onSafetyOverride, overriddenLegIds = new Set(),
}: TruckCardProps) {
  const [legsExpanded, setLegsExpanded] = useState(false);
  const VISIBLE_LEG_COUNT = 2;
  const visibleLegs = legsExpanded ? tLegs : tLegs.slice(0, VISIBLE_LEG_COUNT);
  const hiddenLegCount = tLegs.length - VISIBLE_LEG_COUNT;

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `truck-drop-${truck.id}`,
    data: { type: "truck-zone", truckId: truck.id },
  });

  return (
    <div
      className={`rounded-lg border bg-card p-4 transition-colors duration-150 ${
        isDown ? "border-destructive/40 bg-destructive/5" : ""
      } ${isOver && !isDown ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" : ""} ${
        truckAlertCount > 0 && !isDown ? "border-[hsl(var(--status-red))]/40" : ""
      }`}
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between gap-1 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <Truck className={`h-4 w-4 shrink-0 ${isDown ? "text-destructive" : "text-muted-foreground"}`} />
          <span className={`font-semibold truncate ${isDown ? "text-destructive" : "text-card-foreground"}`}>{truck.name}</span>
          {isDown && (
            <Badge variant="destructive" className="text-[9px] px-1.5 py-0 shrink-0">
              {downRecord!.status === "down_maintenance" ? "MAINT" : "OUT OF SVC"}
            </Badge>
          )}
          {truckAlertCount > 0 && !isDown && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-[hsl(var(--status-red))]/15 px-1.5 py-0.5 text-[9px] font-bold text-[hsl(var(--status-red))] shrink-0">
              <AlertCircle className="h-2.5 w-2.5" />{truckAlertCount}
            </span>
          )}
          {hasHeavy && !isDown && (
            <span className="text-[hsl(var(--status-yellow))] shrink-0" title="Has heavy patient - electric stretcher needed">
              <Zap className="h-3.5 w-3.5" />
            </span>
          )}
          {/* Truck-level safety summary */}
          {(() => {
            if (isDown || tLegs.length === 0 || !crewCapability || !truckEquipment) return null;
            let worstStatus: "OK" | "WARNING" | "BLOCKED" = "OK";
            let totalIssues = 0;
            for (const leg of tLegs) {
              const needs = {
                weight_lbs: leg.patient_weight,
                mobility: leg.patient_mobility ?? null,
                stairs_required: leg.patient_stairs_required ?? null,
                stair_chair_required: leg.patient_stair_chair_required ?? null,
                oxygen_required: leg.patient_oxygen_required ?? null,
                oxygen_lpm: leg.patient_oxygen_lpm ?? null,
                special_equipment_required: leg.patient_special_equipment ?? null,
                bariatric: leg.patient_bariatric ?? null,
              };
              const result = evaluateSafetyRules(needs, crewCapability, truckEquipment);
              const effectiveStatus = result.status === "BLOCKED" && overriddenLegIds.has(leg.id) ? "WARNING" : result.status;
              if (effectiveStatus === "BLOCKED") worstStatus = "BLOCKED";
              else if (effectiveStatus === "WARNING" && worstStatus !== "BLOCKED") worstStatus = "WARNING";
              totalIssues += result.reasons.length;
            }
            if (worstStatus === "OK") return null;
            const Icon = worstStatus === "BLOCKED" ? ShieldX : ShieldAlert;
            const color = worstStatus === "BLOCKED" ? "text-destructive" : "text-[hsl(var(--status-yellow))]";
            return (
              <span className={`inline-flex items-center gap-0.5 shrink-0 ${color}`} title={`${worstStatus}: ${totalIssues} safety concern(s) on this truck`}>
                <Icon className="h-3 w-3" />
              </span>
            );
          })()}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasActiveLink && (
            <span title="Crew share link active for this date" className="flex items-center gap-0.5 text-[hsl(var(--status-green))]">
              <Link2 className="h-3 w-3" />
            </span>
          )}
          {!isDown && (
            <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${utilizationColor(tLegs.length)}`}>
              {tLegs.length} runs
            </span>
          )}
          {!isDown && riskData && (
            <TruckRiskBadge
              riskColor={riskData.risk_color}
              lateProbability={riskData.late_probability}
              collapseIndex={riskData.collapse_index}
            />
          )}
        </div>
      </div>

      {/* Down warning */}
      {isDown && (
        <div className="mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
          <div className="flex items-center gap-1 font-semibold">
            <WrenchIcon className="h-3 w-3" />
            Truck unavailable
            {downRecord!.reason && ` — ${downRecord!.reason}`}
          </div>
          {hasRunsWhileDown && (
            <div className="mt-1 flex items-center gap-1 text-[hsl(var(--status-yellow))] font-medium">
              <AlertTriangle className="h-3 w-3" />
              {tLegs.length} run(s) still assigned — reassign to another truck.
            </div>
          )}
        </div>
      )}

      {/* Crew info */}
      {!isDown && (
        <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3 w-3 shrink-0" />
          {crew ? (
            <span className="truncate">{[crew.member1_name, crew.member2_name, crew.member3_name].filter(Boolean).join(" & ") || "—"}</span>
          ) : (
            <span className="italic text-[hsl(var(--status-yellow))]">⚠ No crew assigned</span>
          )}
        </div>
      )}

      {/* First / last pickup time */}
      {!isDown && tLegs.length > 0 && (
        <div className="mb-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          <span>{first ?? "—"} → {last ?? "—"}</span>
        </div>
      )}

      {/* Drop zone + sortable leg list */}
      <div ref={setDropRef} className="mb-2 min-h-[2rem]">
        {tLegs.length > 0 ? (
          <div className={`space-y-1.5 rounded-md transition-colors duration-150 ${isOver && !isDown ? "bg-primary/3" : ""}`}>
            <SortableContext items={tLegs.map((l) => l.id)} strategy={verticalListSortingStrategy}>
              {visibleLegs.map((leg) => {
                const patientNeeds: PatientNeeds = {
                  weight_lbs: leg.patient_weight,
                  mobility: leg.patient_mobility ?? null,
                  stairs_required: leg.patient_stairs_required ?? null,
                  stair_chair_required: leg.patient_stair_chair_required ?? null,
                  oxygen_required: leg.patient_oxygen_required ?? null,
                  oxygen_lpm: leg.patient_oxygen_lpm ?? null,
                  special_equipment_required: leg.patient_special_equipment ?? null,
                  bariatric: leg.patient_bariatric ?? null,
                };
                const safetyResult = crewCapability && truckEquipment
                  ? evaluateSafetyRules(patientNeeds, crewCapability, truckEquipment)
                  : { status: "OK" as const, reasons: [] };
                const needsCheck = hasCompletePatientNeeds(patientNeeds);
                return (
                  <SortableLegItem
                    key={leg.id}
                    leg={leg}
                    hasAlert={legAlertIds.has(leg.id)}
                    safetyStatus={safetyResult.status}
                    safetyReasons={safetyResult.reasons}
                    missingFields={needsCheck.missing}
                    overridden={overriddenLegIds.has(leg.id)}
                    onRemove={() => onRemoveLeg(leg.id)}
                    onEditException={() => onEditException(leg)}
                    onCancel={onCancelLeg ? () => onCancelLeg(leg.id) : undefined}
                    onRestore={onRestoreLeg ? () => onRestoreLeg(leg.id) : undefined}
                    onSafetyOverride={safetyResult.status === "BLOCKED" && !overriddenLegIds.has(leg.id) && onSafetyOverride ? () => onSafetyOverride(leg.id, safetyResult.reasons) : undefined}
                  />
                );
              })}
            </SortableContext>
            {hiddenLegCount > 0 && (
              <button
                onClick={() => setLegsExpanded(!legsExpanded)}
                className="w-full flex items-center justify-center gap-1 rounded-md border border-dashed border-muted-foreground/30 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-colors"
              >
                <ChevronDown className={`h-2.5 w-2.5 transition-transform ${legsExpanded ? "rotate-180" : ""}`} />
                {legsExpanded ? "Show less" : `Show ${hiddenLegCount} more`}
              </button>
            )}
            {isOver && !isDown && (
              <div className="rounded-md border-2 border-dashed border-primary/40 px-2 py-1.5 text-center text-[10px] text-primary/70">
                Drop to add here
              </div>
            )}
          </div>
        ) : (
          <TruckDropZone truckId={truck.id} isEmpty />
        )}
      </div>

      {/* Manual add leg selector */}
      {!isDown && tLegs.length < 10 && unassigned.length > 0 && (
        addingLeg?.truckId === truck.id ? (
          <div className="flex gap-2">
            <Select value={addingLeg.legId} onValueChange={(v) => setAddingLeg({ truckId: truck.id, legId: v })}>
              <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Select leg" /></SelectTrigger>
              <SelectContent>
                {unassigned.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.leg_type}: {l.patient_name} {l.pickup_time ?? ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8" onClick={() => addingLeg.legId && onAssignLeg(truck.id, addingLeg.legId)}>Add</Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setAddingLeg(null)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setAddingLeg({ truckId: truck.id, legId: "" })}>
            <Plus className="mr-1 h-3 w-3" /> Add Leg
          </Button>
        )
      )}

      {/* Blocked message for down trucks with no runs */}
      {isDown && tLegs.length === 0 && (
        <p className="text-xs text-muted-foreground italic text-center py-2">Truck blocked — cannot assign runs while down</p>
      )}
    </div>
  );
});

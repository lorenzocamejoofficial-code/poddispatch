import { useState, useCallback, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Zap, AlertTriangle, ArrowRight,
  Wand2, ChevronLeft, ChevronRight, CalendarDays, ArrowLeft,
  GitBranch, GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { TruckBuilder } from "@/components/scheduling/TruckBuilder";
import { RunPool } from "@/components/scheduling/RunPool";
import { TemplateControls } from "@/components/scheduling/TemplateControls";
import { UpcomingNonDialysisPanel } from "@/components/scheduling/UpcomingNonDialysisPanel";
import { useSchedulingStore, type LegDisplay } from "@/hooks/useSchedulingStore";
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
  const {
    selectedDate, setSelectedDate,
    legs, patients, trucks, crews,
    legForm, setLegForm, resetLegForm,
    pendingLegType, setPendingLegType,
    dialogOpen, setDialogOpen,
    refresh, autoGenerateLegs,
  } = useSchedulingStore();

  const [generating, setGenerating] = useState(false);
  const [weekView, setWeekView] = useState(true);
  const [weekSummaries, setWeekSummaries] = useState<DaySummary[]>([]);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyTargetWeek, setCopyTargetWeek] = useState("");
  const [copying, setCopying] = useState(false);

  // Active share tokens for "Link active" indicators on truck cards
  const [activeShareTokens, setActiveShareTokens] = useState<{ truck_id: string; valid_from: string; valid_until: string }[]>([]);

  useEffect(() => {
    supabase
      .from("crew_share_tokens")
      .select("truck_id, valid_from, valid_until")
      .eq("active", true)
      .then(({ data }) => setActiveShareTokens((data ?? []) as any[]));
  }, [selectedDate]);


  // Drag state
  const [activeDragLeg, setActiveDragLeg] = useState<LegDisplay | null>(null);

  // Exception editing state
  const [exceptionDialogOpen, setExceptionDialogOpen] = useState(false);
  const [editingExceptionLeg, setEditingExceptionLeg] = useState<LegDisplay | null>(null);
  const [exceptionForm, setExceptionForm] = useState({
    pickup_time: "", pickup_location: "", destination_location: "", notes: "",
  });
  const [savingException, setSavingException] = useState(false);

  const weekDates = getWeekDates(selectedDate);
  const today = new Date().toISOString().split("T")[0];

  const fetchWeekSummaries = useCallback(async () => {
    const startDate = weekDates[0];
    const endDate = weekDates[6];

    const [{ data: legData }, { data: slotData }] = await Promise.all([
      supabase.from("scheduling_legs").select("id, run_date").gte("run_date", startDate).lte("run_date", endDate),
      supabase.from("truck_run_slots").select("id, run_date, truck_id").gte("run_date", startDate).lte("run_date", endDate),
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
    d.setDate(d.getDate() + direction * 7);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const goToToday = () => setSelectedDate(today);

  const openDay = (date: string) => {
    setSelectedDate(date);
    setWeekView(false);
  };

  const openCreateDialog = (type: "A" | "B") => {
    setPendingLegType(type);
    resetLegForm();
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!legForm.patient_id || !legForm.pickup_location || !legForm.destination_location) {
      toast.error("Patient, pickup location, and destination are required");
      return;
    }

    const patient = patients.find(p => p.id === legForm.patient_id);
    if (patient && patient.status !== "active") {
      toast.warning(`Warning: ${patient.name} is ${patient.status.replace("_", " ")}. Scheduling anyway.`);
    }

    // Resolve company_id for RLS
    const { data: profileData } = await supabase.from("profiles").select("company_id").limit(1).single();
    const companyId = (profileData as any)?.company_id ?? null;

    const { error } = await supabase.from("scheduling_legs").insert({
      patient_id: legForm.patient_id,
      leg_type: pendingLegType!,
      pickup_time: legForm.pickup_time || null,
      chair_time: legForm.chair_time || null,
      pickup_location: legForm.pickup_location,
      destination_location: legForm.destination_location,
      trip_type: legForm.trip_type as any,
      estimated_duration_minutes: legForm.estimated_duration_minutes ? parseInt(legForm.estimated_duration_minutes) : null,
      notes: legForm.notes || null,
      run_date: selectedDate,
      company_id: companyId,
    } as any);

    if (error) { toast.error("Failed to create leg"); return; }

    toast.success(`${pendingLegType}-Leg created`);
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

  // Open exception edit dialog
  const openExceptionEdit = (leg: LegDisplay) => {
    setEditingExceptionLeg(leg);
    setExceptionForm({
      pickup_time: leg.pickup_time ?? "",
      pickup_location: leg.pickup_location,
      destination_location: leg.destination_location,
      notes: leg.notes ?? "",
    });
    setExceptionDialogOpen(true);
  };

  const handleSaveException = async () => {
    if (!editingExceptionLeg) return;
    setSavingException(true);
    try {
      const payload: any = {
        scheduling_leg_id: editingExceptionLeg.id,
        run_date: selectedDate,
        pickup_time: exceptionForm.pickup_time || null,
        pickup_location: exceptionForm.pickup_location || null,
        destination_location: exceptionForm.destination_location || null,
        notes: exceptionForm.notes || null,
      };
      // Upsert: if exception exists for this leg+date, update it; else insert
      const { error } = await supabase
        .from("leg_exceptions" as any)
        .upsert(payload, { onConflict: "scheduling_leg_id,run_date" });

      if (error) { toast.error("Failed to save exception"); return; }
      toast.success("Run exception saved for this date only");
      setExceptionDialogOpen(false);
      refresh();
    } finally {
      setSavingException(false);
    }
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
      const newCrews: any[] = [];
      for (const crew of srcCrews ?? []) {
        const srcDayIdx = weekDates.indexOf(crew.active_date);
        if (srcDayIdx === -1) continue;
        const targetDate = targetWeekDates[srcDayIdx];
        const key = `${targetDate}_${crew.truck_id}`;
        if (existingKeys.has(key)) continue;
        newCrews.push({ truck_id: crew.truck_id, member1_id: crew.member1_id, member2_id: crew.member2_id, active_date: targetDate });
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

  // ── DnD sensors ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { data } = event.active;
    // leg is attached for both pool-leg and assigned-leg drag types
    const leg = data.current?.leg as LegDisplay | undefined;
    // fallback: find by id (covers sortable items from TruckBuilder)
    const resolved = leg ?? legs.find(l => l.id === event.active.id);
    if (resolved) setActiveDragLeg(resolved);
  };

  // Master drag-end handler: covers pool→truck, truck→truck, truck→pool, reorder within truck
  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragLeg(null);
    const { active, over } = event;
    if (!over) return;

    const sourceData = active.data.current as any;
    const targetData = over.data.current as any;

    // Resolve the active leg from drag data or from state by id
    const activeLeg: LegDisplay | undefined =
      sourceData?.leg ?? legs.find(l => l.id === active.id);
    if (!activeLeg) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // ── Case 1: Drop on pool drop zone (unassign) ──
    if (overId === "pool-droppable") {
      if (!activeLeg.assigned_truck_id) return; // already unassigned
      const { error } = await supabase
        .from("truck_run_slots")
        .delete()
        .eq("leg_id", activeId)
        .eq("run_date", selectedDate);
      if (error) { toast.error("Assignment failed — try again"); return; }
      toast.success("Run returned to pool");
      refresh();
      return;
    }

    // ── Case 2: Drop on a truck zone or within a truck (assign / move / reorder) ──
    const targetTruckId: string | undefined =
      targetData?.type === "truck-zone" ? targetData.truckId :
      targetData?.type === "assigned-leg" ? targetData.leg?.assigned_truck_id :
      // over.id might be a leg id (sortable drop)
      legs.find(l => l.id === overId)?.assigned_truck_id;

    if (!targetTruckId) return;

    const currentTruckId = activeLeg.assigned_truck_id;

    if (currentTruckId === targetTruckId) {
      // ── Reorder within same truck ── sort by slot_order (same as TruckBuilder display order)
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
      await Promise.all(
        reordered.map((leg, idx) =>
          supabase.from("truck_run_slots")
            .update({ slot_order: idx } as any)
            .eq("leg_id", leg.id)
            .eq("run_date", selectedDate)
            .eq("truck_id", targetTruckId)
        )
      );
      refresh();
      return;
    }

    // ── Move to different truck (or assign from pool) ──
    const targetLegs = legs.filter(l => l.assigned_truck_id === targetTruckId);
    if (targetLegs.length >= 10) { toast.error("Truck is full (10 run slots max)"); return; }

    if (currentTruckId) {
      // Move between trucks: update existing slot
      const { error } = await supabase
        .from("truck_run_slots")
        .update({ truck_id: targetTruckId, slot_order: targetLegs.length } as any)
        .eq("leg_id", activeId)
        .eq("run_date", selectedDate);
      if (error) { toast.error("Assignment failed — try again"); return; }
      toast.success(`Run moved to ${trucks.find(t => t.id === targetTruckId)?.name ?? "truck"}`);
    } else {
      // Assign from pool: insert new slot — include company_id for RLS
      const { data: profileData } = await supabase.from("profiles").select("company_id").limit(1).single();
      const companyId = (profileData as any)?.company_id ?? null;
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
          toast.error("Assignment failed — try again");
        }
        return;
      }
      toast.success(`Run assigned to ${trucks.find(t => t.id === targetTruckId)?.name ?? "truck"}`);
    }
    refresh();
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
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
            <span className="text-sm font-semibold text-foreground ml-2">
              {weekView
                ? weekLabel
                : new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </span>
          </div>

          {weekView ? (
            <Button variant="outline" size="sm" onClick={() => { setCopyTargetWeek(nextWeekStart); setCopyDialogOpen(true); }}>
              Copy Week Forward
            </Button>
          ) : (
            <div className="flex gap-2">
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
            <div className="grid grid-cols-7 gap-2">
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

        {/* Create Leg Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create {pendingLegType}-Leg</DialogTitle>
              <DialogDescription>
                Schedule a {pendingLegType === "A" ? "pickup" : "return"} transport leg for {selectedDate}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div>
                <Label>Patient *</Label>
                <Select value={legForm.patient_id} onValueChange={(v) => {
                  const p = patients.find(pt => pt.id === v);
                  const inferredTripType = p?.transport_type === "outpatient" ? "outpatient" : "dialysis";
                  setLegForm(f => ({
                    ...f,
                    patient_id: v,
                    pickup_location: f.pickup_location || (pendingLegType === "A" ? (p?.pickup_address ?? "") : (p?.dropoff_facility ?? "")),
                    destination_location: f.destination_location || (pendingLegType === "A" ? (p?.dropoff_facility ?? "") : (p?.pickup_address ?? "")),
                    chair_time: f.chair_time || (p?.chair_time ?? ""),
                    estimated_duration_minutes: f.estimated_duration_minutes || (p?.run_duration_minutes?.toString() ?? ""),
                    trip_type: f.trip_type === "dialysis" ? inferredTripType : f.trip_type,
                  }));
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
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Pickup Time</Label><Input type="time" value={legForm.pickup_time} onChange={(e) => setLegForm(f => ({ ...f, pickup_time: e.target.value }))} /></div>
                <div><Label>Chair Time</Label><Input type="time" value={legForm.chair_time} onChange={(e) => setLegForm(f => ({ ...f, chair_time: e.target.value }))} /></div>
              </div>
              <div><Label>Pickup Location *</Label><Input value={legForm.pickup_location} onChange={(e) => setLegForm(f => ({ ...f, pickup_location: e.target.value }))} /></div>
              <div><Label>Destination *</Label><Input value={legForm.destination_location} onChange={(e) => setLegForm(f => ({ ...f, destination_location: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Trip Type</Label>
                  <Select value={legForm.trip_type} onValueChange={(v) => setLegForm(f => ({ ...f, trip_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dialysis">Dialysis</SelectItem>
                      <SelectItem value="discharge">Discharge</SelectItem>
                      <SelectItem value="hospital">Hospital</SelectItem>
                      <SelectItem value="outpatient">Outpatient</SelectItem>
                      <SelectItem value="private_pay">Private Pay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Est. Duration (min)</Label><Input type="number" value={legForm.estimated_duration_minutes} onChange={(e) => setLegForm(f => ({ ...f, estimated_duration_minutes: e.target.value }))} /></div>
              </div>
              <div><Label>Notes</Label><Textarea value={legForm.notes} onChange={(e) => setLegForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
              <Button onClick={handleCreate}>Create {pendingLegType}-Leg</Button>
            </div>
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
                <Label>Pickup Time</Label>
                <Input type="time" value={exceptionForm.pickup_time} onChange={(e) => setExceptionForm(f => ({ ...f, pickup_time: e.target.value }))} />
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
              <div className="flex gap-2">
                <Button onClick={handleSaveException} disabled={savingException} className="flex-1">
                  {savingException ? "Saving..." : "Save Exception"}
                </Button>
                {editingExceptionLeg?.has_exception && (
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
              <DialogTitle>Copy Week Forward</DialogTitle>
              <DialogDescription>
                Copy crew assignments from {weekLabel} to a target week. Existing assignments won't be overwritten.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div>
                <Label>Target Week (any date in that week)</Label>
                <Input type="date" value={copyTargetWeek} onChange={(e) => setCopyTargetWeek(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">After copying, use "Auto-Fill from Templates" on each day to generate patient legs.</p>
              <Button onClick={handleCopyWeek} disabled={copying}>
                {copying ? "Copying..." : "Copy Crew Assignments"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}


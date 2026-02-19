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
  Plus, Zap, AlertTriangle, Trash2, ArrowRight, Clock,
  Wand2, ChevronLeft, ChevronRight, CalendarDays, ArrowLeft,
  Pencil, GitBranch,
} from "lucide-react";
import { toast } from "sonner";
import { TruckBuilder } from "@/components/scheduling/TruckBuilder";
import { useSchedulingStore, type LegDisplay } from "@/hooks/useSchedulingStore";

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
  const [runPoolSearch, setRunPoolSearch] = useState("");

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
  const filteredUnassigned = runPoolSearch
    ? unassignedLegs.filter(l => l.patient_name.toLowerCase().includes(runPoolSearch.toLowerCase()))
    : unassignedLegs;

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
        ) : (
          /* DAILY DRILL-DOWN VIEW */
          <>
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

            {/* ── RUN POOL ── */}
            <section className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Run Pool
                  </h3>
                  <Badge variant="secondary" className="text-xs">
                    {unassignedLegs.length} unassigned
                  </Badge>
                </div>
                <Input
                  placeholder="Search by patient name..."
                  value={runPoolSearch}
                  onChange={(e) => setRunPoolSearch(e.target.value)}
                  className="h-8 max-w-[220px] text-xs"
                />
              </div>

              {filteredUnassigned.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">
                  {unassignedLegs.length === 0
                    ? "All legs are assigned to trucks — or use Auto-Fill to generate today's runs."
                    : "No legs match search."}
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredUnassigned.map((leg) => (
                    <RunPoolCard
                      key={leg.id}
                      leg={leg}
                      onDelete={() => deleteLeg(leg.id)}
                      onEditException={() => openExceptionEdit(leg)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* ── TRUCK BUILDER ── */}
            <TruckBuilder
              trucks={trucks}
              legs={legs}
              crews={crews}
              selectedDate={selectedDate}
              onRefresh={refresh}
              onEditException={openExceptionEdit}
              onDownCountChange={setDownTruckCount}
            />
          </>
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

/* ── Run Pool Card ── */
function RunPoolCard({
  leg, onDelete, onEditException,
}: {
  leg: LegDisplay;
  onDelete: () => void;
  onEditException: () => void;
}) {
  const isHeavy = (leg.patient_weight ?? 0) > 200;
  const isInactive = leg.patient_status !== "active";

  return (
    <div className={`rounded-lg border bg-card p-3 text-sm ${isInactive ? "opacity-60 border-dashed" : ""} ${leg.has_exception ? "border-primary/50" : ""}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            leg.leg_type === "A" ? "bg-primary/10 text-primary" : "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]"
          }`}>
            {leg.leg_type}-LEG
          </span>
          <span className="font-medium text-card-foreground">{leg.patient_name}</span>
          {isHeavy && <Zap className="h-3.5 w-3.5 text-[hsl(var(--status-yellow))]" aria-label="Electric stretcher required" />}
          {leg.has_exception && <GitBranch className="h-3 w-3 text-primary" aria-label="Has exception override for this date" />}
        </div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEditException} title="Edit this run only">
            <Pencil className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {leg.pickup_time && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{leg.pickup_time}</span>}
        <span className="truncate">{leg.pickup_location}</span>
        <ArrowRight className="h-3 w-3 shrink-0" />
        <span className="truncate">{leg.destination_location}</span>
      </div>
      {isHeavy && <p className="mt-1 text-[10px] font-semibold text-[hsl(var(--status-yellow))]">⚡ Electric stretcher required</p>}
      {isInactive && <p className="mt-1 text-[10px] font-semibold text-[hsl(var(--status-red))]">⚠ Patient is {leg.patient_status.replace("_", " ")}</p>}
      {leg.has_exception && <p className="mt-1 text-[10px] font-medium text-primary">✦ Exception override active for this date</p>}
    </div>
  );
}

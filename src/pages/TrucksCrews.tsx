import { useEffect, useState, useCallback, useMemo } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { getLocalToday } from "@/lib/local-date";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Truck, Pencil, Trash2, Check, X,
  ChevronLeft, ChevronRight, CalendarDays, Copy,
  WrenchIcon, AlertOctagon, Users,
} from "lucide-react";
import { toast } from "sonner";
import { PCRTooltip } from "@/components/pcr/PCRTooltip";
import { ADMIN_TOOLTIPS } from "@/lib/admin-tooltips";
import { useSchedulingStore } from "@/hooks/useSchedulingStore";
import type { Tables } from "@/integrations/supabase/types";

type TruckRow = Tables<"trucks">;

interface ProfileOption {
  id: string;
  full_name: string;
}

interface CrewRecord {
  id: string;
  truck_id: string;
  member1_id: string | null;
  member2_id: string | null;
  member3_id: string | null;
  member1_name: string | null;
  member2_name: string | null;
  member3_name: string | null;
  active_date: string;
}

interface AvailabilityRecord {
  id: string;
  truck_id: string;
  status: "down_maintenance" | "down_out_of_service";
  start_date: string;
  end_date: string;
  reason: string | null;
}

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

function getWeekLabel(weekDates: string[]): string {
  const start = new Date(weekDates[0] + "T12:00:00");
  const end = new Date(weekDates[6] + "T12:00:00");
  const mo = start.toLocaleString("default", { month: "short" });
  const mo2 = end.toLocaleString("default", { month: "short" });
  if (mo === mo2) return `${mo} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
  return `${mo} ${start.getDate()} – ${mo2} ${end.getDate()}, ${end.getFullYear()}`;
}

interface TruckDayCellProps {
  truck: TruckRow;
  date: string;
  crew: CrewRecord | undefined;
  downRecord: AvailabilityRecord | undefined;
  profiles: ProfileOption[];
  onAssign: (truckId: string, date: string, m1: string, m2: string, m3: string) => Promise<void>;
  onEdit: (crewId: string, m1: string, m2: string, m3: string) => Promise<void>;
  onClear: (crewId: string) => Promise<void>;
  onMarkDown: (truckId: string) => void;
  onRemoveDown: (availId: string) => Promise<void>;
}

function TruckDayCell({
  truck, date, crew, downRecord, profiles,
  onAssign, onEdit, onClear, onMarkDown, onRemoveDown,
}: TruckDayCellProps) {
  const [editing, setEditing] = useState(false);
  const [m1, setM1] = useState(crew?.member1_id ?? "");
  const [m2, setM2] = useState(crew?.member2_id ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setM1(crew?.member1_id ?? "");
    setM2(crew?.member2_id ?? "");
  }, [crew]);

  const isDown = !!downRecord;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (crew) {
        await onEdit(crew.id, m1, m2);
      } else {
        if (!m1 && !m2) { toast.error("Select at least one crew member"); return; }
        await onAssign(truck.id, date, m1, m2);
      }
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (isDown) {
    return (
      <div className="rounded border border-destructive/30 bg-destructive/5 p-2 text-center">
        <Badge variant="destructive" className="text-[9px] px-1 py-0 mb-1">
          {downRecord.status === "down_maintenance" ? "MAINT" : "OUT OF SVC"}
        </Badge>
        {downRecord.reason && (
          <p className="text-[10px] text-muted-foreground truncate">{downRecord.reason}</p>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-5 text-[10px] mt-1 text-muted-foreground hover:text-destructive px-1"
          onClick={() => onRemoveDown(downRecord.id)}
        >
          Remove
        </Button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="rounded border bg-card p-2 space-y-1.5">
        <Select value={m1} onValueChange={setM1}>
          <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Member 1" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— None —</SelectItem>
            {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={m2} onValueChange={setM2}>
          <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Member 2" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— None —</SelectItem>
            {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-1 pt-0.5">
          <Button size="sm" className="h-6 text-[10px] flex-1" onClick={handleSave} disabled={saving}>
            <Check className="h-3 w-3 mr-0.5" /> Save
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => { setEditing(false); setM1(crew?.member1_id ?? ""); setM2(crew?.member2_id ?? ""); }}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  if (crew) {
    return (
      <div className="rounded border bg-card p-2 group relative">
        <div className="flex items-center gap-1 text-[11px]">
          <Users className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="truncate text-card-foreground">{crew.member1_name ?? "—"}</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] mt-0.5">
          <span className="w-3 shrink-0" />
          <span className="truncate text-muted-foreground">{crew.member2_name ?? "—"}</span>
        </div>
        <div className="mt-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setEditing(true)} title="Edit crew">
            <Pencil className="h-2.5 w-2.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onClear(crew.id)} title="Clear assignment">
            <Trash2 className="h-2.5 w-2.5 text-destructive" />
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onMarkDown(truck.id)} title="Mark truck down">
            <WrenchIcon className="h-2.5 w-2.5 text-[hsl(var(--status-yellow))]" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded border border-dashed border-border bg-card/50 p-2 flex flex-col gap-1 items-center justify-center min-h-[56px]">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 text-[10px] text-muted-foreground w-full"
        onClick={() => setEditing(true)}
      >
        <Plus className="h-3 w-3 mr-0.5" /> Assign
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-5 text-[10px] text-muted-foreground/60 w-full"
        onClick={() => onMarkDown(truck.id)}
      >
        <WrenchIcon className="h-2.5 w-2.5 mr-0.5" /> Mark Down
      </Button>
    </div>
  );
}

export default function TrucksCrews() {
  const { refreshTrucks } = useSchedulingStore();
  const today = getLocalToday();

  const [trucks, setTrucks] = useState<TruckRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [crews, setCrews] = useState<CrewRecord[]>([]);
  const [availability, setAvailability] = useState<AvailabilityRecord[]>([]);

  // Week navigation
  const [currentWeekRef, setCurrentWeekRef] = useState(today);
  const weekDates = useMemo(() => getWeekDates(currentWeekRef), [currentWeekRef]);

  // Dialogs
  const [truckDialog, setTruckDialog] = useState(false);
  const [truckName, setTruckName] = useState("");
  const [truckVehicleId, setTruckVehicleId] = useState("");
  const [savingTruck, setSavingTruck] = useState(false);
  const [editingTruckId, setEditingTruckId] = useState<string | null>(null);
  const [editingTruckName, setEditingTruckName] = useState("");
  const [editingTruckVehicleId, setEditingTruckVehicleId] = useState("");

  // Mark Down dialog
  const [downDialog, setDownDialog] = useState(false);
  const [downTruckId, setDownTruckId] = useState<string | null>(null);
  const [downForm, setDownForm] = useState({
    status: "down_maintenance" as "down_maintenance" | "down_out_of_service",
    start_date: today,
    end_date: today,
    reason: "",
  });

  // Copy week dialog
  const [copyDialog, setCopyDialog] = useState(false);
  const [copyTargetWeek, setCopyTargetWeek] = useState("");
  const [copying, setCopying] = useState(false);

  const fetchAll = useCallback(async () => {
    const startDate = weekDates[0];
    const endDate = weekDates[6];

    // Get company_id first to scope employee dropdown
    const { data: companyId } = await supabase.rpc("get_my_company_id");

    const [{ data: t }, { data: p }, { data: c }, { data: av }] = await Promise.all([
      supabase.from("trucks").select("*").eq("company_id", companyId).order("name"),
      supabase.from("profiles").select("id, full_name").eq("active", true).eq("company_id", companyId).order("full_name"),
      supabase.from("crews")
        .select("*, member1:profiles!crews_member1_id_fkey(full_name, id), member2:profiles!crews_member2_id_fkey(full_name, id)")
        .eq("company_id", companyId)
        .gte("active_date", startDate)
        .lte("active_date", endDate),
      supabase.from("truck_availability" as any)
        .select("*")
        .eq("company_id", companyId)
        .or(`start_date.lte.${endDate},end_date.gte.${startDate}`),
    ]);

    setTrucks(t ?? []);
    setProfiles(p ?? []);
    setCrews((c ?? []).map((cr: any) => ({
      id: cr.id,
      truck_id: cr.truck_id,
      member1_id: cr.member1_id ?? null,
      member2_id: cr.member2_id ?? null,
      member1_name: cr.member1?.full_name ?? null,
      member2_name: cr.member2?.full_name ?? null,
      active_date: cr.active_date,
    })));
    setAvailability((av ?? []) as unknown as AvailabilityRecord[]);
  }, [weekDates[0]]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const navigateWeek = (dir: number) => {
    const d = new Date(currentWeekRef + "T12:00:00");
    d.setDate(d.getDate() + dir * 7);
    setCurrentWeekRef(d.toISOString().split("T")[0]);
  };

  const goToToday = () => setCurrentWeekRef(today);

  // Truck CRUD
  const addTruck = async () => {
    if (!truckName.trim() || savingTruck) return;
    setSavingTruck(true);
    try {
      const { data: companyData } = await supabase.rpc("get_my_company_id");
      const { error } = await supabase.from("trucks").insert({ name: truckName.trim(), company_id: companyData, vehicle_id: truckVehicleId.trim() || null } as any);
      if (error) { toast.error("Failed to add truck"); return; }
      setTruckName(""); setTruckVehicleId(""); setTruckDialog(false);
      toast.success("Truck added"); fetchAll(); refreshTrucks();
    } finally {
      setSavingTruck(false);
    }
  };

  const saveTruckEdit = async (id: string) => {
    const trimmed = editingTruckName.trim();
    if (!trimmed) { toast.error("Name cannot be empty"); return; }
    const { error } = await supabase.from("trucks").update({ name: trimmed, vehicle_id: editingTruckVehicleId.trim() || null } as any).eq("id", id);
    if (error) { toast.error("Failed to update truck"); return; }
    setEditingTruckId(null);
    toast.success("Truck updated"); fetchAll(); refreshTrucks();
  };

  const [deleteTruckId, setDeleteTruckId] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);

  const confirmDeleteTruck = (id: string) => {
    setDeleteTruckId(id);
    setDeleteDialog(true);
  };

  const deleteTruck = async () => {
    if (!deleteTruckId) return;

    // Prune this truck's ID from any saved template mappings so templates stay clean.
    // (Cascade on the FK handles truck_run_slots, crews, availability, share tokens automatically.)
    const { data: templates } = await supabase
      .from("truck_builder_templates" as any)
      .select("id, mapping");
    if (templates && templates.length > 0) {
      await Promise.all(
        (templates as any[])
          .filter((t: any) => Array.isArray(t.mapping) && t.mapping.some((r: any) => r.truck_id === deleteTruckId))
          .map((t: any) =>
            supabase
              .from("truck_builder_templates" as any)
              .update({ mapping: t.mapping.filter((r: any) => r.truck_id !== deleteTruckId) })
              .eq("id", t.id)
          )
      );
    }

    const { error } = await supabase.from("trucks").delete().eq("id", deleteTruckId);
    if (error) { toast.error("Failed to delete truck"); return; }
    toast.success("Truck deleted — crew assignments, run slots, and availability records removed");
    setDeleteDialog(false);
    setDeleteTruckId(null);
    fetchAll();
    refreshTrucks();
  };

  // Crew CRUD
  const assignCrew = async (truckId: string, date: string, m1: string, m2: string) => {
    const m1Val = m1 === "none" || !m1 ? null : m1;
    const m2Val = m2 === "none" || !m2 ? null : m2;

    if (!m1Val && !m2Val) {
      toast.error("Select at least one crew member");
      return;
    }

    // Use server-side atomic crew assignment with conflict detection
    const { data: result, error } = await supabase.rpc("safe_assign_crew", {
      p_truck_id: truckId,
      p_active_date: date,
      p_member1_id: m1Val,
      p_member2_id: m2Val,
    });

    if (error) { toast.error("Failed to assign crew"); return; }
    const res = result as any;
    if (!res?.ok) {
      toast.error(res?.error ?? "Crew assignment conflict detected. Refresh and try again.");
      fetchAll();
      return;
    }
    toast.success("Crew assigned"); fetchAll();
  };

  const editCrew = async (crewId: string, m1: string, m2: string) => {
    const m1Val = m1 === "none" || !m1 ? null : m1;
    const m2Val = m2 === "none" || !m2 ? null : m2;

    // Prevent assigning the same person to both slots
    if (m1Val && m2Val && m1Val === m2Val) {
      toast.error("Cannot assign the same employee to both crew slots");
      return;
    }

    // Prevent assigning someone already on another truck for this date
    const crew = crews.find((c) => c.id === crewId);
    if (crew) {
      const membersToCheck = [m1Val, m2Val].filter(Boolean) as string[];
      for (const memberId of membersToCheck) {
        const existing = crews.find(
          (c) => c.active_date === crew.active_date && c.id !== crewId &&
            (c.member1_id === memberId || c.member2_id === memberId)
        );
        if (existing) {
          const memberName = profiles.find((p) => p.id === memberId)?.full_name ?? "This employee";
          const otherTruck = trucks.find((t) => t.id === existing.truck_id)?.name ?? "another truck";
          toast.error(`${memberName} is already assigned to ${otherTruck} on this date`);
          return;
        }
      }
    }

    const { error } = await supabase.from("crews").update({
      member1_id: m1Val,
      member2_id: m2Val,
    } as any).eq("id", crewId);
    if (error) { toast.error("Failed to update crew"); return; }
    toast.success("Crew updated"); fetchAll();
  };

  const clearCrew = async (crewId: string) => {
    await supabase.from("crews").delete().eq("id", crewId);
    toast.success("Crew assignment cleared"); fetchAll();
  };

  // Down / availability
  const openMarkDown = (truckId: string) => {
    setDownTruckId(truckId);
    setDownForm({ status: "down_maintenance", start_date: today, end_date: today, reason: "" });
    setDownDialog(true);
  };

  const saveDown = async () => {
    if (!downTruckId) return;
    if (downForm.end_date < downForm.start_date) {
      toast.error("End date must be on or after start date"); return;
    }
    const { data: companyId } = await supabase.rpc("get_my_company_id");
    const { error } = await supabase.from("truck_availability" as any).insert({
      truck_id: downTruckId,
      status: downForm.status,
      start_date: downForm.start_date,
      end_date: downForm.end_date,
      reason: downForm.reason || null,
      company_id: companyId,
    });
    if (error) { toast.error("Failed to mark truck down"); return; }
    toast.success("Truck marked as down"); setDownDialog(false); fetchAll();
  };

  const removeDown = async (availId: string) => {
    await supabase.from("truck_availability" as any).delete().eq("id", availId);
    toast.success("Truck availability restored"); fetchAll();
  };

  // Copy week forward
  const copyWeekForward = async () => {
    if (!copyTargetWeek) { toast.error("Select a target week start"); return; }
    setCopying(true);
    try {
      const targetDates = getWeekDates(copyTargetWeek);
      const { data: existingCrews } = await supabase
        .from("crews").select("active_date, truck_id")
        .gte("active_date", targetDates[0]).lte("active_date", targetDates[6]);
      const existingKeys = new Set((existingCrews ?? []).map((c) => `${c.active_date}_${c.truck_id}`));
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      const newCrews: any[] = [];
      for (const crew of crews) {
        const srcIdx = weekDates.indexOf(crew.active_date);
        if (srcIdx === -1) continue;
        const targetDate = targetDates[srcIdx];
        const key = `${targetDate}_${crew.truck_id}`;
        if (existingKeys.has(key)) continue;
        newCrews.push({ truck_id: crew.truck_id, member1_id: crew.member1_id, member2_id: crew.member2_id, active_date: targetDate, company_id: companyId });
      }
      if (newCrews.length > 0) await supabase.from("crews").insert(newCrews);
      toast.success(`Copied ${newCrews.length} crew assignment(s) to target week.`);
      setCopyDialog(false); setCopyTargetWeek("");
    } catch { toast.error("Failed to copy week"); }
    finally { setCopying(false); }
  };

  // Helper: get down record for a truck on a given date
  const getDownRecord = (truckId: string, date: string): AvailabilityRecord | undefined =>
    availability.find(
      (a) => a.truck_id === truckId && date >= a.start_date && date <= a.end_date
    );

  // Helper: get crew for a truck on a given date
  const getCrewForDate = (truckId: string, date: string): CrewRecord | undefined =>
    crews.find((c) => c.truck_id === truckId && c.active_date === date);

  const nextWeekStart = (() => {
    const d = new Date(weekDates[6] + "T12:00:00");
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  })();

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* ── FLEET SECTION ── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Fleet</h3>
            <Dialog open={truckDialog} onOpenChange={setTruckDialog}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1.5 h-3.5 w-3.5" /> Add Truck</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
                <DialogHeader><DialogTitle>Add Truck</DialogTitle><DialogDescription>Add a new truck to your fleet.</DialogDescription></DialogHeader>
                <div className="space-y-3 py-2">
                  <div><Label>Truck Name/Number<PCRTooltip text={ADMIN_TOOLTIPS.truck_name} /></Label>
                    <Input value={truckName} onChange={(e) => setTruckName(e.target.value)} placeholder="e.g. Truck 1" onKeyDown={(e) => e.key === "Enter" && addTruck()} />
                  </div>
                  <div><Label>Vehicle ID / Unit #<PCRTooltip text={ADMIN_TOOLTIPS.vehicle_id} /></Label>
                    <Input value={truckVehicleId} onChange={(e) => setTruckVehicleId(e.target.value)} placeholder="e.g. G7T-101" onKeyDown={(e) => e.key === "Enter" && addTruck()} />
                  </div>
                  <Button onClick={addTruck} className="w-full" disabled={savingTruck}>
                    {savingTruck ? "Adding..." : "Add Truck"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trucks.map((t) => (
              <div key={t.id} className="rounded-lg border bg-card p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-primary shrink-0" />
                  {editingTruckId === t.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input className="h-7 text-sm flex-1" value={editingTruckName}
                        onChange={(e) => setEditingTruckName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveTruckEdit(t.id); if (e.key === "Escape") setEditingTruckId(null); }}
                        placeholder="Truck name"
                        autoFocus />
                      <Input className="h-7 text-sm w-24" value={editingTruckVehicleId}
                        onChange={(e) => setEditingTruckVehicleId(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveTruckEdit(t.id); if (e.key === "Escape") setEditingTruckId(null); }}
                        placeholder="Unit #" />
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => saveTruckEdit(t.id)}><Check className="h-3 w-3 text-[hsl(var(--status-green))]" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingTruckId(null)}><X className="h-3 w-3" /></Button>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium text-card-foreground flex-1 truncate">{t.name}</span>
                      {(t as any).vehicle_id && <span className="text-[10px] text-muted-foreground shrink-0">#{(t as any).vehicle_id}</span>}
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => { setEditingTruckId(t.id); setEditingTruckName(t.name); setEditingTruckVehicleId((t as any).vehicle_id ?? ""); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => confirmDeleteTruck(t.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
                {/* Equipment flags */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground pl-6">
                  {[
                    { key: "has_power_stretcher", label: "Power Stretcher / Bariatric", tooltip: ADMIN_TOOLTIPS.power_stretcher },
                    { key: "has_stair_chair", label: "Stair Chair", tooltip: ADMIN_TOOLTIPS.stair_chair_equip },
                    { key: "has_oxygen_mount", label: "Oxygen Mount", tooltip: ADMIN_TOOLTIPS.oxygen_mount },
                  ].map(({ key, label, tooltip }) => (
                    <label key={key} className="flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-border accent-primary"
                        checked={(t as any)[key] ?? false}
                        onChange={async (e) => {
                          // Power stretcher = bariatric capable; sync all related flags
                          const updates: Record<string, boolean> = { [key]: e.target.checked };
                          if (key === "has_power_stretcher") {
                            updates.has_bariatric_kit = e.target.checked;
                            updates.has_bariatric_stretcher = e.target.checked;
                          }
                          const { error } = await supabase.from("trucks").update(updates as any).eq("id", t.id);
                          if (error) { toast.error("Failed to update equipment"); return; }
                          fetchAll();
                          refreshTrucks();
                        }}
                      />
                      {label}<PCRTooltip text={tooltip} />
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {trucks.length === 0 && <p className="text-sm text-muted-foreground col-span-full">No trucks yet</p>}
          </div>
        </section>

        {/* ── WEEKLY CREW CALENDAR ── */}
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Weekly Crew Assignments</h3>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigateWeek(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={goToToday}><CalendarDays className="mr-1.5 h-3.5 w-3.5" /> Today</Button>
              <Button variant="outline" size="icon" onClick={() => navigateWeek(1)}><ChevronRight className="h-4 w-4" /></Button>
              <span className="text-sm font-semibold text-foreground">{getWeekLabel(weekDates)}</span>
              <Button variant="outline" size="sm" onClick={() => { setCopyTargetWeek(nextWeekStart); setCopyDialog(true); }}>
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy Week
              </Button>
            </div>
          </div>

          {/* Legend */}
          <div className="mb-3 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><WrenchIcon className="h-3 w-3 text-[hsl(var(--status-yellow))]" /> Hover a cell to assign or mark down</span>
            <span className="flex items-center gap-1"><AlertOctagon className="h-3 w-3 text-destructive" /> Red = truck is down (crew cannot be assigned)</span>
          </div>

          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b">
                  <th className="w-28 px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">Truck</th>
                  {weekDates.map((date, idx) => {
                    const isToday = date === today;
                    return (
                      <th key={date} className={`px-2 py-2 text-center text-xs font-semibold ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                        <div className="uppercase">{DAY_LABELS[idx]}</div>
                        <div className={`text-base font-bold ${isToday ? "text-primary" : "text-foreground"}`}>{formatShortDate(date)}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {trucks.map((truck, tIdx) => (
                  <tr key={truck.id} className={tIdx % 2 === 0 ? "bg-background/30" : ""}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium text-card-foreground truncate max-w-[80px]">{truck.name}</span>
                      </div>
                    </td>
                    {weekDates.map((date) => {
                      const crew = getCrewForDate(truck.id, date);
                      const downRecord = getDownRecord(truck.id, date);
                      const isToday = date === today;
                      return (
                        <td key={date} className={`px-1.5 py-1.5 min-w-[110px] ${isToday ? "bg-primary/5" : ""}`}>
                          <TruckDayCell
                            truck={truck}
                            date={date}
                            crew={crew}
                            downRecord={downRecord}
                            profiles={profiles}
                            onAssign={assignCrew}
                            onEdit={editCrew}
                            onClear={clearCrew}
                            onMarkDown={openMarkDown}
                            onRemoveDown={removeDown}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {trucks.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">No trucks in fleet. Add trucks above.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Mark Down Dialog */}
        <Dialog open={downDialog} onOpenChange={setDownDialog}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <WrenchIcon className="h-4 w-4 text-destructive" /> Mark Truck as Down
              </DialogTitle>
              <DialogDescription>
                {downTruckId && trucks.find(t => t.id === downTruckId)?.name} will be blocked from crew assignment during this period.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label>Status</Label>
                <Select value={downForm.status} onValueChange={(v) => setDownForm((f) => ({ ...f, status: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="down_maintenance">Down – Maintenance</SelectItem>
                    <SelectItem value="down_out_of_service">Down – Out of Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>From Date</Label>
                  <Input type="date" value={downForm.start_date} onChange={(e) => setDownForm((f) => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div><Label>To Date</Label>
                  <Input type="date" value={downForm.end_date} onChange={(e) => setDownForm((f) => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Reason (optional)</Label>
                <Textarea value={downForm.reason} onChange={(e) => setDownForm((f) => ({ ...f, reason: e.target.value }))} placeholder="e.g. Brake inspection" rows={2} />
              </div>
              <Button onClick={saveDown} className="w-full" variant="destructive">
                <WrenchIcon className="mr-1.5 h-4 w-4" /> Confirm – Mark Down
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Copy Week Dialog */}
        <Dialog open={copyDialog} onOpenChange={setCopyDialog}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Copy Week Schedule</DialogTitle>
              <DialogDescription>
                Duplicate crew assignments from one week to another. Existing assignments on the target week will not be overwritten.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="rounded-md border bg-muted/30 p-3">
                <Label className="text-xs text-muted-foreground">Source Week (copying from)</Label>
                <p className="text-sm font-semibold text-foreground mt-1">{getWeekLabel(weekDates)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {crews.length} crew assignment{crews.length !== 1 ? "s" : ""} on this week
                </p>
              </div>
              <div>
                <Label>Destination Week (pick any date in the target week)</Label>
                <Input type="date" value={copyTargetWeek} onChange={(e) => setCopyTargetWeek(e.target.value)} />
                {copyTargetWeek && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Target: <strong>{getWeekLabel(getWeekDates(copyTargetWeek))}</strong>
                  </p>
                )}
              </div>
              <Button onClick={copyWeekForward} disabled={copying || !copyTargetWeek} className="w-full">
                <Copy className="mr-1.5 h-4 w-4" /> {copying ? "Copying..." : "Copy Assignments"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Truck Confirmation Dialog */}
        <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Truck</DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Are you sure you want to permanently delete{" "}
                    <strong className="text-foreground">{trucks.find(t => t.id === deleteTruckId)?.name}</strong>?
                  </p>
                  <p>This will also remove:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-xs">
                    <li>All crew assignments for this truck</li>
                    <li>All run slot assignments (scheduling)</li>
                    <li>All maintenance / availability records</li>
                    <li>All crew share links for this truck</li>
                    <li>This truck from any saved default setup templates</li>
                  </ul>
                  <p className="text-destructive/80 text-xs font-medium">This action cannot be undone.</p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteDialog(false)}>Cancel</Button>
              <Button variant="destructive" className="flex-1" onClick={deleteTruck}>
                <Trash2 className="mr-1.5 h-4 w-4" /> Delete Truck
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

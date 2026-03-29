import { useEffect, useState, useMemo } from "react";
import { format, addDays, differenceInDays, parseISO } from "date-fns";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Pencil, Trash2, Zap, Clock, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PCRTooltip } from "@/components/pcr/PCRTooltip";
import { ADMIN_TOOLTIPS } from "@/lib/admin-tooltips";
import { toast } from "sonner";
import type { Tables, Database } from "@/integrations/supabase/types";
import { PatientStatusBadge } from "@/components/patients/PatientStatusBadge";
import { FacilityDropdown } from "@/components/patients/FacilityDropdown";
import { FacilitySelect } from "@/components/patients/FacilitySelect";
import { getEarliestBLegPickup, isBLegTooEarly } from "@/lib/dialysis-validation";

type Patient = Tables<"patients">;
type PatientStatus = Database["public"]["Enums"]["patient_status"];

const STATUS_OPTIONS: { value: PatientStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "in_hospital", label: "In Hospital" },
  { value: "out_of_hospital", label: "Out of Hospital" },
  { value: "vacation", label: "Vacation" },
  { value: "paused", label: "Paused" },
];

const SCHEDULE_DAY_OPTIONS = [
  { value: "MWF", label: "Mon / Wed / Fri", days: [1, 3, 5] },
  { value: "TTS", label: "Tue / Thu / Sat", days: [2, 4, 6] },
];

const CUSTOM_DAY_OPTIONS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

type TransportType = "dialysis" | "outpatient" | "private_pay";

const TRANSPORT_TYPE_OPTIONS: { value: TransportType; label: string }[] = [
  { value: "dialysis", label: "Dialysis" },
  { value: "outpatient", label: "Outpatient / Wound Care" },
  { value: "private_pay", label: "Private Pay" },
];

export default function Patients() {
  const { activeCompanyId } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);

  // Selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Single-delete state
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk-delete state
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bLegWarnings, setBLegWarnings] = useState<{ pickup_time: string; run_date: string; earliest: string }[]>([]);

  const [form, setForm] = useState({
    first_name: "", last_name: "", dob: "", phone: "", sex: "",
    pickup_address: "", dropoff_facility: "", chair_time: "",
    run_duration_minutes: "", schedule_days: "" as string,
    weight_lbs: "", notes: "", status: "active" as PatientStatus,
    transport_type: "dialysis" as TransportType,
    recurrence_start_date: "", recurrence_end_date: "",
    no_end_date: true,
    mobility: "ambulatory", oxygen_required: false, bariatric: false,
    standing_order: false, special_handling: "",
    primary_payer: "", secondary_payer: "", member_id: "", secondary_member_id: "",
    auth_required: false, auth_expiration: "", trips_per_week_limit: "",
    // New operational needs
    stairs_required: "unknown", stair_chair_required: false,
    oxygen_lpm: "", special_equipment_required: "none",
    dialysis_window_minutes: "45", must_arrive_by: "",
    // Custom recurrence days for outpatient/wound care
    recurrence_days: [] as number[],
    // Location type & facility link
    location_type: "",
    facility_id: "",
    // Chair time duration (hours + minutes)
    chair_time_duration_hours: "0",
    chair_time_duration_minutes: "0",
    // A-leg pickup time
    a_leg_pickup_time: "",
    // Compliance & Authorization
    pcs_on_file: false,
    pcs_signed_date: "",
    pcs_expiration_date: "",
    prior_auth_on_file: false,
    prior_auth_number: "",
    prior_auth_expiration: "",
  });

  const fetchPatients = async () => {
    const { data } = await supabase.from("patients").select("*").order("last_name");
    setPatients(data ?? []);
  };

  useEffect(() => { fetchPatients(); }, [activeCompanyId]);

  const resetForm = () => {
    setForm({
      first_name: "", last_name: "", dob: "", phone: "", sex: "",
      pickup_address: "", dropoff_facility: "", chair_time: "",
      run_duration_minutes: "", schedule_days: "", weight_lbs: "",
      notes: "", status: "active",
      transport_type: "dialysis",
      recurrence_start_date: "", recurrence_end_date: "",
      no_end_date: true,
      mobility: "ambulatory", oxygen_required: false, bariatric: false,
      standing_order: false, special_handling: "",
      primary_payer: "", secondary_payer: "", member_id: "", secondary_member_id: "",
      auth_required: false, auth_expiration: "", trips_per_week_limit: "",
      stairs_required: "unknown", stair_chair_required: false,
      oxygen_lpm: "", special_equipment_required: "none",
      dialysis_window_minutes: "45", must_arrive_by: "",
      recurrence_days: [],
      location_type: "",
      facility_id: "",
      chair_time_duration_hours: "0",
      chair_time_duration_minutes: "0",
      a_leg_pickup_time: "",
    });
    setEditing(null);
    setBLegWarnings([]);
  };

  const openEdit = (p: Patient) => {
    setEditing(p);
    const endDate = (p as any).recurrence_end_date ?? "";
    // Auto-convert legacy dialysis_window_minutes to hours+minutes
    const legacyDwm = (p as any).dialysis_window_minutes ?? 45;
    const existingH = (p as any).chair_time_duration_hours;
    const existingM = (p as any).chair_time_duration_minutes;
    const hasNewFields = (existingH != null && existingH > 0) || (existingM != null && existingM > 0);
    const durH = hasNewFields ? String(existingH ?? 0) : String(Math.floor(legacyDwm / 60));
    const durM = hasNewFields ? String(existingM ?? 0) : String(legacyDwm % 60);
    setForm({
      first_name: p.first_name, last_name: p.last_name,
      dob: p.dob ?? "", phone: p.phone ?? "", sex: (p as any).sex ?? "",
      pickup_address: p.pickup_address ?? "", dropoff_facility: p.dropoff_facility ?? "",
      chair_time: p.chair_time ?? "", run_duration_minutes: p.run_duration_minutes?.toString() ?? "",
      schedule_days: p.schedule_days ?? "", weight_lbs: p.weight_lbs?.toString() ?? "",
      notes: p.notes ?? "", status: (p as any).status ?? "active",
      transport_type: ((p as any).transport_type ?? "dialysis") as TransportType,
      recurrence_start_date: (p as any).recurrence_start_date ?? "",
      recurrence_end_date: endDate,
      no_end_date: !endDate,
      mobility: (p as any).mobility ?? "ambulatory",
      oxygen_required: (p as any).oxygen_required ?? false,
      bariatric: (p as any).bariatric ?? false,
      standing_order: (p as any).standing_order ?? false,
      special_handling: (p as any).special_handling ?? "",
      primary_payer: (p as any).primary_payer ?? "",
      secondary_payer: (p as any).secondary_payer ?? "",
      member_id: (p as any).member_id ?? "",
      secondary_member_id: (p as any).secondary_member_id ?? "",
      auth_required: (p as any).auth_required ?? false,
      auth_expiration: (p as any).auth_expiration ?? "",
      trips_per_week_limit: (p as any).trips_per_week_limit?.toString() ?? "",
      stairs_required: (p as any).stairs_required ?? "unknown",
      stair_chair_required: (p as any).stair_chair_required ?? false,
      oxygen_lpm: (p as any).oxygen_lpm?.toString() ?? "",
      special_equipment_required: (p as any).special_equipment_required ?? "none",
      dialysis_window_minutes: (p as any).dialysis_window_minutes?.toString() ?? "45",
      must_arrive_by: (p as any).must_arrive_by ?? "",
      recurrence_days: (p as any).recurrence_days ?? [],
      location_type: (p as any).location_type ?? "",
      facility_id: (p as any).facility_id ?? "",
      chair_time_duration_hours: durH,
      chair_time_duration_minutes: durM,
      a_leg_pickup_time: (p as any).a_leg_pickup_time ?? "",
    });
    setBLegWarnings([]);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload: any = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      dob: form.dob || null,
      phone: form.phone || null,
      sex: form.sex || null,
      pickup_address: form.pickup_address || null,
      dropoff_facility: form.dropoff_facility || null,
      chair_time: form.chair_time || null,
      run_duration_minutes: form.run_duration_minutes ? parseInt(form.run_duration_minutes) : null,
      schedule_days: (form.schedule_days || null) as "MWF" | "TTS" | null,
      weight_lbs: form.weight_lbs ? parseInt(form.weight_lbs) : null,
      notes: form.notes || null,
      status: form.status,
      transport_type: form.transport_type,
      recurrence_start_date: form.recurrence_start_date || null,
      recurrence_end_date: form.no_end_date ? null : (form.recurrence_end_date || null),
      // New insurance & transport fields
      mobility: form.mobility,
      oxygen_required: form.oxygen_required,
      bariatric: form.bariatric,
      standing_order: form.standing_order,
      special_handling: form.special_handling || null,
      primary_payer: form.primary_payer || null,
      secondary_payer: form.secondary_payer || null,
      member_id: form.member_id || null,
      secondary_member_id: form.secondary_member_id || null,
      auth_required: form.auth_required,
      auth_expiration: form.auth_expiration || null,
      trips_per_week_limit: form.trips_per_week_limit ? parseInt(form.trips_per_week_limit) : null,
      // New operational needs
      stairs_required: form.stairs_required,
      stair_chair_required: form.stair_chair_required,
      oxygen_lpm: form.oxygen_lpm ? parseFloat(form.oxygen_lpm) : null,
      special_equipment_required: form.special_equipment_required,
      dialysis_window_minutes: form.dialysis_window_minutes ? parseInt(form.dialysis_window_minutes) : 45,
      
      recurrence_days: form.recurrence_days.length > 0 ? form.recurrence_days : null,
      location_type: form.location_type || null,
      facility_id: form.facility_id || null,
      chair_time_duration_hours: parseInt(form.chair_time_duration_hours) || 0,
      chair_time_duration_minutes: parseInt(form.chair_time_duration_minutes) || 0,
      a_leg_pickup_time: form.a_leg_pickup_time || null,
    };

    if (!payload.first_name || !payload.last_name) return;

    if (editing) {
      await supabase.from("patients").update(payload).eq("id", editing.id);

      // Propagate changes to future recurring scheduling legs
      const today = new Date().toISOString().split("T")[0];
      let propagatedCount = 0;

      // A-leg propagation
      const aLegPayload: any = {
        pickup_location: payload.pickup_address ?? null,
        destination_location: payload.dropoff_facility ?? null,
        chair_time: payload.chair_time ?? null,
        estimated_duration_minutes: payload.transport_type === "dialysis"
          ? (payload.chair_time_duration_hours ?? 0) * 60 + (payload.chair_time_duration_minutes ?? 0)
          : payload.run_duration_minutes ?? null,
      };
      const { data: aData } = await supabase
        .from("scheduling_legs")
        .update(aLegPayload)
        .eq("patient_id", editing.id)
        .eq("is_oneoff", false)
        .eq("leg_type", "a_leg" as any)
        .gte("run_date", today)
        .select("id");
      const aCount = aData?.length ?? 0;
      propagatedCount += aCount ?? 0;

      // B-leg propagation
      const bLegPayload: any = {
        pickup_location: payload.dropoff_facility ?? null,
        destination_location: payload.pickup_address ?? null,
        estimated_duration_minutes: payload.transport_type === "dialysis"
          ? (payload.chair_time_duration_hours ?? 0) * 60 + (payload.chair_time_duration_minutes ?? 0)
          : payload.run_duration_minutes ?? null,
      };
      const { data: bData } = await supabase
        .from("scheduling_legs")
        .update(bLegPayload)
        .eq("patient_id", editing.id)
        .eq("is_oneoff", false)
        .eq("leg_type", "b_leg" as any)
        .gte("run_date", today)
        .select("id");
      const bCount = bData?.length ?? 0;
      propagatedCount += bCount ?? 0;

      if (propagatedCount > 0) {
        toast.success(`Patient updated — ${propagatedCount} future runs updated automatically.`);
      } else {
        toast.success("Patient updated");
      }

      // Check for B-leg conflicts after saving chair time changes
      if (form.transport_type === "dialysis" && form.chair_time) {
        const durH = parseInt(form.chair_time_duration_hours) || 0;
        const durM = parseInt(form.chair_time_duration_minutes) || 0;
        if (durH > 0 || durM > 0) {
          const { data: bLegs } = await supabase
            .from("scheduling_legs")
            .select("pickup_time, run_date")
            .eq("patient_id", editing.id)
            .eq("leg_type", "b_leg" as any)
            .gte("run_date", today);
          const warnings: typeof bLegWarnings = [];
          for (const leg of bLegs ?? []) {
            if (leg.pickup_time && isBLegTooEarly(leg.pickup_time, form.chair_time, durH, durM)) {
              const earliest = getEarliestBLegPickup(form.chair_time, durH, durM);
              if (earliest) warnings.push({ pickup_time: leg.pickup_time, run_date: leg.run_date, earliest });
            }
          }
          setBLegWarnings(warnings);
        }
      }
    } else {
      payload.company_id = activeCompanyId;
      await supabase.from("patients").insert(payload);
      toast.success("Patient added");
    }

    setDialogOpen(false);
    resetForm();
    fetchPatients();
  };

  // ── Single delete ──
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("patients").delete().eq("id", deleteTarget.id);
    if (error) {
      toast.error("Failed to delete patient");
    } else {
      toast.success(`${deleteTarget.first_name} ${deleteTarget.last_name} deleted`);
      setDeleteTarget(null);
      setSelected((prev) => { const n = new Set(prev); n.delete(deleteTarget.id); return n; });
      fetchPatients();
    }
    setDeleting(false);
  };

  // ── Bulk delete ──
  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    const ids = Array.from(selected);
    const { error } = await supabase.from("patients").delete().in("id", ids);
    if (error) {
      toast.error("Failed to delete patients");
    } else {
      toast.success(`${ids.length} patient${ids.length > 1 ? "s" : ""} deleted`);
      setSelected(new Set());
      setBulkDeleteOpen(false);
      fetchPatients();
    }
    setBulkDeleting(false);
  };

  // ── Selection helpers ──
  const filtered = patients.filter((p) => {
    const q = search.toLowerCase();
    const nameMatch = `${p.first_name} ${p.last_name}`.toLowerCase().includes(q);
    const statusMatch = statusFilter === "all" || (p as any).status === statusFilter;
    return nameMatch && statusMatch;
  });

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const someSelected = selected.size > 0;

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const n = new Set(prev);
        filtered.forEach((p) => n.delete(p.id));
        return n;
      });
    } else {
      setSelected((prev) => {
        const n = new Set(prev);
        filtered.forEach((p) => n.add(p.id));
        return n;
      });
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  // All transport types on patient form are repetitive
  const isRepetitive = true;

  // Compute B-leg earliest for display in recurrence section
  const bLegEarliestDisplay = form.transport_type === "dialysis" && form.chair_time
    ? getEarliestBLegPickup(form.chair_time, parseInt(form.chair_time_duration_hours) || 0, parseInt(form.chair_time_duration_minutes) || 0)
    : null;

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-sm min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search patients..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            {someSelected && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkDeleteOpen(true)}
                className="gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete {selected.size} selected
              </Button>
            )}
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-1.5 h-4 w-4" /> Add Patient</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit Patient" : "Add Patient"}</DialogTitle>
                  <DialogDescription>Enter patient details including contact info, addresses, and recurring transport schedule.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">

                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>First Name *<PCRTooltip text={ADMIN_TOOLTIPS.first_name} /></Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
                    <div><Label>Last Name *<PCRTooltip text={ADMIN_TOOLTIPS.last_name} /></Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>DOB<PCRTooltip text={ADMIN_TOOLTIPS.dob} /></Label><Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></div>
                    <div><Label>Phone<PCRTooltip text={ADMIN_TOOLTIPS.phone} /></Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  </div>
                  <div>
                    <Label>Sex<PCRTooltip text="Patient biological sex — required for Medicare claim demographics." /></Label>
                    <div className="flex gap-2 mt-1.5">
                      {([{ value: "M", label: "Male" }, { value: "F", label: "Female" }, { value: "U", label: "Unknown" }] as const).map((opt) => (
                        <label key={opt.value} className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs cursor-pointer transition-colors ${form.sex === opt.value ? "border-primary bg-primary/5 font-medium" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                          <input type="radio" name="patient-sex" className="sr-only" checked={form.sex === opt.value} onChange={() => setForm({ ...form, sex: opt.value })} />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div><Label>Pickup Address<PCRTooltip text={ADMIN_TOOLTIPS.pickup_address} /></Label><Input value={form.pickup_address} onChange={(e) => setForm({ ...form, pickup_address: e.target.value })} /></div>

                  {/* Home Location Type */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Home Location Type<PCRTooltip text={ADMIN_TOOLTIPS.location_type} /></Label>
                      <Select value={form.location_type || "none"} onValueChange={v => setForm({ ...form, location_type: v === "none" ? "" : v, facility_id: v === "Residence" ? "" : form.facility_id })}>
                        <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Select —</SelectItem>
                          <SelectItem value="Residence">Residence</SelectItem>
                          <SelectItem value="SNF">SNF (Skilled Nursing Facility)</SelectItem>
                          <SelectItem value="Assisted Living">Assisted Living</SelectItem>
                          <SelectItem value="Group Home">Group Home</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {form.location_type && form.location_type !== "Residence" && (
                      <div>
                        <Label>Facility (if applicable)</Label>
                        <FacilitySelect value={form.facility_id} onChange={(v) => setForm({ ...form, facility_id: v })} />
                      </div>
                    )}
                  </div>

                  <div>
                    <Label>Dropoff Facility<PCRTooltip text={ADMIN_TOOLTIPS.dropoff_facility} /></Label>
                    <FacilityDropdown
                      value={form.dropoff_facility}
                      onChange={(v) => setForm({ ...form, dropoff_facility: v })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Weight (lbs)<PCRTooltip text={ADMIN_TOOLTIPS.weight_lbs} /></Label><Input type="number" value={form.weight_lbs} onChange={(e) => {
                      const w = e.target.value;
                      const wNum = w ? parseInt(w) : 0;
                      setForm({ ...form, weight_lbs: w, bariatric: wNum >= 300 ? true : form.bariatric });
                    }} /></div>
                    <div>
                      <Label>Status</Label>
                      <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as PatientStatus })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label>Notes / Standing Instructions</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>

                  {/* Transport Type + Recurrence */}
                  <div className="border-t pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Transport &amp; Recurrence Profile</p>

                    <div className="mb-3">
                      <Label className="mb-1.5 block">Transport Type<PCRTooltip text={ADMIN_TOOLTIPS.transport_type} /></Label>
                      <div className="space-y-2">
                        {TRANSPORT_TYPE_OPTIONS.map((opt) => (
                          <label key={opt.value} className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${form.transport_type === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                            <input
                              type="radio"
                              name="transport_type"
                              value={opt.value}
                              checked={form.transport_type === opt.value}
                              onChange={() => setForm({ ...form, transport_type: opt.value })}
                              className="mt-0.5 accent-primary"
                            />
                            <div className="text-sm font-medium text-foreground">{opt.label}</div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {isRepetitive && (
                      <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground font-medium">Recurrence schedule — used by Auto-Fill to generate daily runs</p>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            {form.transport_type === "dialysis" ? (
                              <>
                                <Label>Schedule Days<PCRTooltip text={ADMIN_TOOLTIPS.schedule_days} /></Label>
                                <Select value={form.schedule_days} onValueChange={(v) => setForm({ ...form, schedule_days: v })}>
                                  <SelectTrigger><SelectValue placeholder="Select days" /></SelectTrigger>
                                  <SelectContent>
                                    {SCHEDULE_DAY_OPTIONS.map((d) => (
                                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </>
                            ) : (
                              <>
                                <Label>Schedule Days<PCRTooltip text={ADMIN_TOOLTIPS.schedule_days} /></Label>
                                <div className="flex flex-wrap gap-2 mt-1.5">
                                  {CUSTOM_DAY_OPTIONS.map((d) => (
                                    <label key={d.value} className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${form.recurrence_days.includes(d.value) ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                                      <input
                                        type="checkbox"
                                        checked={form.recurrence_days.includes(d.value)}
                                        onChange={(e) => {
                                          const days = e.target.checked
                                            ? [...form.recurrence_days, d.value].sort()
                                            : form.recurrence_days.filter((x) => x !== d.value);
                                          setForm({ ...form, recurrence_days: days });
                                        }}
                                        className="accent-primary h-3 w-3"
                                      />
                                      {d.label}
                                    </label>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Time & Duration fields — moved into Recurrence Schedule */}
                        {form.transport_type === "dialysis" ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label>Chair Time<PCRTooltip text={ADMIN_TOOLTIPS.chair_time} /></Label>
                                <Input type="time" value={form.chair_time} onChange={(e) => setForm({ ...form, chair_time: e.target.value })} />
                              </div>
                              <div>
                                <Label>A-Leg Pickup Time</Label>
                                <Input type="time" value={form.a_leg_pickup_time} onChange={(e) => setForm({ ...form, a_leg_pickup_time: e.target.value })} />
                              </div>
                            </div>
                            <div>
                              <Label>Chair Time Duration<PCRTooltip text={ADMIN_TOOLTIPS.chair_time_duration} /></Label>
                              <div className="grid grid-cols-2 gap-2 mt-1">
                                <div>
                                  <Label className="text-[10px] text-muted-foreground">Hours</Label>
                                  <Input type="number" min={0} max={8} value={form.chair_time_duration_hours} onChange={e => setForm({ ...form, chair_time_duration_hours: e.target.value })} />
                                </div>
                                <div>
                                  <Label className="text-[10px] text-muted-foreground">Minutes</Label>
                                  <Input type="number" min={0} max={59} value={form.chair_time_duration_minutes} onChange={e => setForm({ ...form, chair_time_duration_minutes: e.target.value })} />
                                </div>
                              </div>
                              {bLegEarliestDisplay && (
                                <p className="text-[11px] text-muted-foreground mt-1.5">
                                  B-leg earliest valid return: <strong>{bLegEarliestDisplay}</strong>
                                </p>
                              )}
                              {bLegWarnings.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {bLegWarnings.map((w, i) => (
                                    <p key={i} className="text-[11px] text-[hsl(var(--status-yellow))]">
                                      ⚠️ Warning: Existing B-leg pickup time {w.pickup_time} on {w.run_date} may be too early based on this chair time duration. Earliest valid pickup: {w.earliest}. A dispatcher override will be required.
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label>Appointment Time<PCRTooltip text={ADMIN_TOOLTIPS.appointment_time} /></Label>
                                <Input type="time" value={form.chair_time} onChange={(e) => setForm({ ...form, chair_time: e.target.value })} />
                              </div>
                              <div>
                                <Label>A-Leg Pickup Time</Label>
                                <Input type="time" value={form.a_leg_pickup_time} onChange={(e) => setForm({ ...form, a_leg_pickup_time: e.target.value })} />
                              </div>
                            </div>
                            <div>
                              <Label>Appointment Duration</Label>
                              <div className="grid grid-cols-2 gap-2 mt-1">
                                <div>
                                  <Label className="text-[10px] text-muted-foreground">Hours</Label>
                                  <Input type="number" min={0} max={8} value={form.chair_time_duration_hours} onChange={e => setForm({ ...form, chair_time_duration_hours: e.target.value })} />
                                </div>
                                <div>
                                  <Label className="text-[10px] text-muted-foreground">Minutes</Label>
                                  <Input type="number" min={0} max={59} value={form.chair_time_duration_minutes} onChange={e => setForm({ ...form, chair_time_duration_minutes: e.target.value })} />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Recurrence Start Date</Label>
                            <Input type="date" value={form.recurrence_start_date} onChange={(e) => setForm({ ...form, recurrence_start_date: e.target.value })} />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <Label>End Date</Label>
                            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                              <Checkbox
                                checked={form.no_end_date}
                                onCheckedChange={(v) => setForm({ ...form, no_end_date: !!v, recurrence_end_date: "" })}
                              />
                              No end date
                            </label>
                          </div>
                          {!form.no_end_date && (
                            <Input type="date" value={form.recurrence_end_date} onChange={(e) => setForm({ ...form, recurrence_end_date: e.target.value })} />
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Insurance & Transport Flags */}
                  <div className="border-t pt-3 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Insurance &amp; Transport</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Primary Payer<PCRTooltip text={ADMIN_TOOLTIPS.primary_payer} /></Label>
                        <Select value={form.primary_payer || "none"} onValueChange={v => setForm({ ...form, primary_payer: v === "none" ? "" : v })}>
                          <SelectTrigger><SelectValue placeholder="Select payer" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— None —</SelectItem>
                            <SelectItem value="medicare">Medicare</SelectItem>
                            <SelectItem value="medicaid">Medicaid</SelectItem>
                            <SelectItem value="facility">Facility</SelectItem>
                            <SelectItem value="cash">Cash / Private</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                       <div>
                        <Label>Member ID<PCRTooltip text={ADMIN_TOOLTIPS.member_id} /></Label>
                        <Input value={form.member_id} onChange={e => setForm({ ...form, member_id: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Secondary Payer<PCRTooltip text={ADMIN_TOOLTIPS.secondary_payer} /></Label>
                        <Select value={form.secondary_payer || "none"} onValueChange={v => setForm({ ...form, secondary_payer: v === "none" ? "" : v })}>
                          <SelectTrigger><SelectValue placeholder="Select payer" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— None —</SelectItem>
                            <SelectItem value="medicare">Medicare</SelectItem>
                            <SelectItem value="medicaid">Medicaid</SelectItem>
                            <SelectItem value="facility">Facility</SelectItem>
                            <SelectItem value="cash">Cash / Private</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Secondary Member ID<PCRTooltip text={ADMIN_TOOLTIPS.secondary_member_id} /></Label>
                        <Input value={form.secondary_member_id} onChange={e => setForm({ ...form, secondary_member_id: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Mobility<PCRTooltip text={ADMIN_TOOLTIPS.mobility} /></Label>
                        <Select value={form.mobility} onValueChange={v => setForm({ ...form, mobility: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ambulatory">Ambulatory</SelectItem>
                            <SelectItem value="wheelchair">Wheelchair</SelectItem>
                            <SelectItem value="stretcher">Stretcher</SelectItem>
                            <SelectItem value="bedbound">Bedbound</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Trips/Week Limit<PCRTooltip text={ADMIN_TOOLTIPS.trips_per_week_limit} /></Label>
                        <Input type="number" value={form.trips_per_week_limit} onChange={e => setForm({ ...form, trips_per_week_limit: e.target.value })} placeholder="No limit" />
                      </div>
                    </div>

                    {/* Operational Needs */}
                    <div className="border-t pt-3 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Operational Needs</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Stairs Required</Label>
                          <Select value={form.stairs_required} onValueChange={v => setForm({ ...form, stairs_required: v, stair_chair_required: v === "full_flight" })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              <SelectItem value="few_steps">Few Steps</SelectItem>
                              <SelectItem value="full_flight">Full Flight</SelectItem>
                              <SelectItem value="unknown">Unknown</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Special Equipment</Label>
                          <Select value={form.special_equipment_required} onValueChange={v => setForm({ ...form, special_equipment_required: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              <SelectItem value="bariatric_stretcher">Bariatric Stretcher</SelectItem>
                              <SelectItem value="extra_crew">Extra Crew</SelectItem>
                              <SelectItem value="lift_assist">Lift Assist</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label>O₂ LPM<PCRTooltip text={ADMIN_TOOLTIPS.oxygen_lpm} /></Label>
                          <Input type="number" step="0.5" value={form.oxygen_lpm} onChange={e => setForm({ ...form, oxygen_lpm: e.target.value })} placeholder="—" />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={form.stair_chair_required} onChange={e => setForm({ ...form, stair_chair_required: e.target.checked })} className="accent-primary" />
                        Stair Chair Required<PCRTooltip text={ADMIN_TOOLTIPS.stair_chair} />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      {[
                        { key: "oxygen_required" as const, label: "Oxygen Required", tooltip: ADMIN_TOOLTIPS.oxygen_required },
                        { key: "bariatric" as const, label: "Bariatric", tooltip: ADMIN_TOOLTIPS.bariatric },
                        { key: "standing_order" as const, label: "Standing Order", tooltip: ADMIN_TOOLTIPS.standing_order },
                        { key: "auth_required" as const, label: "Auth Required", tooltip: ADMIN_TOOLTIPS.auth_required },
                      ].map(f => (
                        <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.checked })} className="accent-primary" />
                          {f.label}<PCRTooltip text={f.tooltip} />
                        </label>
                      ))}
                    </div>
                    {form.auth_required && (
                      <div>
                        <Label>Auth Expiration<PCRTooltip text={ADMIN_TOOLTIPS.auth_expiration} /></Label>
                        <Input type="date" value={form.auth_expiration} onChange={e => setForm({ ...form, auth_expiration: e.target.value })} />
                      </div>
                    )}
                  </div>

                  <Button onClick={handleSave}>{editing ? "Save Changes" : "Add Patient"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b text-left text-xs font-medium uppercase text-muted-foreground">
                  <th className="px-4 py-3 w-10">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Schedule</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Weight</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const isHeavy = (p.weight_lbs ?? 0) > 200;
                  const isInactive = (p as any).status !== "active";
                  const tType = (p as any).transport_type ?? "dialysis";
                  const isChecked = selected.has(p.id);
                  return (
                    <tr
                      key={p.id}
                      className={`border-b last:border-0 transition-colors ${isInactive ? "opacity-60" : ""} ${isChecked ? "bg-primary/5" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleOne(p.id)}
                          aria-label={`Select ${p.first_name} ${p.last_name}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-card-foreground">{p.first_name} {p.last_name}</span>
                          {isHeavy && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--status-yellow-bg))] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--status-yellow))]" title="Electric stretcher required">
                              <Zap className="h-3 w-3" /> &gt;200
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3"><PatientStatusBadge status={(p as any).status ?? "active"} /></td>
                      <td className="px-4 py-3">
                        <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                          tType === "dialysis" ? "bg-primary/10 text-primary" :
                          tType === "outpatient" ? "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {tType === "dialysis" ? "Dialysis" : tType === "outpatient" ? "Outpatient" : tType === "private_pay" ? "Private Pay" : tType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(() => {
                          const rd = (p as any).recurrence_days;
                          const sd = p.schedule_days;
                          const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
                          if (rd && rd.length > 0) return rd.sort((a:number,b:number)=>a-b).map((d:number) => DAY_NAMES[d] ?? `Day${d}`).join(", ");
                          if (sd === "MWF") return "Mon, Wed, Fri";
                          if (sd === "TTS") return "Tue, Thu, Sat";
                          if (sd) return sd;
                          return "No schedule";
                        })()}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.phone ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.weight_lbs ? (
                          <span className={isHeavy ? "font-semibold text-[hsl(var(--status-yellow))]" : ""}>
                            {p.weight_lbs} lbs
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(p)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No patients found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Single delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Patient?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.first_name} {deleteTarget?.last_name}</strong> and all their associated runs and scheduling legs. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Patient"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} Patient{selected.size > 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{selected.size}</strong> patient{selected.size > 1 ? "s" : ""} along with all associated runs and scheduling legs. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? "Deleting..." : `Delete ${selected.size} Patient${selected.size > 1 ? "s" : ""}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}

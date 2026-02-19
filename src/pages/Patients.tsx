import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Pencil, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import type { Tables, Database } from "@/integrations/supabase/types";
import { PatientStatusBadge } from "@/components/patients/PatientStatusBadge";

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

type TransportType = "dialysis" | "outpatient" | "adhoc";

const TRANSPORT_TYPE_OPTIONS: { value: TransportType; label: string; description: string }[] = [
  { value: "dialysis", label: "Dialysis", description: "Highly repetitive — auto-generates from schedule" },
  { value: "outpatient", label: "Outpatient / Wound Care", description: "Repetitive but less consistent" },
  { value: "adhoc", label: "Other / Ad-hoc", description: "No recurrence — created manually each time" },
];

export default function Patients() {
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

  const [form, setForm] = useState({
    first_name: "", last_name: "", dob: "", phone: "",
    pickup_address: "", dropoff_facility: "", chair_time: "",
    run_duration_minutes: "", schedule_days: "" as string,
    weight_lbs: "", notes: "", status: "active" as PatientStatus,
    transport_type: "dialysis" as TransportType,
    recurrence_start_date: "", recurrence_end_date: "",
    no_end_date: true,
  });

  const fetchPatients = async () => {
    const { data } = await supabase.from("patients").select("*").order("last_name");
    setPatients(data ?? []);
  };

  useEffect(() => { fetchPatients(); }, []);

  const resetForm = () => {
    setForm({
      first_name: "", last_name: "", dob: "", phone: "",
      pickup_address: "", dropoff_facility: "", chair_time: "",
      run_duration_minutes: "", schedule_days: "", weight_lbs: "",
      notes: "", status: "active",
      transport_type: "dialysis",
      recurrence_start_date: "", recurrence_end_date: "",
      no_end_date: true,
    });
    setEditing(null);
  };

  const openEdit = (p: Patient) => {
    setEditing(p);
    const endDate = (p as any).recurrence_end_date ?? "";
    setForm({
      first_name: p.first_name, last_name: p.last_name,
      dob: p.dob ?? "", phone: p.phone ?? "",
      pickup_address: p.pickup_address ?? "", dropoff_facility: p.dropoff_facility ?? "",
      chair_time: p.chair_time ?? "", run_duration_minutes: p.run_duration_minutes?.toString() ?? "",
      schedule_days: p.schedule_days ?? "", weight_lbs: p.weight_lbs?.toString() ?? "",
      notes: p.notes ?? "", status: (p as any).status ?? "active",
      transport_type: ((p as any).transport_type ?? "dialysis") as TransportType,
      recurrence_start_date: (p as any).recurrence_start_date ?? "",
      recurrence_end_date: endDate,
      no_end_date: !endDate,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload: any = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      dob: form.dob || null,
      phone: form.phone || null,
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
    };

    if (!payload.first_name || !payload.last_name) return;

    if (editing) {
      await supabase.from("patients").update(payload).eq("id", editing.id);
      toast.success("Patient updated");
    } else {
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

  const isRepetitive = form.transport_type !== "adhoc";

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
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit Patient" : "Add Patient"}</DialogTitle>
                  <DialogDescription>Enter patient details including contact info, addresses, and recurring transport schedule.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">

                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>First Name *</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
                    <div><Label>Last Name *</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>DOB</Label><Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></div>
                    <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  </div>
                  <div><Label>Pickup Address</Label><Input value={form.pickup_address} onChange={(e) => setForm({ ...form, pickup_address: e.target.value })} /></div>
                  <div><Label>Dropoff Facility</Label><Input value={form.dropoff_facility} onChange={(e) => setForm({ ...form, dropoff_facility: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Weight (lbs)</Label><Input type="number" value={form.weight_lbs} onChange={(e) => setForm({ ...form, weight_lbs: e.target.value })} /></div>
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
                      <Label className="mb-1.5 block">Transport Type</Label>
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
                            <div>
                              <div className="text-sm font-medium text-foreground">{opt.label}</div>
                              <div className="text-xs text-muted-foreground">{opt.description}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {isRepetitive && (
                      <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground font-medium">Recurrence schedule — used by Auto-Fill to generate daily runs</p>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Schedule Days</Label>
                            <Select value={form.schedule_days} onValueChange={(v) => setForm({ ...form, schedule_days: v })}>
                              <SelectTrigger><SelectValue placeholder="Select days" /></SelectTrigger>
                              <SelectContent>
                                {SCHEDULE_DAY_OPTIONS.map((d) => (
                                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Chair Time</Label>
                            <Input type="time" value={form.chair_time} onChange={(e) => setForm({ ...form, chair_time: e.target.value })} />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Est. Duration (min)</Label>
                            <Input type="number" placeholder="30" value={form.run_duration_minutes} onChange={(e) => setForm({ ...form, run_duration_minutes: e.target.value })} />
                          </div>
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

                  <Button onClick={handleSave}>{editing ? "Save Changes" : "Add Patient"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
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
                          {tType === "dialysis" ? "Dialysis" : tType === "outpatient" ? "Outpatient" : "Ad-hoc"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.schedule_days ?? "—"}</td>
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

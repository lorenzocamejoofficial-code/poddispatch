import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Pencil } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Patient = Tables<"patients">;

export default function Patients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [form, setForm] = useState({
    first_name: "", last_name: "", dob: "", phone: "",
    pickup_address: "", dropoff_facility: "", chair_time: "",
    run_duration_minutes: "", schedule_days: "" as string,
    weight_lbs: "", notes: "",
  });

  const fetchPatients = async () => {
    const { data } = await supabase.from("patients").select("*").order("last_name");
    setPatients(data ?? []);
  };

  useEffect(() => { fetchPatients(); }, []);

  const resetForm = () => {
    setForm({ first_name: "", last_name: "", dob: "", phone: "", pickup_address: "", dropoff_facility: "", chair_time: "", run_duration_minutes: "", schedule_days: "", weight_lbs: "", notes: "" });
    setEditing(null);
  };

  const openEdit = (p: Patient) => {
    setEditing(p);
    setForm({
      first_name: p.first_name, last_name: p.last_name,
      dob: p.dob ?? "", phone: p.phone ?? "",
      pickup_address: p.pickup_address ?? "", dropoff_facility: p.dropoff_facility ?? "",
      chair_time: p.chair_time ?? "", run_duration_minutes: p.run_duration_minutes?.toString() ?? "",
      schedule_days: p.schedule_days ?? "", weight_lbs: p.weight_lbs?.toString() ?? "",
      notes: p.notes ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
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
    };

    if (!payload.first_name || !payload.last_name) return;

    if (editing) {
      await supabase.from("patients").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("patients").insert(payload);
    }

    setDialogOpen(false);
    resetForm();
    fetchPatients();
  };

  const filtered = patients.filter((p) => {
    const q = search.toLowerCase();
    return `${p.first_name} ${p.last_name}`.toLowerCase().includes(q);
  });

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search patients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-1.5 h-4 w-4" /> Add Patient</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Patient" : "Add Patient"}</DialogTitle>
                <DialogDescription>Enter patient details including contact info, addresses, and scheduling.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-2">
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
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Chair Time</Label><Input type="time" value={form.chair_time} onChange={(e) => setForm({ ...form, chair_time: e.target.value })} /></div>
                  <div><Label>Duration (min)</Label><Input type="number" value={form.run_duration_minutes} onChange={(e) => setForm({ ...form, run_duration_minutes: e.target.value })} /></div>
                  <div><Label>Weight (lbs)</Label><Input type="number" value={form.weight_lbs} onChange={(e) => setForm({ ...form, weight_lbs: e.target.value })} /></div>
                </div>
                <div>
                  <Label>Schedule Days</Label>
                  <Select value={form.schedule_days} onValueChange={(v) => setForm({ ...form, schedule_days: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MWF">Mon / Wed / Fri</SelectItem>
                      <SelectItem value="TTS">Tue / Thu / Sat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
                <Button onClick={handleSave}>{editing ? "Save Changes" : "Add Patient"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium uppercase text-muted-foreground">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Pickup</th>
                  <th className="px-4 py-3">Dropoff</th>
                  <th className="px-4 py-3">Schedule</th>
                  <th className="px-4 py-3">Weight</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium text-card-foreground">{p.first_name} {p.last_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{p.pickup_address ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{p.dropoff_facility ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.schedule_days ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.weight_lbs ? `${p.weight_lbs} lbs` : "—"}</td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No patients found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

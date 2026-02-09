import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/dispatch/StatusBadge";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { Tables, Database } from "@/integrations/supabase/types";

type TripType = Database["public"]["Enums"]["trip_type"];

interface RunDisplay {
  id: string;
  patient_name: string;
  truck_name: string | null;
  crew_names: string;
  pickup_time: string | null;
  trip_type: string;
  status: Database["public"]["Enums"]["run_status"];
  run_date: string;
}

interface PatientOption { id: string; name: string; }
interface TruckOption { id: string; name: string; }
interface CrewOption { id: string; label: string; truck_id: string; }

export default function Runs() {
  const [runs, setRuns] = useState<RunDisplay[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [trucks, setTrucks] = useState<TruckOption[]>([]);
  const [crews, setCrews] = useState<CrewOption[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  const [form, setForm] = useState({
    patient_id: "", truck_id: "", crew_id: "",
    pickup_time: "", trip_type: "dialysis" as TripType,
    notes: "", run_date: new Date().toISOString().split("T")[0],
  });

  const fetchRuns = async () => {
    const { data } = await supabase
      .from("runs")
      .select("*, patient:patients!runs_patient_id_fkey(first_name, last_name), truck:trucks!runs_truck_id_fkey(name), crew:crews!runs_crew_id_fkey(member1:profiles!crews_member1_id_fkey(full_name), member2:profiles!crews_member2_id_fkey(full_name))")
      .eq("run_date", selectedDate)
      .order("sort_order");

    setRuns((data ?? []).map((r) => ({
      id: r.id,
      patient_name: r.patient ? `${r.patient.first_name} ${r.patient.last_name}` : "—",
      truck_name: r.truck?.name ?? null,
      crew_names: [r.crew?.member1?.full_name, r.crew?.member2?.full_name].filter(Boolean).join(" & ") || "—",
      pickup_time: r.pickup_time,
      trip_type: r.trip_type,
      status: r.status,
      run_date: r.run_date,
    })));
  };

  const fetchOptions = async () => {
    const [{ data: p }, { data: t }, { data: c }] = await Promise.all([
      supabase.from("patients").select("id, first_name, last_name").order("last_name"),
      supabase.from("trucks").select("id, name").eq("active", true),
      supabase.from("crews").select("id, truck_id, member1:profiles!crews_member1_id_fkey(full_name), member2:profiles!crews_member2_id_fkey(full_name)").eq("active_date", selectedDate),
    ]);
    setPatients((p ?? []).map((x) => ({ id: x.id, name: `${x.first_name} ${x.last_name}` })));
    setTrucks((t ?? []).map((x) => ({ id: x.id, name: x.name })));
    setCrews((c ?? []).map((x) => ({
      id: x.id,
      truck_id: x.truck_id,
      label: [x.member1?.full_name, x.member2?.full_name].filter(Boolean).join(" & ") || "Unnamed",
    })));
  };

  useEffect(() => { fetchRuns(); fetchOptions(); }, [selectedDate]);

  const handleCreate = async () => {
    if (!form.patient_id) { toast.error("Select a patient"); return; }
    await supabase.from("runs").insert({
      patient_id: form.patient_id,
      truck_id: form.truck_id || null,
      crew_id: form.crew_id || null,
      pickup_time: form.pickup_time || null,
      trip_type: form.trip_type,
      notes: form.notes || null,
      run_date: form.run_date,
      sort_order: runs.length,
    });
    setDialogOpen(false);
    setForm({ patient_id: "", truck_id: "", crew_id: "", pickup_time: "", trip_type: "dialysis", notes: "", run_date: selectedDate });
    toast.success("Run created");
    fetchRuns();
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-1.5 h-4 w-4" /> New Run</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Create Run</DialogTitle><DialogDescription>Schedule a new patient transport run.</DialogDescription></DialogHeader>
              <div className="grid gap-3 py-2">
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={form.run_date} onChange={(e) => setForm({ ...form, run_date: e.target.value })} />
                </div>
                <div>
                  <Label>Patient *</Label>
                  <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                    <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Pickup Time</Label>
                    <Input type="time" value={form.pickup_time} onChange={(e) => setForm({ ...form, pickup_time: e.target.value })} />
                  </div>
                  <div>
                    <Label>Trip Type</Label>
                    <Select value={form.trip_type} onValueChange={(v) => setForm({ ...form, trip_type: v as TripType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dialysis">Dialysis</SelectItem>
                        <SelectItem value="discharge">Discharge</SelectItem>
                        <SelectItem value="outpatient">Outpatient</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Truck</Label>
                  <Select value={form.truck_id} onValueChange={(v) => setForm({ ...form, truck_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select truck" /></SelectTrigger>
                    <SelectContent>{trucks.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Crew</Label>
                  <Select value={form.crew_id} onValueChange={(v) => setForm({ ...form, crew_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select crew" /></SelectTrigger>
                    <SelectContent>{crews.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                </div>
                <Button onClick={handleCreate}>Create Run</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium uppercase text-muted-foreground">
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Truck</th>
                  <th className="px-4 py-3">Crew</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.pickup_time ?? "—"}</td>
                    <td className="px-4 py-3 font-medium text-card-foreground">{r.patient_name}</td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{r.trip_type}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.truck_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.crew_names}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
                {runs.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No runs for this date</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

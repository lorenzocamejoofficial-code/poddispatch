import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Truck, Zap, AlertTriangle, Trash2, ArrowRight, Clock } from "lucide-react";
import { toast } from "sonner";
import { TruckBuilder } from "@/components/scheduling/TruckBuilder";
import { FeasibilityResult } from "@/components/scheduling/FeasibilityResult";

interface LegDisplay {
  id: string;
  patient_name: string;
  patient_id: string;
  patient_weight: number | null;
  patient_status: string;
  leg_type: string;
  pickup_time: string | null;
  chair_time: string | null;
  pickup_location: string;
  destination_location: string;
  trip_type: string;
  estimated_duration_minutes: number | null;
  notes: string | null;
  assigned_truck_id: string | null;
}

interface PatientOption { id: string; name: string; weight: number | null; status: string; }
interface TruckOption { id: string; name: string; }

export default function Scheduling() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [legs, setLegs] = useState<LegDisplay[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [trucks, setTrucks] = useState<TruckOption[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [legType, setLegType] = useState<"A" | "B" | null>(null);

  const [form, setForm] = useState({
    patient_id: "", pickup_time: "", chair_time: "",
    pickup_location: "", destination_location: "",
    trip_type: "dialysis", estimated_duration_minutes: "",
    notes: "",
  });

  const fetchLegs = useCallback(async () => {
    const { data } = await supabase
      .from("scheduling_legs")
      .select("*, patient:patients!scheduling_legs_patient_id_fkey(first_name, last_name, weight_lbs, status)")
      .eq("run_date", selectedDate)
      .order("pickup_time");

    const { data: slots } = await supabase
      .from("truck_run_slots")
      .select("leg_id, truck_id")
      .eq("run_date", selectedDate);

    const slotMap = new Map((slots ?? []).map(s => [s.leg_id, s.truck_id]));

    setLegs((data ?? []).map((l: any) => ({
      id: l.id,
      patient_name: l.patient ? `${l.patient.first_name} ${l.patient.last_name}` : "Unknown",
      patient_id: l.patient_id,
      patient_weight: l.patient?.weight_lbs ?? null,
      patient_status: l.patient?.status ?? "active",
      leg_type: l.leg_type,
      pickup_time: l.pickup_time,
      chair_time: l.chair_time,
      pickup_location: l.pickup_location,
      destination_location: l.destination_location,
      trip_type: l.trip_type,
      estimated_duration_minutes: l.estimated_duration_minutes,
      notes: l.notes,
      assigned_truck_id: slotMap.get(l.id) ?? null,
    })));
  }, [selectedDate]);

  const fetchOptions = useCallback(async () => {
    const [{ data: p }, { data: t }] = await Promise.all([
      supabase.from("patients").select("id, first_name, last_name, weight_lbs, status").order("last_name"),
      supabase.from("trucks").select("id, name").eq("active", true),
    ]);
    setPatients((p ?? []).map((x: any) => ({ id: x.id, name: `${x.first_name} ${x.last_name}`, weight: x.weight_lbs, status: x.status })));
    setTrucks((t ?? []).map((x: any) => ({ id: x.id, name: x.name })));
  }, []);

  useEffect(() => { fetchLegs(); fetchOptions(); }, [selectedDate, fetchLegs, fetchOptions]);

  const openCreateDialog = (type: "A" | "B") => {
    setLegType(type);
    setForm({ patient_id: "", pickup_time: "", chair_time: "", pickup_location: "", destination_location: "", trip_type: "dialysis", estimated_duration_minutes: "", notes: "" });
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!form.patient_id || !form.pickup_location || !form.destination_location) {
      toast.error("Patient, pickup location, and destination are required");
      return;
    }

    // Warn if patient is not active
    const patient = patients.find(p => p.id === form.patient_id);
    if (patient && patient.status !== "active") {
      toast.warning(`Warning: ${patient.name} is ${patient.status.replace("_", " ")}. Scheduling anyway.`);
    }

    const { error } = await supabase.from("scheduling_legs").insert({
      patient_id: form.patient_id,
      leg_type: legType!,
      pickup_time: form.pickup_time || null,
      chair_time: form.chair_time || null,
      pickup_location: form.pickup_location,
      destination_location: form.destination_location,
      trip_type: form.trip_type as any,
      estimated_duration_minutes: form.estimated_duration_minutes ? parseInt(form.estimated_duration_minutes) : null,
      notes: form.notes || null,
      run_date: selectedDate,
    } as any);

    if (error) {
      toast.error("Failed to create leg");
      return;
    }

    toast.success(`${legType}-Leg created`);
    setDialogOpen(false);
    fetchLegs();
  };

  const deleteLeg = async (id: string) => {
    await supabase.from("scheduling_legs").delete().eq("id", id);
    toast.success("Leg removed");
    fetchLegs();
  };

  const unassignedLegs = legs.filter(l => !l.assigned_truck_id);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-auto" />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openCreateDialog("A")}>
              <Plus className="mr-1.5 h-4 w-4" /> Create A Leg
            </Button>
            <Button variant="outline" onClick={() => openCreateDialog("B")}>
              <Plus className="mr-1.5 h-4 w-4" /> Create B Leg
            </Button>
          </div>
        </div>

        {/* Unassigned Legs Pool */}
        {unassignedLegs.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Unassigned Legs ({unassignedLegs.length})
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {unassignedLegs.map((leg) => (
                <LegCard key={leg.id} leg={leg} onDelete={() => deleteLeg(leg.id)} />
              ))}
            </div>
          </section>
        )}

        {/* Truck Builder */}
        <TruckBuilder
          trucks={trucks}
          legs={legs}
          selectedDate={selectedDate}
          onRefresh={fetchLegs}
        />

        {/* Create Leg Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create {legType}-Leg</DialogTitle>
              <DialogDescription>Schedule a {legType === "A" ? "pickup" : "return"} transport leg.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div>
                <Label>Patient *</Label>
                <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
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
                <div><Label>Pickup Time</Label><Input type="time" value={form.pickup_time} onChange={(e) => setForm({ ...form, pickup_time: e.target.value })} /></div>
                <div><Label>Chair Time</Label><Input type="time" value={form.chair_time} onChange={(e) => setForm({ ...form, chair_time: e.target.value })} /></div>
              </div>
              <div><Label>Pickup Location *</Label><Input value={form.pickup_location} onChange={(e) => setForm({ ...form, pickup_location: e.target.value })} placeholder="City, facility, or home" /></div>
              <div><Label>Destination *</Label><Input value={form.destination_location} onChange={(e) => setForm({ ...form, destination_location: e.target.value })} placeholder="City, facility, or home" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Trip Type</Label>
                  <Select value={form.trip_type} onValueChange={(v) => setForm({ ...form, trip_type: v })}>
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
                <div><Label>Est. Duration (min)</Label><Input type="number" value={form.estimated_duration_minutes} onChange={(e) => setForm({ ...form, estimated_duration_minutes: e.target.value })} /></div>
              </div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
              <Button onClick={handleCreate}>Create {legType}-Leg</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

function LegCard({ leg, onDelete }: { leg: LegDisplay; onDelete: () => void }) {
  const isHeavy = (leg.patient_weight ?? 0) > 200;
  const isInactive = leg.patient_status !== "active";

  return (
    <div className={`rounded-lg border bg-card p-3 text-sm ${isInactive ? "opacity-60 border-dashed" : ""}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            leg.leg_type === "A" ? "bg-primary/10 text-primary" : "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]"
          }`}>
            {leg.leg_type}-LEG
          </span>
          <span className="font-medium text-card-foreground">{leg.patient_name}</span>
          {isHeavy && (
            <span className="text-[hsl(var(--status-yellow))]" title="Electric stretcher required">
              <Zap className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDelete}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {leg.pickup_time && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{leg.pickup_time}</span>}
        <span>{leg.pickup_location}</span>
        <ArrowRight className="h-3 w-3" />
        <span>{leg.destination_location}</span>
      </div>
      {isHeavy && (
        <p className="mt-1 text-[10px] font-semibold text-[hsl(var(--status-yellow))]">⚡ Electric stretcher required</p>
      )}
      {isInactive && (
        <p className="mt-1 text-[10px] font-semibold text-[hsl(var(--status-red))]">⚠ Patient is {leg.patient_status.replace("_", " ")}</p>
      )}
    </div>
  );
}

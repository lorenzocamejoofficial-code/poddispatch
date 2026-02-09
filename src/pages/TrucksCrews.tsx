import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Truck } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type TruckRow = Tables<"trucks">;

interface ProfileOption {
  id: string;
  full_name: string;
}

interface CrewDisplay {
  id: string;
  truck_name: string;
  truck_id: string;
  member1_name: string | null;
  member2_name: string | null;
  active_date: string;
}

export default function TrucksCrews() {
  const [trucks, setTrucks] = useState<TruckRow[]>([]);
  const [crews, setCrews] = useState<CrewDisplay[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [truckDialog, setTruckDialog] = useState(false);
  const [crewDialog, setCrewDialog] = useState(false);
  const [truckName, setTruckName] = useState("");
  const [crewForm, setCrewForm] = useState({ truck_id: "", member1_id: "", member2_id: "", active_date: new Date().toISOString().split("T")[0] });

  const fetchAll = async () => {
    const [{ data: t }, { data: p }, { data: c }] = await Promise.all([
      supabase.from("trucks").select("*").order("name"),
      supabase.from("profiles").select("id, full_name").order("full_name"),
      supabase.from("crews").select("*, truck:trucks!crews_truck_id_fkey(name), member1:profiles!crews_member1_id_fkey(full_name), member2:profiles!crews_member2_id_fkey(full_name)").order("active_date", { ascending: false }),
    ]);
    setTrucks(t ?? []);
    setProfiles(p ?? []);
    setCrews((c ?? []).map((cr) => ({
      id: cr.id,
      truck_name: cr.truck?.name ?? "",
      truck_id: cr.truck_id,
      member1_name: cr.member1?.full_name ?? null,
      member2_name: cr.member2?.full_name ?? null,
      active_date: cr.active_date,
    })));
  };

  useEffect(() => { fetchAll(); }, []);

  const addTruck = async () => {
    if (!truckName.trim()) return;
    await supabase.from("trucks").insert({ name: truckName.trim() });
    setTruckName("");
    setTruckDialog(false);
    toast.success("Truck added");
    fetchAll();
  };

  const assignCrew = async () => {
    if (!crewForm.truck_id || !crewForm.member1_id || !crewForm.member2_id) {
      toast.error("Select a truck and two crew members");
      return;
    }
    await supabase.from("crews").insert({
      truck_id: crewForm.truck_id,
      member1_id: crewForm.member1_id,
      member2_id: crewForm.member2_id,
      active_date: crewForm.active_date,
    });
    setCrewDialog(false);
    setCrewForm({ truck_id: "", member1_id: "", member2_id: "", active_date: new Date().toISOString().split("T")[0] });
    toast.success("Crew assigned");
    fetchAll();
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Trucks */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Trucks</h3>
            <Dialog open={truckDialog} onOpenChange={setTruckDialog}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1.5 h-3.5 w-3.5" /> Add Truck</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader><DialogTitle>Add Truck</DialogTitle><DialogDescription>Add a new truck to your fleet.</DialogDescription></DialogHeader>
                <div className="space-y-3 py-2">
                  <div><Label>Truck Name/Number</Label><Input value={truckName} onChange={(e) => setTruckName(e.target.value)} placeholder="e.g. Truck 1" /></div>
                  <Button onClick={addTruck} className="w-full">Add Truck</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {trucks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-lg border bg-card p-4">
                <Truck className="h-5 w-5 text-primary" />
                <span className="font-medium text-card-foreground">{t.name}</span>
              </div>
            ))}
            {trucks.length === 0 && <p className="text-sm text-muted-foreground col-span-full">No trucks yet</p>}
          </div>
        </section>

        {/* Crews */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Crew Assignments</h3>
            <Dialog open={crewDialog} onOpenChange={setCrewDialog}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1.5 h-3.5 w-3.5" /> Assign Crew</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Assign Crew to Truck</DialogTitle><DialogDescription>Select a truck and assign two crew members for the day.</DialogDescription></DialogHeader>
                <div className="space-y-3 py-2">
                  <div>
                    <Label>Date</Label>
                    <Input type="date" value={crewForm.active_date} onChange={(e) => setCrewForm({ ...crewForm, active_date: e.target.value })} />
                  </div>
                  <div>
                    <Label>Truck</Label>
                    <Select value={crewForm.truck_id} onValueChange={(v) => setCrewForm({ ...crewForm, truck_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select truck" /></SelectTrigger>
                      <SelectContent>{trucks.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Member 1</Label>
                    <Select value={crewForm.member1_id} onValueChange={(v) => setCrewForm({ ...crewForm, member1_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Member 2</Label>
                    <Select value={crewForm.member2_id} onValueChange={(v) => setCrewForm({ ...crewForm, member2_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button onClick={assignCrew} className="w-full">Assign Crew</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="rounded-lg border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase text-muted-foreground">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Truck</th>
                    <th className="px-4 py-3">Member 1</th>
                    <th className="px-4 py-3">Member 2</th>
                  </tr>
                </thead>
                <tbody>
                  {crews.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="px-4 py-3 text-muted-foreground">{c.active_date}</td>
                      <td className="px-4 py-3 font-medium text-card-foreground">{c.truck_name}</td>
                      <td className="px-4 py-3 text-card-foreground">{c.member1_name ?? "—"}</td>
                      <td className="px-4 py-3 text-card-foreground">{c.member2_name ?? "—"}</td>
                    </tr>
                  ))}
                  {crews.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No crew assignments yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}

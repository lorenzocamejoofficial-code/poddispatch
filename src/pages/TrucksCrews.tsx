import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Truck, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useSchedulingStore } from "@/hooks/useSchedulingStore";
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
  member1_id: string | null;
  member2_id: string | null;
  active_date: string;
}

export default function TrucksCrews() {
  const { refreshTrucks } = useSchedulingStore();
  const [trucks, setTrucks] = useState<TruckRow[]>([]);
  const [crews, setCrews] = useState<CrewDisplay[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [truckDialog, setTruckDialog] = useState(false);
  const [crewDialog, setCrewDialog] = useState(false);
  const [truckName, setTruckName] = useState("");
  const [crewForm, setCrewForm] = useState({ truck_id: "", member1_id: "", member2_id: "", active_date: new Date().toISOString().split("T")[0] });

  // Inline edit state
  const [editingTruckId, setEditingTruckId] = useState<string | null>(null);
  const [editingTruckName, setEditingTruckName] = useState("");
  const [editingCrewId, setEditingCrewId] = useState<string | null>(null);
  const [editingCrewForm, setEditingCrewForm] = useState<{ member1_id: string; member2_id: string }>({ member1_id: "", member2_id: "" });

  const fetchAll = useCallback(async () => {
    const [{ data: t }, { data: p }, { data: c }] = await Promise.all([
      supabase.from("trucks").select("*").order("name"),
      supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name"),
      supabase.from("crews").select("*, truck:trucks!crews_truck_id_fkey(name), member1:profiles!crews_member1_id_fkey(full_name, id), member2:profiles!crews_member2_id_fkey(full_name, id)").order("active_date", { ascending: false }),
    ]);
    setTrucks(t ?? []);
    setProfiles(p ?? []);
    setCrews((c ?? []).map((cr: any) => ({
      id: cr.id,
      truck_name: cr.truck?.name ?? "",
      truck_id: cr.truck_id,
      member1_name: cr.member1?.full_name ?? null,
      member2_name: cr.member2?.full_name ?? null,
      member1_id: cr.member1_id ?? null,
      member2_id: cr.member2_id ?? null,
      active_date: cr.active_date,
    })));
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addTruck = async () => {
    if (!truckName.trim()) return;
    await supabase.from("trucks").insert({ name: truckName.trim() });
    setTruckName("");
    setTruckDialog(false);
    toast.success("Truck added");
    fetchAll();
    refreshTrucks();
  };

  const startEditTruck = (truck: TruckRow) => {
    setEditingTruckId(truck.id);
    setEditingTruckName(truck.name);
  };

  const saveTruckName = async (id: string) => {
    const trimmed = editingTruckName.trim();
    if (!trimmed) { toast.error("Name cannot be empty"); return; }
    const { error } = await supabase.from("trucks").update({ name: trimmed }).eq("id", id);
    if (error) { toast.error("Failed to rename truck"); return; }
    setEditingTruckId(null);
    toast.success("Truck renamed");
    fetchAll();
    refreshTrucks(); // sync store → scheduling/dispatch everywhere
  };

  const cancelEditTruck = () => setEditingTruckId(null);

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

  const startEditCrew = (crew: CrewDisplay) => {
    setEditingCrewId(crew.id);
    setEditingCrewForm({ member1_id: crew.member1_id ?? "", member2_id: crew.member2_id ?? "" });
  };

  const saveCrewEdit = async (id: string) => {
    const { error } = await supabase.from("crews").update({
      member1_id: editingCrewForm.member1_id || null,
      member2_id: editingCrewForm.member2_id || null,
    } as any).eq("id", id);
    if (error) { toast.error("Failed to update crew"); return; }
    setEditingCrewId(null);
    toast.success("Crew updated");
    fetchAll();
  };

  const deleteCrew = async (id: string) => {
    await supabase.from("crews").delete().eq("id", id);
    toast.success("Crew assignment removed");
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
                  <div><Label>Truck Name/Number</Label><Input value={truckName} onChange={(e) => setTruckName(e.target.value)} placeholder="e.g. Truck 1" onKeyDown={(e) => e.key === "Enter" && addTruck()} /></div>
                  <Button onClick={addTruck} className="w-full">Add Truck</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {trucks.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg border bg-card p-3">
                <Truck className="h-4 w-4 text-primary shrink-0" />
                {editingTruckId === t.id ? (
                  <>
                    <Input
                      className="h-7 text-sm flex-1"
                      value={editingTruckName}
                      onChange={(e) => setEditingTruckName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveTruckName(t.id);
                        if (e.key === "Escape") cancelEditTruck();
                      }}
                      autoFocus
                    />
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => saveTruckName(t.id)}>
                      <Check className="h-3 w-3 text-[hsl(var(--status-green))]" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelEditTruck}>
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="font-medium text-card-foreground flex-1 truncate">{t.name}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => startEditTruck(t)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </>
                )}
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
                    <th className="px-4 py-3 w-20">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {crews.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="px-4 py-3 text-muted-foreground">{c.active_date}</td>
                      <td className="px-4 py-3 font-medium text-card-foreground">{c.truck_name}</td>
                      {editingCrewId === c.id ? (
                        <>
                          <td className="px-4 py-2">
                            <Select value={editingCrewForm.member1_id} onValueChange={(v) => setEditingCrewForm((f) => ({ ...f, member1_id: v }))}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Member 1" /></SelectTrigger>
                              <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-2">
                            <Select value={editingCrewForm.member2_id} onValueChange={(v) => setEditingCrewForm((f) => ({ ...f, member2_id: v }))}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Member 2" /></SelectTrigger>
                              <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveCrewEdit(c.id)}>
                                <Check className="h-3.5 w-3.5 text-[hsl(var(--status-green))]" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingCrewId(null)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-card-foreground">{c.member1_name ?? "—"}</td>
                          <td className="px-4 py-3 text-card-foreground">{c.member2_name ?? "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditCrew(c)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteCrew(c.id)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {crews.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No crew assignments yet</td></tr>
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

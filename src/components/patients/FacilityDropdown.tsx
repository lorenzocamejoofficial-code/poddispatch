import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface FacilityDropdownProps {
  value: string;
  onChange: (value: string) => void;
}

export function FacilityDropdown({ value, onChange }: FacilityDropdownProps) {
  const [facilities, setFacilities] = useState<{ id: string; name: string }[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchFacilities = useCallback(async () => {
    const { data } = await supabase
      .from("facilities" as any)
      .select("id, name")
      .eq("active", true)
      .order("name");
    setFacilities((data ?? []) as unknown as { id: string; name: string }[]);
  }, []);

  useEffect(() => { fetchFacilities(); }, [fetchFacilities]);

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error("Facility name is required"); return; }
    setSaving(true);
    const { data: companyId } = await supabase.rpc("get_my_company_id");
    const { error } = await supabase.from("facilities" as any).insert({
      name: newName.trim(),
      facility_type: "dialysis",
      address: newAddress || null,
      company_id: companyId,
    });
    if (error) { toast.error("Failed to create facility"); setSaving(false); return; }
    toast.success("Facility created");
    onChange(newName.trim());
    setCreateOpen(false);
    setNewName("");
    setNewAddress("");
    setSaving(false);
    fetchFacilities();
  };

  // Match current value to a facility name
  const currentMatch = facilities.find(f => f.name === value);

  return (
    <div className="flex gap-1.5">
      <Select
        value={currentMatch ? value : "__custom__"}
        onValueChange={(v) => {
          if (v === "__create__") {
            setCreateOpen(true);
          } else if (v === "__custom__") {
            // keep current typed value
          } else {
            onChange(v);
          }
        }}
      >
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Select facility…">
            {value || "Select facility…"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {facilities.map((f) => (
            <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>
          ))}
          <SelectItem value="__create__">
            <span className="flex items-center gap-1.5 text-primary">
              <Plus className="h-3 w-3" /> Create New Facility
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Quick Add Facility</DialogTitle>
            <DialogDescription>Create a new facility and link it to this patient.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Facility Name *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. DaVita North" />
            </div>
            <div>
              <Label>Address</Label>
              <Input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="Optional" />
            </div>
            <Button className="w-full" onClick={handleCreate} disabled={saving}>
              {saving ? "Creating…" : "Create & Select"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


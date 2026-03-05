import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ConfirmActionDialog } from "@/components/ConfirmActionDialog";
import { Building2, Plus, Search, Users, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Facility {
  id: string;
  name: string;
  facility_type: string;
  address: string | null;
  phone: string | null;
  contact_name: string | null;
  notes: string | null;
  active: boolean;
  contract_payer_type: string | null;
  rate_type: string | null;
  invoice_preference: string | null;
  patient_count?: number;
}

const TYPE_LABELS: Record<string, string> = {
  dialysis: "Dialysis",
  hospital: "Hospital",
  snf: "SNF / Nursing",
};

const TYPE_COLORS: Record<string, string> = {
  dialysis: "bg-primary/10 text-primary",
  hospital: "bg-[hsl(var(--status-red))]/10 text-[hsl(var(--status-red))]",
  snf: "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]",
};

export default function FacilitiesPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Facility | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Facility | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    name: "", facility_type: "dialysis", address: "", phone: "", contact_name: "", notes: "", active: true,
    contract_payer_type: "", rate_type: "medicare", invoice_preference: "per_trip",
  });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: facilityRows } = await supabase.from("facilities" as any).select("*").order("name");
    const { data: patients } = await supabase.from("patients").select("dropoff_facility");
    const countMap = new Map<string, number>();
    (patients ?? []).forEach((p: any) => {
      if (p.dropoff_facility) countMap.set(p.dropoff_facility, (countMap.get(p.dropoff_facility) ?? 0) + 1);
    });
    setFacilities(((facilityRows ?? []) as any[]).map((f: any) => ({ ...f, patient_count: countMap.get(f.name) ?? 0 })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => {
    setForm({ name: "", facility_type: "dialysis", address: "", phone: "", contact_name: "", notes: "", active: true, contract_payer_type: "", rate_type: "medicare", invoice_preference: "per_trip" });
    setEditing(null);
  };

  const openEdit = (f: Facility) => {
    setEditing(f);
    setForm({
      name: f.name, facility_type: f.facility_type, address: f.address ?? "",
      phone: f.phone ?? "", contact_name: f.contact_name ?? "", notes: f.notes ?? "", active: f.active,
      contract_payer_type: f.contract_payer_type ?? "", rate_type: f.rate_type ?? "medicare",
      invoice_preference: f.invoice_preference ?? "per_trip",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Facility name required"); return; }
    setSaving(true);
    const { data: companyId } = await supabase.rpc("get_my_company_id");
    const payload = {
      name: form.name.trim(), facility_type: form.facility_type, address: form.address || null,
      phone: form.phone || null, contact_name: form.contact_name || null, notes: form.notes || null,
      active: form.active, company_id: companyId,
      contract_payer_type: form.contract_payer_type || null,
      rate_type: form.rate_type || null,
      invoice_preference: form.invoice_preference || null,
    };

    if (editing) {
      await supabase.from("facilities" as any).update(payload).eq("id", editing.id);
      toast.success("Facility updated");
    } else {
      await supabase.from("facilities" as any).insert(payload);
      toast.success("Facility added");
    }
    setDialogOpen(false);
    resetForm();
    fetchData();
    setSaving(false);
  };

  const filtered = facilities.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="relative max-w-xs flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search facilities…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" />Add Facility
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <Building2 className="h-8 w-8 opacity-30" />
            <p className="text-sm">No facilities yet. Add your dialysis centers, hospitals, and SNFs.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(f => (
              <div key={f.id} className={`rounded-lg border bg-card p-5 space-y-3 ${!f.active ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{f.name}</p>
                    {f.address && <p className="text-xs text-muted-foreground truncate mt-0.5">{f.address}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_COLORS[f.facility_type] ?? "bg-muted text-muted-foreground"}`}>
                      {TYPE_LABELS[f.facility_type] ?? f.facility_type}
                    </span>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(f)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(f)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {f.phone && <span>📞 {f.phone}</span>}
                  {f.contact_name && <span>👤 {f.contact_name}</span>}
                  {f.rate_type && <span className="capitalize">💲 {f.rate_type}</span>}
                  {f.contract_payer_type && <span className="capitalize">📄 {f.contract_payer_type}</span>}
                </div>
                <div className="flex items-center gap-2 pt-1 border-t">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{f.patient_count} active patients</span>
                  {!f.active && <Badge variant="secondary" className="text-[10px] ml-auto">Inactive</Badge>}
                </div>
                {f.notes && <p className="text-xs text-muted-foreground border-t pt-2 line-clamp-2">{f.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Facility" : "Add Facility"}</DialogTitle>
            <DialogDescription>Dialysis centers, hospitals, SNFs, and other destinations.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Facility Name *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.facility_type} onValueChange={v => setForm({ ...form, facility_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dialysis">Dialysis</SelectItem>
                  <SelectItem value="hospital">Hospital</SelectItem>
                  <SelectItem value="snf">SNF / Nursing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Address</Label>
              <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Contact Name</Label><Input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} /></div>
            </div>

            {/* Contract fields */}
            <div className="border-t pt-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contract Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Contract Payer Type</Label>
                  <Select value={form.contract_payer_type || ""} onValueChange={v => setForm({ ...form, contract_payer_type: v })}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="medicare">Medicare</SelectItem>
                      <SelectItem value="medicaid">Medicaid</SelectItem>
                      <SelectItem value="facility">Facility Contract</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Rate Type</Label>
                  <Select value={form.rate_type} onValueChange={v => setForm({ ...form, rate_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="medicare">Medicare</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Invoice Preference</Label>
                <Select value={form.invoice_preference} onValueChange={v => setForm({ ...form, invoice_preference: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_trip">Per Trip</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 accent-primary" />
            </div>
            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Facility"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Facility</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                if (!deleteTarget) return;
                setDeleting(true);
                const { error } = await supabase.from("facilities" as any).delete().eq("id", deleteTarget.id);
                if (error) { toast.error("Failed to delete facility"); }
                else { toast.success("Facility deleted"); }
                setDeleting(false);
                setDeleteTarget(null);
                fetchData();
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

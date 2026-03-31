import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { logAuditEvent } from "@/lib/audit-logger";

const INCIDENT_TYPES = [
  "Vehicle Accident",
  "Patient Fall",
  "Patient Refusal",
  "Equipment Failure",
  "Crew Injury",
  "Other",
];

interface Props {
  open: boolean;
  onClose: () => void;
  defaultTruckId?: string | null;
  defaultPatientName?: string;
}

export function IncidentReportForm({ open, onClose, defaultTruckId, defaultPatientName }: Props) {
  const { user, activeCompanyId } = useAuth();
  const [trucks, setTrucks] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    incident_date: new Date().toISOString().slice(0, 16),
    truck_id: defaultTruckId ?? "",
    patient_name: defaultPatientName ?? "",
    incident_type: "Other",
    description: "",
    emergency_services_contacted: false,
    crew_names: "",
  });

  useEffect(() => {
    supabase.from("trucks").select("id, name").eq("active", true).order("name")
      .then(({ data }) => setTrucks(data ?? []));
  }, []);

  useEffect(() => {
    if (defaultTruckId) setForm(f => ({ ...f, truck_id: defaultTruckId }));
  }, [defaultTruckId]);

  const handleSubmit = async () => {
    if (!user || !activeCompanyId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("incident_reports" as any).insert({
        company_id: activeCompanyId,
        submitted_by: user.id,
        truck_id: form.truck_id || null,
        incident_date: new Date(form.incident_date).toISOString(),
        incident_type: form.incident_type,
        description: form.description || null,
        emergency_services_contacted: form.emergency_services_contacted,
        crew_names: form.crew_names || null,
      });
      if (error) throw error;
      await logAuditEvent({
        action: "incident_report",
        tableName: "incident_reports",
        notes: `${form.incident_type} — ${form.patient_name || "No patient"}`,
      });
      toast.success("Incident report submitted");
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to submit");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Incident Report</DialogTitle>
          <DialogDescription>Document safety events for compliance and review.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Date & Time of Incident *</Label>
            <Input type="datetime-local" value={form.incident_date} onChange={e => setForm({ ...form, incident_date: e.target.value })} />
          </div>
          <div>
            <Label>Truck / Unit</Label>
            <Select value={form.truck_id} onValueChange={v => setForm({ ...form, truck_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select truck" /></SelectTrigger>
              <SelectContent>
                {trucks.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Crew Involved</Label>
            <Input placeholder="Names of crew members" value={form.crew_names} onChange={e => setForm({ ...form, crew_names: e.target.value })} />
          </div>
          <div>
            <Label>Patient Name (if applicable)</Label>
            <Input placeholder="Patient name" value={form.patient_name} onChange={e => setForm({ ...form, patient_name: e.target.value })} />
          </div>
          <div>
            <Label>Incident Type *</Label>
            <Select value={form.incident_type} onValueChange={v => setForm({ ...form, incident_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INCIDENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe what happened..." />
          </div>
          <div className="flex items-center justify-between">
            <Label>Emergency Services Contacted?</Label>
            <Switch checked={form.emergency_services_contacted} onCheckedChange={v => setForm({ ...form, emergency_services_contacted: v })} />
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={saving || !form.incident_type}>
            {saving ? "Submitting..." : "Submit Incident Report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

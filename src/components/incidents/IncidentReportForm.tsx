import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { logAuditEvent } from "@/lib/audit-logger";

const INCIDENT_TYPES = [
  "Patient Refused Transport",
  "Patient Fall During Transfer",
  "Vehicle Accident",
  "Patient Adverse Medical Event",
  "Equipment Failure",
  "Scene Safety Issue",
  "Other",
];

const PATIENT_AFFECTED_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "not_applicable", label: "N/A" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  defaultTruckId?: string | null;
  defaultTruckName?: string;
  defaultTripId?: string | null;
  defaultPatientName?: string;
  defaultCompanyId?: string | null;
}

export function IncidentReportForm({
  open, onClose,
  defaultTruckId, defaultTruckName,
  defaultTripId, defaultPatientName,
  defaultCompanyId,
}: Props) {
  const { user, activeCompanyId } = useAuth();
  const [saving, setSaving] = useState(false);
  const companyId = defaultCompanyId ?? activeCompanyId;

  const [form, setForm] = useState({
    incident_time: new Date().toISOString().slice(0, 16),
    incident_type: "Other",
    description: "",
    patient_affected: "not_applicable",
    emergency_services_contacted: false,
    additional_personnel: "",
  });

  // Reset form when opened
  useEffect(() => {
    if (open) {
      setForm({
        incident_time: new Date().toISOString().slice(0, 16),
        incident_type: "Other",
        description: "",
        patient_affected: "not_applicable",
        emergency_services_contacted: false,
        additional_personnel: "",
      });
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!user || !companyId) return;
    if (!form.description.trim()) {
      toast.error("Please describe what happened");
      return;
    }
    setSaving(true);
    try {
      const { data: inserted, error } = await supabase.from("incident_reports").insert({
        company_id: companyId,
        submitted_by: user.id,
        truck_id: defaultTruckId || null,
        trip_id: defaultTripId || null,
        incident_date: new Date(form.incident_time).toISOString(),
        incident_type: form.incident_type,
        description: form.description.trim(),
        patient_affected: form.patient_affected,
        emergency_services_contacted: form.emergency_services_contacted,
        crew_names: null,
        additional_personnel: form.additional_personnel.trim() || null,
        status: "open",
      } as any).select("id").single();

      if (error) throw error;

      // Audit log
      await logAuditEvent({
        action: "incident_report",
        tableName: "incident_reports",
        recordId: inserted?.id,
        notes: `${form.incident_type} reported${defaultPatientName ? ` — Patient: ${defaultPatientName}` : ""}`,
      });

      // Send notifications to dispatchers and owners
      const { data: recipients } = await supabase
        .from("company_memberships")
        .select("user_id")
        .eq("company_id", companyId)
        .in("role", ["dispatcher", "owner"] as any);

      if (recipients?.length) {
        const truckLabel = defaultTruckName ?? "Unknown unit";
        const timeLabel = new Date(form.incident_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        const notifMessage = `⚠️ Incident Report: ${form.incident_type} — ${truckLabel} at ${timeLabel}${form.emergency_services_contacted ? " — Emergency services called" : ""}`;

        const notifRows = recipients.map(r => ({
          user_id: r.user_id,
          message: notifMessage,
          notification_type: "incident",
          acknowledged: false,
        }));

        await supabase.from("notifications").insert(notifRows);
      }

      // Create red dispatch alert
      await supabase.from("alerts").insert({
        message: `🚨 Incident: ${form.incident_type} — ${defaultTruckName ?? "Unit"}${form.emergency_services_contacted ? " [EMS CALLED]" : ""}`,
        severity: "red",
        truck_id: defaultTruckId || null,
        company_id: companyId,
        dismissed: false,
      });

      toast.success("Incident report submitted");
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to submit incident report");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Report Incident</DialogTitle>
          <DialogDescription>
            Document a field incident for compliance review.
            {defaultPatientName && <span className="block mt-1 font-medium text-foreground">Patient: {defaultPatientName}</span>}
            {defaultTruckName && <span className="block text-foreground">Unit: {defaultTruckName}</span>}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
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
            <Label>Incident Time</Label>
            <Input type="datetime-local" value={form.incident_time} onChange={e => setForm({ ...form, incident_time: e.target.value })} />
          </div>

          <div>
            <Label>Description *</Label>
            <Textarea
              rows={4}
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Describe what happened, including sequence of events and any contributing factors..."
            />
          </div>

          <div>
            <Label>Was the patient affected?</Label>
            <div className="flex gap-2 mt-1">
              {PATIENT_AFFECTED_OPTIONS.map(opt => (
                <Button
                  key={opt.value}
                  type="button"
                  size="sm"
                  variant={form.patient_affected === opt.value ? "default" : "outline"}
                  className="flex-1 h-8 text-xs"
                  onClick={() => setForm({ ...form, patient_affected: opt.value })}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label>Were EMS / Emergency Services called?</Label>
            <div className="flex gap-2 mt-1">
              <Button
                type="button"
                size="sm"
                variant={form.emergency_services_contacted ? "destructive" : "outline"}
                className="flex-1 h-8 text-xs"
                onClick={() => setForm({ ...form, emergency_services_contacted: true })}
              >
                Yes
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!form.emergency_services_contacted ? "default" : "outline"}
                className="flex-1 h-8 text-xs"
                onClick={() => setForm({ ...form, emergency_services_contacted: false })}
              >
                No
              </Button>
            </div>
          </div>

          <div>
            <Label>Additional crew or witness names</Label>
            <Input
              value={form.additional_personnel}
              onChange={e => setForm({ ...form, additional_personnel: e.target.value })}
              placeholder="Names of other crew or witnesses involved"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={saving || !form.incident_type || !form.description.trim()}
            >
              {saving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Submitting…</> : "Submit Report"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

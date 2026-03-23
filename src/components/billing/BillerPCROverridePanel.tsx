import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface TripData {
  id: string;
  loaded_miles: number | null;
  origin_type: string | null;
  destination_type: string | null;
  service_level: string | null;
  stretcher_placement: string | null;
  patient_mobility: string | null;
  odometer_at_scene: number | null;
  odometer_at_destination: number | null;
  odometer_in_service: number | null;
  dispatch_time: string | null;
  at_scene_time: string | null;
  left_scene_time: string | null;
  arrived_dropoff_at: string | null;
  in_service_time: string | null;
  hcpcs_codes: string[] | null;
  vehicle_id: string | null;
  patient_name?: string;
}

interface BillerPCROverridePanelProps {
  trip: TripData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const LOCATION_TYPES = ["residence", "dialysis_facility", "hospital", "snf", "assisted_living", "doctors_office", "other"];
const SERVICE_LEVELS = ["BLS", "ALS1", "ALS2", "bariatric"];
const STRETCHER_OPTIONS = ["Draw Sheet", "Manual Lift", "Mechanical Lift", "Backboard", "First Responders / Fire / Rescue"];
const MOBILITY_OPTIONS = ["Requires Maximum Assistance", "Unable to Ambulate", "Assisted Ambulation", "Independent with Device"];

export function BillerPCROverridePanel({ trip, open, onOpenChange, onSaved }: BillerPCROverridePanelProps) {
  const { profileId } = useAuth();
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");

  const [form, setForm] = useState({
    loaded_miles: trip.loaded_miles?.toString() ?? "",
    origin_type: trip.origin_type ?? "",
    destination_type: trip.destination_type ?? "",
    service_level: trip.service_level ?? "BLS",
    stretcher_placement: trip.stretcher_placement ?? "",
    patient_mobility: trip.patient_mobility ?? "",
  });

  const handleSave = async () => {
    if (!reason.trim()) {
      toast.error("Override reason is required");
      return;
    }

    setSaving(true);
    try {
      // Build changes object — only include fields that actually changed
      const changes: Record<string, { old: any; new: any }> = {};
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };

      const checkField = (key: string, oldVal: any, newVal: any) => {
        const oldStr = oldVal?.toString() ?? "";
        const newStr = newVal?.toString() ?? "";
        if (oldStr !== newStr) {
          changes[key] = { old: oldVal, new: newVal || null };
          updates[key] = newVal || null;
        }
      };

      checkField("loaded_miles", trip.loaded_miles, form.loaded_miles ? parseFloat(form.loaded_miles) : null);
      checkField("origin_type", trip.origin_type, form.origin_type);
      checkField("destination_type", trip.destination_type, form.destination_type);
      checkField("service_level", trip.service_level, form.service_level);
      checkField("stretcher_placement", trip.stretcher_placement, form.stretcher_placement);
      checkField("patient_mobility", trip.patient_mobility, form.patient_mobility);

      if (Object.keys(changes).length === 0) {
        toast.info("No fields were changed");
        setSaving(false);
        return;
      }

      // Update trip_records
      const { error: tripError } = await supabase
        .from("trip_records")
        .update(updates)
        .eq("id", trip.id);

      if (tripError) throw tripError;

      // Insert billing_overrides audit record
      const snapshot = {
        action: "pcr_correction",
        fields_changed: changes,
      };

      const { error: overrideError } = await supabase
        .from("billing_overrides")
        .insert({
          trip_id: trip.id,
          override_reason: reason.trim(),
          overridden_by: profileId,
          overridden_at: new Date().toISOString(),
          user_id: profileId,
          reason: reason.trim(),
          is_active: true,
          snapshot,
          previous_blockers_snapshot: snapshot,
          previous_blockers: Object.keys(changes),
        } as any);

      if (overrideError) throw overrideError;

      toast.success("PCR correction saved with audit trail");
      setReason("");
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error(`Failed to save correction: ${err.message}`);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            Correct PCR — {trip.patient_name ?? "Trip"}
          </DialogTitle>
          <DialogDescription>
            Edit billing-relevant fields. All changes are logged with your override reason.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Read-only summary */}
          <div className="rounded-md border bg-muted/30 p-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Current Record</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <p>Vehicle: <span className="font-medium">{trip.vehicle_id ?? "—"}</span></p>
              <p>HCPCS: <span className="font-mono font-medium">{trip.hcpcs_codes?.join(", ") ?? "—"}</span></p>
              <p>Odometer Scene: <span className="font-medium">{trip.odometer_at_scene ?? "—"}</span></p>
              <p>Odometer Dest: <span className="font-medium">{trip.odometer_at_destination ?? "—"}</span></p>
              <p>Dispatch: <span className="font-medium">{trip.dispatch_time ? new Date(trip.dispatch_time).toLocaleTimeString() : "—"}</span></p>
              <p>At Scene: <span className="font-medium">{trip.at_scene_time ? new Date(trip.at_scene_time).toLocaleTimeString() : "—"}</span></p>
            </div>
          </div>

          {/* Editable fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Loaded Miles</Label>
              <Input type="number" step="0.1" value={form.loaded_miles}
                onChange={e => setForm({ ...form, loaded_miles: e.target.value })} />
            </div>
            <div>
              <Label>Service Level</Label>
              <Select value={form.service_level} onValueChange={v => setForm({ ...form, service_level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SERVICE_LEVELS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Origin Type</Label>
              <Select value={form.origin_type} onValueChange={v => setForm({ ...form, origin_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {LOCATION_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Destination Type</Label>
              <Select value={form.destination_type} onValueChange={v => setForm({ ...form, destination_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {LOCATION_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Stretcher Placement</Label>
              <Select value={form.stretcher_placement} onValueChange={v => setForm({ ...form, stretcher_placement: v })}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {STRETCHER_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Patient Mobility</Label>
              <Select value={form.patient_mobility} onValueChange={v => setForm({ ...form, patient_mobility: v })}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {MOBILITY_OPTIONS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Mandatory reason */}
          <div>
            <Label className="text-destructive">Reason for Correction *</Label>
            <Textarea
              rows={2}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Explain why this correction is being made..."
              className="border-destructive/30 focus-visible:ring-destructive/30"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !reason.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Correction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

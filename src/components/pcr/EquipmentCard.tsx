import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { OXYGEN_DELIVERY, STRETCHER_TYPES } from "@/lib/pcr-dropdowns";

interface Props {
  trip: any;
  updateField: (field: string, value: any) => Promise<void>;
}

const AED_OUTCOMES = [
  { value: "no_shock", label: "Applied — no shock delivered" },
  { value: "shock_delivered", label: "Applied — shock delivered" },
];

const RESTRAINT_TYPES = [
  "Soft wrist restraints",
  "Hard restraints",
  "Sheet wrap",
  "Law enforcement restraints",
  "Chemical restraint — medication given",
];

export function EquipmentCard({ trip, updateField }: Props) {
  const eq = trip.equipment_used_json || {};

  const update = (key: string, value: any) => {
    updateField("equipment_used_json", { ...eq, [key]: value });
  };

  return (
    <div className="space-y-5 p-4">
      {/* Oxygen */}
      <div className="space-y-2">
        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <Checkbox checked={eq.oxygen || false} onCheckedChange={(c) => update("oxygen", !!c)} />
          Oxygen in Use
        </label>
        {eq.oxygen && (
          <div className="ml-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className="text-sm font-medium text-muted-foreground block">Flow Rate (LPM)</label>
              <Input type="number" inputMode="decimal" placeholder="2" value={eq.oxygen_flow_rate || ""}
                onChange={(e) => update("oxygen_flow_rate", e.target.value)} className="h-11" />
            </div>
            <div className="min-w-0">
              <label className="text-sm font-medium text-muted-foreground block">Delivery Method</label>
              <Select value={eq.oxygen_delivery_method || ""} onValueChange={(v) => update("oxygen_delivery_method", v)}>
                <SelectTrigger className="h-11 w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {OXYGEN_DELIVERY.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Stretcher */}
      <div>
        <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider block mb-1">Stretcher Type</label>
        <Select value={eq.stretcher_type || ""} onValueChange={(v) => update("stretcher_type", v)}>
          <SelectTrigger className="h-11 text-base w-full"><SelectValue placeholder="Select..." /></SelectTrigger>
          <SelectContent>
            {STRETCHER_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Simple toggles */}
      <div className="space-y-2">
        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <Checkbox checked={eq.stair_chair || false} onCheckedChange={(c) => update("stair_chair", !!c)} />
          Stair Chair Used
        </label>
        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <Checkbox checked={eq.cardiac_monitor || false} onCheckedChange={(c) => update("cardiac_monitor", !!c)} />
          Cardiac Monitor
        </label>
        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <Checkbox checked={eq.suction_unit || false} onCheckedChange={(c) => update("suction_unit", !!c)} />
          Suction Unit Used
        </label>
        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <Checkbox checked={eq.iv_pump_continued || false} onCheckedChange={(c) => update("iv_pump_continued", !!c)} />
          IV Pump Continued From Facility
        </label>
        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <Checkbox checked={eq.feeding_pump_continued || false} onCheckedChange={(c) => update("feeding_pump_continued", !!c)} />
          Feeding Pump Continued
        </label>
        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <Checkbox checked={eq.glucometer_used || false} onCheckedChange={(c) => update("glucometer_used", !!c)} />
          Glucometer Used
        </label>
        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <Checkbox checked={eq.c_collar || false} onCheckedChange={(c) => update("c_collar", !!c)} />
          C-Collar Applied
        </label>
        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <Checkbox checked={eq.spinal_motion_restriction || false} onCheckedChange={(c) => update("spinal_motion_restriction", !!c)} />
          Spinal Motion Restriction
        </label>
      </div>

      {/* Wound VAC */}
      <div className="rounded-md border p-3 space-y-2">
        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <Checkbox checked={eq.wound_vac || false} onCheckedChange={(c) => update("wound_vac", !!c)} />
          Wound VAC
        </label>
        {eq.wound_vac && (
          <div>
            <Label className="text-xs text-muted-foreground">Pressure Setting</Label>
            <Input value={eq.wound_vac_pressure || ""} placeholder="e.g., -125 mmHg"
              onChange={(e) => update("wound_vac_pressure", e.target.value)} className="h-10 mt-1" />
          </div>
        )}
      </div>

      {/* AED — writes top-level aed_used */}
      <div className="rounded-md border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">AED Applied</Label>
          <Switch
            checked={!!trip.aed_used}
            onCheckedChange={(v) => updateField("aed_used", v)}
          />
        </div>
        {trip.aed_used && (
          <div className="space-y-2">
            <div>
              <Label className="text-xs text-muted-foreground">Outcome</Label>
              <Select value={eq.aed_outcome || ""} onValueChange={(v) => update("aed_outcome", v)}>
                <SelectTrigger className="h-10 mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {AED_OUTCOMES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {eq.aed_outcome === "shock_delivered" && (
              <div>
                <Label className="text-xs text-muted-foreground">Shock Count</Label>
                <Input type="number" inputMode="numeric" min="1" value={eq.aed_shock_count || ""}
                  onChange={(e) => update("aed_shock_count", e.target.value)} className="h-10 mt-1" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Splints */}
      <div className="rounded-md border p-3 space-y-2">
        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <Checkbox checked={eq.splints_applied || false} onCheckedChange={(c) => update("splints_applied", !!c)} />
          Splints Applied
        </label>
        {eq.splints_applied && (
          <div>
            <Label className="text-xs text-muted-foreground">Location</Label>
            <Input value={eq.splints_location || ""} placeholder="e.g., right forearm"
              onChange={(e) => update("splints_location", e.target.value)} className="h-10 mt-1" />
          </div>
        )}
      </div>

      {/* Restraints — writes top-level restraints_applied */}
      <div className="rounded-md border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Restraints Applied</Label>
          <Switch
            checked={!!trip.restraints_applied}
            onCheckedChange={(v) => updateField("restraints_applied", v)}
          />
        </div>
        {trip.restraints_applied && (
          <div className="space-y-2">
            <div>
              <Label className="text-xs text-muted-foreground">Restraint Type</Label>
              <Select value={eq.restraint_type || ""} onValueChange={(v) => update("restraint_type", v)}>
                <SelectTrigger className="h-10 mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {RESTRAINT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Reason</Label>
              <Textarea rows={2} value={eq.restraint_reason || ""}
                onChange={(e) => update("restraint_reason", e.target.value)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Neurovascular checks documented</Label>
              <Switch
                checked={!!eq.neurovascular_checks_documented}
                onCheckedChange={(v) => update("neurovascular_checks_documented", v)}
              />
            </div>
            {eq.neurovascular_checks_documented && (
              <div>
                <Label className="text-xs text-muted-foreground">Check Times</Label>
                <Input value={eq.neurovascular_check_times || ""} placeholder="e.g., 14:05, 14:25, 14:45"
                  onChange={(e) => update("neurovascular_check_times", e.target.value)} className="h-10 mt-1" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Patient's own equipment */}
      <div className="rounded-md border p-3 space-y-2">
        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <Checkbox checked={eq.patient_own_equipment || false} onCheckedChange={(c) => update("patient_own_equipment", !!c)} />
          Patient's Own Equipment Continued
        </label>
        {eq.patient_own_equipment && (
          <div>
            <Label className="text-xs text-muted-foreground">Description (CPAP, oxygen concentrator, walker, etc.)</Label>
            <Textarea rows={2} value={eq.patient_own_equipment_detail || ""}
              onChange={(e) => update("patient_own_equipment_detail", e.target.value)} />
          </div>
        )}
      </div>

      {/* Other free text */}
      <div>
        <label className="text-sm font-medium text-muted-foreground block mb-1">Other Equipment</label>
        <Input placeholder="Other equipment used..." value={eq.other || ""}
          onChange={(e) => update("other", e.target.value)} className="h-11" />
      </div>
    </div>
  );
}

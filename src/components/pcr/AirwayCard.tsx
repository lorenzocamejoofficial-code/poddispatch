import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OXYGEN_DELIVERY } from "@/lib/pcr-dropdowns";

interface Props {
  trip: any;
  updateField: (field: string, value: any) => Promise<void>;
  requiredFields?: string[];
}

const AIRWAY_STATUS = [
  "Patent and self-maintained",
  "Snoring respirations",
  "Gurgling respirations",
  "Stridor present",
  "Apneic",
  "Obstructed",
];

const INTERVENTIONS = [
  "None required",
  "Repositioning and airway opening maneuver",
  "Oral airway adjunct (OPA)",
  "Nasal airway adjunct (NPA)",
  "Bag valve mask ventilation",
  "Suction performed",
  "CPAP applied",
  "King airway inserted",
  "Endotracheal intubation",
];

const SUCTION_TYPES = ["Bulb", "Yankauer", "In-line"];

const CONFIRMATION_METHODS = [
  "Bilateral breath sounds",
  "Waveform capnography",
  "Colorimetric CO2 detector",
  "Chest rise visualization",
];

const RedDot = () => <span className="text-destructive ml-1">●</span>;

export function AirwayCard({ trip, updateField, requiredFields = [] }: Props) {
  const data = trip.airway_json || {};
  const interventions: string[] = Array.isArray(data.interventions) ? data.interventions : [];
  const confirmations: string[] = Array.isArray(data.intubation_confirmation) ? data.intubation_confirmation : [];

  const reqStatus = requiredFields.includes("airway_status");
  const reqIntervention = requiredFields.includes("airway_intervention");

  const update = (key: string, value: any) => {
    updateField("airway_json", { ...data, [key]: value });
  };

  const toggleIntervention = (label: string, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...interventions, label]))
      : interventions.filter((i) => i !== label);
    update("interventions", next);
  };

  const toggleConfirmation = (label: string, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...confirmations, label]))
      : confirmations.filter((i) => i !== label);
    update("intubation_confirmation", next);
  };

  const has = (label: string) => interventions.includes(label);

  return (
    <div className="space-y-5 p-4">
      <div>
        <label className="text-sm font-medium block mb-1">
          Airway status at patient contact{reqStatus && <RedDot />}
        </label>
        <Select value={data.airway_status || ""} onValueChange={(v) => update("airway_status", v)}>
          <SelectTrigger className="h-11"><SelectValue placeholder="Select airway status..." /></SelectTrigger>
          <SelectContent>
            {AIRWAY_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium block mb-2">
          Airway intervention performed{reqIntervention && <RedDot />}
        </label>
        <div className="space-y-2">
          {INTERVENTIONS.map((label) => (
            <label key={label} className="flex items-start gap-3 text-sm cursor-pointer">
              <Checkbox
                checked={interventions.includes(label)}
                onCheckedChange={(c) => toggleIntervention(label, !!c)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      {has("Suction performed") && (
        <div className="ml-7 border-l-2 border-muted pl-4">
          <label className="text-sm font-medium block mb-1">Suction type</label>
          <Select value={data.suction_type || ""} onValueChange={(v) => update("suction_type", v)}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {SUCTION_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {has("Bag valve mask ventilation") && (
        <div className="ml-7 border-l-2 border-muted pl-4 space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">BVM rate (breaths/min)</label>
            <Input
              type="number"
              inputMode="numeric"
              value={data.bvm_rate || ""}
              onChange={(e) => update("bvm_rate", e.target.value)}
              className="h-11"
            />
          </div>
          <label className="flex items-center gap-3 text-sm">
            <Switch
              checked={!!data.bvm_with_o2}
              onCheckedChange={(c) => update("bvm_with_o2", !!c)}
            />
            BVM with supplemental oxygen
          </label>
        </div>
      )}

      {has("CPAP applied") && (
        <div className="ml-7 border-l-2 border-muted pl-4 space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">CPAP pressure setting (cmH2O)</label>
            <Input
              type="number"
              inputMode="decimal"
              value={data.cpap_pressure || ""}
              onChange={(e) => update("cpap_pressure", e.target.value)}
              className="h-11"
            />
          </div>
          <label className="flex items-center gap-3 text-sm">
            <Switch
              checked={!!data.cpap_seal_adequate}
              onCheckedChange={(c) => update("cpap_seal_adequate", !!c)}
            />
            CPAP mask seal adequate
          </label>
        </div>
      )}

      {(has("King airway inserted") || has("Endotracheal intubation")) && (
        <div className="ml-7 border-l-2 border-muted pl-4">
          <label className="text-sm font-medium block mb-2">Confirmation method (select all used)</label>
          <div className="space-y-2">
            {CONFIRMATION_METHODS.map((m) => (
              <label key={m} className="flex items-start gap-3 text-sm cursor-pointer">
                <Checkbox
                  checked={confirmations.includes(m)}
                  onCheckedChange={(c) => toggleConfirmation(m, !!c)}
                />
                <span>{m}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium block mb-1">Oxygen delivery</label>
          <Select value={data.oxygen_delivery || ""} onValueChange={(v) => update("oxygen_delivery", v)}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {OXYGEN_DELIVERY.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Flow rate (LPM)</label>
          <Input
            type="number"
            inputMode="decimal"
            value={data.oxygen_flow_rate || ""}
            onChange={(e) => update("oxygen_flow_rate", e.target.value)}
            className="h-11"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium block mb-1">Airway notes</label>
        <Textarea
          rows={3}
          value={data.notes || ""}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Additional findings, interventions, or response..."
        />
      </div>
    </div>
  );
}
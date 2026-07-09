import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  E_AIRWAY_STATUS,
  E_AIRWAY_INTERVENTIONS,
  E_SUCTION_TYPE,
  E_AIRWAY_CONFIRMATION,
  E_OXYGEN_DELIVERY,
  findByCode,
  findByDisplay,
  type NemsisCode,
} from "@/lib/nemsis-code-sets";

interface Props {
  trip: any;
  updateField: (field: string, value: any) => Promise<void>;
  requiredFields?: string[];
}

const RedDot = () => <span className="text-destructive ml-1">●</span>;

/**
 * Backward-compat: legacy PCRs stored the display string in these fields.
 * When we read the field, accept EITHER the NEMSIS code OR the legacy display.
 * When we write, we now store the NEMSIS code.
 */
const resolveEntry = (
  codes: readonly NemsisCode[],
  storedValue: string | null | undefined,
): NemsisCode | null =>
  findByCode(codes, storedValue) ?? findByDisplay(codes, storedValue);

export function AirwayCard({ trip, updateField, requiredFields = [] }: Props) {
  const data = trip.airway_json || {};
  const rawInterventions: string[] = Array.isArray(data.interventions) ? data.interventions : [];
  const rawConfirmations: string[] = Array.isArray(data.intubation_confirmation) ? data.intubation_confirmation : [];

  // Normalize legacy stored displays to their NEMSIS codes for selection state.
  const interventionCodes = rawInterventions
    .map((v) => resolveEntry(E_AIRWAY_INTERVENTIONS, v)?.code ?? v)
    .filter(Boolean);
  const confirmationCodes = rawConfirmations
    .map((v) => resolveEntry(E_AIRWAY_CONFIRMATION, v)?.code ?? v)
    .filter(Boolean);

  const reqStatus = requiredFields.includes("airway_status");
  const reqIntervention = requiredFields.includes("airway_intervention");

  const update = (key: string, value: any) => {
    updateField("airway_json", { ...data, [key]: value });
  };

  const toggleIntervention = (code: string, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...interventionCodes, code]))
      : interventionCodes.filter((i) => i !== code);
    update("interventions", next);
  };

  const toggleConfirmation = (code: string, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...confirmationCodes, code]))
      : confirmationCodes.filter((i) => i !== code);
    update("intubation_confirmation", next);
  };

  /** Check whether a given intervention (by display label) is currently selected. */
  const hasIntervention = (display: string): boolean => {
    const entry = E_AIRWAY_INTERVENTIONS.find((c) => c.display === display);
    if (!entry) return false;
    return interventionCodes.includes(entry.code);
  };

  // Resolve current airway_status to a NEMSIS code for the Select value.
  const currentAirwayStatusCode =
    resolveEntry(E_AIRWAY_STATUS, data.airway_status)?.code ?? "";
  const currentSuctionCode =
    resolveEntry(E_SUCTION_TYPE, data.suction_type)?.code ?? "";
  const currentOxygenDeliveryCode =
    resolveEntry(E_OXYGEN_DELIVERY, data.oxygen_delivery)?.code ?? "";

  return (
    <div className="space-y-5 p-4">
      <div>
        <label className="text-sm font-medium block mb-1">
          Airway status at patient contact{reqStatus && <RedDot />}
        </label>
        <Select value={currentAirwayStatusCode} onValueChange={(v) => update("airway_status", v)}>
          <SelectTrigger className="h-11"><SelectValue placeholder="Select airway status..." /></SelectTrigger>
          <SelectContent>
            {E_AIRWAY_STATUS.map((s) => <SelectItem key={s.code} value={s.code}>{s.display}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium block mb-2">
          Airway intervention performed{reqIntervention && <RedDot />}
        </label>
        <div className="space-y-2">
          {E_AIRWAY_INTERVENTIONS.map((entry) => (
            <label key={entry.code} className="flex items-start gap-3 text-sm cursor-pointer">
              <Checkbox
                checked={interventionCodes.includes(entry.code)}
                onCheckedChange={(c) => toggleIntervention(entry.code, !!c)}
              />
              <span>{entry.display}</span>
            </label>
          ))}
        </div>
      </div>

      {hasIntervention("Suction performed") && (
        <div className="ml-7 border-l-2 border-muted pl-4">
          <label className="text-sm font-medium block mb-1">Suction type</label>
          <Select value={currentSuctionCode} onValueChange={(v) => update("suction_type", v)}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {E_SUCTION_TYPE.map((s) => <SelectItem key={s.code} value={s.code}>{s.display}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {hasIntervention("Bag valve mask ventilation") && (
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

      {hasIntervention("CPAP applied") && (
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

      {(hasIntervention("King airway inserted") || hasIntervention("Endotracheal intubation")) && (
        <div className="ml-7 border-l-2 border-muted pl-4">
          <label className="text-sm font-medium block mb-2">Confirmation method (select all used)</label>
          <div className="space-y-2">
            {E_AIRWAY_CONFIRMATION.map((m) => (
              <label key={m.code} className="flex items-start gap-3 text-sm cursor-pointer">
                <Checkbox
                  checked={confirmationCodes.includes(m.code)}
                  onCheckedChange={(c) => toggleConfirmation(m.code, !!c)}
                />
                <span>{m.display}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium block mb-1">Oxygen delivery</label>
          <Select value={currentOxygenDeliveryCode} onValueChange={(v) => update("oxygen_delivery", v)}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {E_OXYGEN_DELIVERY.map((o) => <SelectItem key={o.code} value={o.code}>{o.display}</SelectItem>)}
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
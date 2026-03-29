import { useEffect, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { MEDICAL_NECESSITY_REASONS } from "@/lib/pcr-dropdowns";
import { PCRTooltip } from "@/components/pcr/PCRTooltip";
import { PCR_TOOLTIPS } from "@/lib/pcr-tooltips";

const NECESSITY_TEMPLATES: Record<string, string> = {
  dialysis: "Patient has end-stage renal disease (ESRD) requiring regular dialysis treatment. Patient is unable to safely use any other means of transportation due to medical condition requiring stretcher transport. Patient is bed-confined and/or cannot safely transfer to a seated position without medical assistance.",
  ift: "Patient requires interfacility transfer for medical care not available at the originating facility. Patient's condition requires ambulance transport as any other means of transportation would endanger the patient's health. Patient requires medical monitoring during transport.",
  discharge: "Patient is being discharged from medical facility and requires ambulance transport to destination. Patient's condition prevents safe transport by any other means. Patient requires stretcher transport due to medical condition.",
  outpatient: "Patient requires transport to outpatient medical appointment. Patient's medical condition necessitates ambulance transport as other transportation methods would endanger the patient's health. Patient is unable to safely use alternative transportation.",
  private_pay: "Patient requires medical transport. Stretcher transport is medically necessary due to patient's condition and mobility limitations.",
  emergency: "Patient presents with acute medical condition requiring emergency transport. Immediate ambulance transport is medically necessary.",
};

const NECESSITY_ITEMS = [
  { field: "bed_confined", label: "Patient is bed-confined at origin" },
  { field: "cannot_transfer_safely", label: "Cannot safely transfer without stretcher" },
  { field: "requires_monitoring", label: "Patient requires medical monitoring during transport" },
  { field: "oxygen_during_transport", label: "Oxygen required during transport" },
] as const;

interface Props {
  trip: any;
  updateField: (field: string, value: any) => Promise<void>;
}

export function MedicalNecessityCard({ trip, updateField }: Props) {
  const filledRef = useRef<string | null>(null);

  const transportType = trip.trip_type ?? "dialysis";
  const templateKey = transportType === "outpatient_specialty" ? "outpatient" : transportType;
  const template = NECESSITY_TEMPLATES[templateKey] ?? NECESSITY_TEMPLATES.dialysis;
  const templateLabel = templateKey.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

  useEffect(() => {
    if (!trip.id || filledRef.current === trip.id) return;
    if (!trip.necessity_notes) {
      updateField("necessity_notes", template);
    }
    filledRef.current = trip.id;
  }, [trip.id]);

  const handleCheckChange = async (field: string, checked: boolean) => {
    await updateField(field, checked);
    if (checked) {
      await updateField("clinical_note", "Medical necessity criteria documented in PCR");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center">
          Reason Ambulance is Medically Necessary <PCRTooltip text={PCR_TOOLTIPS.medical_necessity_reason} />
        </label>
        <Select value={trip.medical_necessity_reason || ""} onValueChange={(v) => updateField("medical_necessity_reason", v)}>
          <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Select reason..." /></SelectTrigger>
          <SelectContent>
            {MEDICAL_NECESSITY_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Medical necessity checklist */}
      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
          Medical Necessity Criteria
        </label>
        <div className="space-y-3">
          {NECESSITY_ITEMS.map(item => (
            <label key={item.field} className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={!!trip[item.field]}
                onCheckedChange={(checked) => handleCheckChange(item.field, !!checked)}
                className="mt-0.5"
              />
              <span className="text-sm leading-tight">{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      {trip.medical_necessity_reason === "Other" && (
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center">
            Specify Reason <PCRTooltip text={PCR_TOOLTIPS.necessity_notes} />
          </label>
          <Textarea placeholder="Specify medical necessity reason..."
            value={trip.necessity_notes || ""}
            onChange={(e) => updateField("necessity_notes", e.target.value)} rows={3} />
        </div>
      )}

      {trip.medical_necessity_reason && trip.medical_necessity_reason !== "Other" && (
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center">
            Additional Notes <PCRTooltip text={PCR_TOOLTIPS.necessity_notes} />
          </label>
          <p className="text-[10px] text-muted-foreground mb-1">Template: {templateLabel}</p>
          <Textarea placeholder="Additional notes (optional)..."
            value={trip.necessity_notes || ""}
            onChange={(e) => updateField("necessity_notes", e.target.value)} rows={4} />
          <button
            type="button"
            className="text-xs text-primary hover:underline mt-1"
            onClick={() => updateField("necessity_notes", template)}
          >
            Reset to default template
          </button>
        </div>
      )}

      {/* Show notes section even without a reason selected, for template auto-fill */}
      {!trip.medical_necessity_reason && (
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center">
            Medical Necessity Notes <PCRTooltip text={PCR_TOOLTIPS.necessity_notes} />
          </label>
          <p className="text-[10px] text-muted-foreground mb-1">Template: {templateLabel}</p>
          <Textarea placeholder="Medical necessity documentation..."
            value={trip.necessity_notes || ""}
            onChange={(e) => updateField("necessity_notes", e.target.value)} rows={4} />
          <button
            type="button"
            className="text-xs text-primary hover:underline mt-1"
            onClick={() => updateField("necessity_notes", template)}
          >
            Reset to default template
          </button>
        </div>
      )}
    </div>
  );
}
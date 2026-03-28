import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { MEDICAL_NECESSITY_REASONS } from "@/lib/pcr-dropdowns";
import { PCRTooltip } from "@/components/pcr/PCRTooltip";
import { PCR_TOOLTIPS } from "@/lib/pcr-tooltips";

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
  const handleCheckChange = async (field: string, checked: boolean) => {
    await updateField(field, checked);
    // When any criterion is checked, auto-set clinical_note for billing gate
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

      {/* Medical necessity checklist — writes directly to trip_records */}
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
          <Textarea placeholder="Additional notes (optional)..."
            value={trip.necessity_notes || ""}
            onChange={(e) => updateField("necessity_notes", e.target.value)} rows={2} />
        </div>
      )}
    </div>
  );
}

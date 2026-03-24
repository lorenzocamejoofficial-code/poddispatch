import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MEDICAL_NECESSITY_REASONS } from "@/lib/pcr-dropdowns";
import { PCRTooltip } from "@/components/pcr/PCRTooltip";
import { PCR_TOOLTIPS } from "@/lib/pcr-tooltips";

interface Props {
  trip: any;
  updateField: (field: string, value: any) => Promise<void>;
}

export function MedicalNecessityCard({ trip, updateField }: Props) {
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

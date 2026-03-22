import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MEDICAL_NECESSITY_REASONS } from "@/lib/pcr-dropdowns";

interface Props {
  trip: any;
  updateField: (field: string, value: any) => Promise<void>;
}

export function MedicalNecessityCard({ trip, updateField }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
          Reason Ambulance is Medically Necessary
        </label>
        <Select value={trip.medical_necessity_reason || ""} onValueChange={(v) => updateField("medical_necessity_reason", v)}>
          <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Select reason..." /></SelectTrigger>
          <SelectContent>
            {MEDICAL_NECESSITY_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {trip.medical_necessity_reason === "Other" && (
        <Textarea placeholder="Specify medical necessity reason..."
          value={trip.necessity_notes || ""}
          onChange={(e) => updateField("necessity_notes", e.target.value)} rows={3} />
      )}

      {trip.medical_necessity_reason && trip.medical_necessity_reason !== "Other" && (
        <Textarea placeholder="Additional notes (optional)..."
          value={trip.necessity_notes || ""}
          onChange={(e) => updateField("necessity_notes", e.target.value)} rows={2} />
      )}
    </div>
  );
}

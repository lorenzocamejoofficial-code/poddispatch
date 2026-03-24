import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LEVEL_OF_CONSCIOUSNESS, SKIN_CONDITIONS, TRANSPORT_CONDITIONS } from "@/lib/pcr-dropdowns";
import { PCRTooltip } from "@/components/pcr/PCRTooltip";
import { PCR_TOOLTIPS } from "@/lib/pcr-tooltips";

interface ConditionCardProps {
  trip: any;
  updateField: (field: string, value: any) => Promise<void>;
}

export function ConditionOnArrivalCard({ trip, updateField }: ConditionCardProps) {
  const coa = trip.condition_on_arrival || {};

  const updateCOA = (key: string, value: any) => {
    const updated = { ...coa, [key]: value };
    updateField("condition_on_arrival", updated);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center">
          Level of Consciousness <PCRTooltip text={PCR_TOOLTIPS.level_of_consciousness} />
        </label>
        <Select value={trip.level_of_consciousness || ""} onValueChange={(v) => updateField("level_of_consciousness", v)}>
          <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Select..." /></SelectTrigger>
          <SelectContent>
            {LEVEL_OF_CONSCIOUSNESS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center">
          Skin Condition <PCRTooltip text={PCR_TOOLTIPS.skin_condition} />
        </label>
        <Select value={trip.skin_condition || ""} onValueChange={(v) => updateField("skin_condition", v)}>
          <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Select..." /></SelectTrigger>
          <SelectContent>
            {SKIN_CONDITIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">Patient Presentation</label>
        <Textarea placeholder="Patient presentation on arrival..." value={coa.presentation || ""}
          onChange={(e) => updateCOA("presentation", e.target.value)} rows={2} />
      </div>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">Changes from Baseline</label>
        <Textarea placeholder="Any changes from baseline..." value={coa.changes_from_baseline || ""}
          onChange={(e) => updateCOA("changes_from_baseline", e.target.value)} rows={2} />
      </div>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">Transport Condition</label>
        <Select value={trip.transport_condition || ""} onValueChange={(v) => updateField("transport_condition", v)}>
          <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Select..." /></SelectTrigger>
          <SelectContent>
            {TRANSPORT_CONDITIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LEVEL_OF_CONSCIOUSNESS, SKIN_CONDITIONS, TRANSPORT_CONDITIONS } from "@/lib/pcr-dropdowns";

const DESTINATION_CONDITIONS = [
  "Alert/Oriented",
  "Confused",
  "Unresponsive",
  "Unchanged from arrival",
  "Improved from arrival",
  "Deteriorated from arrival",
];
import { PCRTooltip } from "@/components/pcr/PCRTooltip";
import { PCR_TOOLTIPS } from "@/lib/pcr-tooltips";
import { PCRFieldDot } from "@/components/pcr/PCRFieldIndicator";
import { cn } from "@/lib/utils";

interface ConditionCardProps {
  trip: any;
  updateField: (field: string, value: any) => Promise<void>;
  requiredFields?: string[];
}

export function ConditionOnArrivalCard({ trip, updateField, requiredFields = ["level_of_consciousness", "skin_condition", "condition_at_destination"] }: ConditionCardProps) {
  const coa = trip.condition_on_arrival || {};

  const updateCOA = (key: string, value: any) => {
    const updated = { ...coa, [key]: value };
    updateField("condition_on_arrival", updated);
  };

  const isReq = (f: string) => requiredFields.includes(f);
  const isFilled = (f: string) => {
    const v = trip[f];
    return !!v && String(v).trim() !== "";
  };
  const fieldBorder = (f: string) => {
    if (!isReq(f)) return "";
    return isFilled(f) ? "border-emerald-400" : "border-destructive/50";
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center">
          Level of Consciousness <PCRTooltip text={PCR_TOOLTIPS.level_of_consciousness} />
          {isReq("level_of_consciousness") && <PCRFieldDot filled={isFilled("level_of_consciousness")} />}
        </label>
        <Select value={trip.level_of_consciousness || ""} onValueChange={(v) => updateField("level_of_consciousness", v)}>
          <SelectTrigger className={cn("h-12 text-base", fieldBorder("level_of_consciousness"))}><SelectValue placeholder="Select..." /></SelectTrigger>
          <SelectContent>
            {LEVEL_OF_CONSCIOUSNESS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center">
          Skin Condition <PCRTooltip text={PCR_TOOLTIPS.skin_condition} />
          {isReq("skin_condition") && <PCRFieldDot filled={isFilled("skin_condition")} />}
        </label>
        <Select value={trip.skin_condition || ""} onValueChange={(v) => updateField("skin_condition", v)}>
          <SelectTrigger className={cn("h-12 text-base", fieldBorder("skin_condition"))}><SelectValue placeholder="Select..." /></SelectTrigger>
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

      {/* Condition at Destination */}
      <div className="border-t border-border pt-4">
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1 flex items-center">
          Condition at Destination
          {isReq("condition_at_destination") && <PCRFieldDot filled={isFilled("condition_at_destination")} />}
        </label>
        <Select value={trip.condition_at_destination || ""} onValueChange={(v) => updateField("condition_at_destination", v)}>
          <SelectTrigger className={cn("h-12 text-base", fieldBorder("condition_at_destination"))}><SelectValue placeholder="Select..." /></SelectTrigger>
          <SelectContent>
            {DESTINATION_CONDITIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

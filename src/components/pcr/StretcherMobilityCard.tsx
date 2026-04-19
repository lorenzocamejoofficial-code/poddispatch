import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PCRTooltip } from "@/components/pcr/PCRTooltip";
import { PCR_TOOLTIPS } from "@/lib/pcr-tooltips";
import { PCRFieldDot } from "@/components/pcr/PCRFieldIndicator";
import { STRETCHER_OPTIONS, MOBILITY_OPTIONS, PATIENT_POSITIONS } from "@/lib/pcr-dropdowns";
import { cn } from "@/lib/utils";

interface StretcherMobilityCardProps {
  trip: any;
  updateField: (field: string, value: any) => Promise<void>;
  requiredFields?: string[];
}

export function StretcherMobilityCard({ trip, updateField, requiredFields = ["stretcher_placement", "patient_mobility", "patient_position"] }: StretcherMobilityCardProps) {
  const isReq = (f: string) => requiredFields.includes(f);
  const isFilled = (f: string) => !!trip[f] && String(trip[f]).trim() !== "";
  const fieldBorder = (f: string) => {
    if (!isReq(f)) return "";
    return isFilled(f) ? "border-emerald-400" : "border-destructive/50";
  };

  return (
    <div className="space-y-4 p-4">
      <div>
        <Label className="text-sm font-medium text-foreground flex items-center">
          How Was Patient Placed on Stretcher? <PCRTooltip text={PCR_TOOLTIPS.stretcher_placement} />
          {isReq("stretcher_placement") && <PCRFieldDot filled={isFilled("stretcher_placement")} />}
        </Label>
        <Select
          value={trip.stretcher_placement || ""}
          onValueChange={(val) => updateField("stretcher_placement", val)}
        >
          <SelectTrigger className={cn("mt-1.5 h-11 text-base w-full", fieldBorder("stretcher_placement"))}>
            <SelectValue placeholder="Select placement method" />
          </SelectTrigger>
          <SelectContent>
            {STRETCHER_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt} className="text-base py-3">{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-sm font-medium text-foreground flex items-center">
          How Does the Patient Get Around? <PCRTooltip text={PCR_TOOLTIPS.patient_mobility} />
          {isReq("patient_mobility") && <PCRFieldDot filled={isFilled("patient_mobility")} />}
        </Label>
        <Select
          value={trip.patient_mobility || ""}
          onValueChange={(val) => updateField("patient_mobility", val)}
        >
          <SelectTrigger className={cn("mt-1.5 h-11 text-base w-full", fieldBorder("patient_mobility"))}>
            <SelectValue placeholder="Select mobility level" />
          </SelectTrigger>
          <SelectContent>
            {MOBILITY_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt} className="text-base py-3">{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-sm font-medium text-foreground flex items-center">
          Position During Transport <PCRTooltip text="Patient's body position during transport — required for stretcher transport documentation" />
          {isReq("patient_position") && <PCRFieldDot filled={isFilled("patient_position")} />}
        </Label>
        <Select
          value={trip.patient_position || ""}
          onValueChange={(val) => updateField("patient_position", val)}
        >
          <SelectTrigger className={cn("mt-1.5 h-11 text-base w-full", fieldBorder("patient_position"))}>
            <SelectValue placeholder="Select position" />
          </SelectTrigger>
          <SelectContent>
            {PATIENT_POSITIONS.map((opt) => (
              <SelectItem key={opt} value={opt} className="text-base py-3">{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

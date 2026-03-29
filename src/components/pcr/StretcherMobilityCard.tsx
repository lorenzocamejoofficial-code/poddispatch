import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PCRTooltip } from "@/components/pcr/PCRTooltip";
import { PCR_TOOLTIPS } from "@/lib/pcr-tooltips";

const STRETCHER_OPTIONS = [
  "Draw Sheet",
  "Manual Lift",
  "Mechanical Lift",
  "Backboard",
  "First Responders / Fire / Rescue",
];

const MOBILITY_OPTIONS = [
  "Requires Maximum Assistance",
  "Unable to Ambulate",
  "Assisted Ambulation",
  "Independent with Device",
];

const POSITION_OPTIONS = [
  "Supine (flat)",
  "Fowlers (semi-upright 45°)",
  "High Fowlers (upright 90°)",
  "Left lateral",
  "Right lateral",
  "Seated",
];

interface StretcherMobilityCardProps {
  trip: any;
  updateField: (field: string, value: any) => Promise<void>;
}

export function StretcherMobilityCard({ trip, updateField }: StretcherMobilityCardProps) {
  return (
    <div className="space-y-4 p-4">
      <div>
        <Label className="text-sm font-medium text-foreground flex items-center">
          How Was Patient Placed on Stretcher? <PCRTooltip text={PCR_TOOLTIPS.stretcher_placement} />
        </Label>
        <Select
          value={trip.stretcher_placement || ""}
          onValueChange={(val) => updateField("stretcher_placement", val)}
        >
          <SelectTrigger className="mt-1.5 h-11 text-base w-full">
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
        </Label>
        <Select
          value={trip.patient_mobility || ""}
          onValueChange={(val) => updateField("patient_mobility", val)}
        >
          <SelectTrigger className="mt-1.5 h-11 text-base w-full">
            <SelectValue placeholder="Select mobility level" />
          </SelectTrigger>
          <SelectContent>
            {MOBILITY_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt} className="text-base py-3">{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

interface StretcherMobilityCardProps {
  trip: any;
  updateField: (field: string, value: any) => Promise<void>;
}

export function StretcherMobilityCard({ trip, updateField }: StretcherMobilityCardProps) {
  return (
    <div className="space-y-5">
      <div>
        <Label className="text-sm font-medium text-foreground">How Was Patient Placed on Stretcher?</Label>
        <Select
          value={trip.stretcher_placement || ""}
          onValueChange={(val) => updateField("stretcher_placement", val)}
        >
          <SelectTrigger className="mt-1.5 h-12 text-base">
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
        <Label className="text-sm font-medium text-foreground">How Does the Patient Get Around?</Label>
        <Select
          value={trip.patient_mobility || ""}
          onValueChange={(val) => updateField("patient_mobility", val)}
        >
          <SelectTrigger className="mt-1.5 h-12 text-base">
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

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { LOCATION_TYPES } from "@/lib/billing-utils";

interface LocationTypeSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoValue?: string | null;
}

export function LocationTypeSelect({ label, value, onChange, autoValue }: LocationTypeSelectProps) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value || ""} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select type…" />
        </SelectTrigger>
        <SelectContent>
          {LOCATION_TYPES.map(t => (
            <SelectItem key={t} value={t}>{t}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {autoValue && !value && (
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Suggested: {autoValue}
        </p>
      )}
    </div>
  );
}

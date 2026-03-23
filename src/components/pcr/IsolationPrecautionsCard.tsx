import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

const PRECAUTION_TYPES = ["MRSA", "VRE", "C-Diff", "Hepatitis", "COVID-19", "HIV", "Other"];

interface IsolationPrecautionsCardProps {
  trip: any;
  updateField: (field: string, value: any) => Promise<void>;
}

export function IsolationPrecautionsCard({ trip, updateField }: IsolationPrecautionsCardProps) {
  const iso = trip.isolation_precautions || {};
  const [required, setRequired] = useState<boolean>(!!iso.required);
  const [types, setTypes] = useState<string[]>(iso.types || []);
  const [active, setActive] = useState<boolean>(!!iso.active);
  const [notes, setNotes] = useState<string>(iso.notes || "");

  useEffect(() => {
    const current = trip.isolation_precautions || {};
    setRequired(!!current.required);
    setTypes(current.types || []);
    setActive(!!current.active);
    setNotes(current.notes || "");
  }, [trip.isolation_precautions]);

  const save = (updates: Partial<{ required: boolean; types: string[]; active: boolean; notes: string }>) => {
    const next = { required, types, active, notes, ...updates };
    updateField("isolation_precautions", next);
  };

  const toggleType = (type: string) => {
    const next = types.includes(type) ? types.filter((t) => t !== type) : [...types, type];
    setTypes(next);
    save({ types: next });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-foreground">Isolation Required?</Label>
        <Switch
          checked={required}
          onCheckedChange={(val) => {
            setRequired(val);
            save({ required: val });
          }}
        />
      </div>

      {required && (
        <div className="space-y-4 pl-1 border-l-2 border-primary/20 ml-1 pl-4">
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-2 block">Precaution Type</Label>
            <div className="grid grid-cols-2 gap-3">
              {PRECAUTION_TYPES.map((type) => (
                <label key={type} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={types.includes(type)}
                    onCheckedChange={() => toggleType(type)}
                  />
                  {type}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-foreground">Active?</Label>
            <Switch
              checked={active}
              onCheckedChange={(val) => {
                setActive(val);
                save({ active: val });
              }}
            />
          </div>

          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => save({ notes })}
              placeholder="Additional isolation notes..."
              className="min-h-[80px]"
            />
          </div>
        </div>
      )}
    </div>
  );
}

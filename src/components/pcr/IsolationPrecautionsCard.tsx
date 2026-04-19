import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PCRTooltip } from "@/components/pcr/PCRTooltip";
import { PCR_TOOLTIPS } from "@/lib/pcr-tooltips";
import { PRECAUTION_TYPES, PRECAUTION_LEVELS } from "@/lib/pcr-dropdowns";
import { cn } from "@/lib/utils";

type IsoStatus = "na" | "no" | "yes";

interface IsolationPrecautionsCardProps {
  trip: any;
  updateField: (field: string, value: any) => Promise<void>;
}

function deriveStatus(iso: any): IsoStatus {
  if (!iso || typeof iso !== "object") return "na";
  if (iso.status === "na") return "na";
  if (iso.status === "none" || iso.required === false) return "no";
  if (iso.required === true || iso.status === "yes") return "yes";
  return "na";
}

export function IsolationPrecautionsCard({ trip, updateField }: IsolationPrecautionsCardProps) {
  const iso = trip.isolation_precautions || {};
  const [status, setStatus] = useState<IsoStatus>(() => deriveStatus(iso));
  const [types, setTypes] = useState<string[]>(iso.types || []);
  const [level, setLevel] = useState<string>(iso.level || "Standard");
  const [active, setActive] = useState<boolean>(!!iso.active);
  const [notes, setNotes] = useState<string>(iso.notes || "");

  useEffect(() => {
    const current = trip.isolation_precautions || {};
    setStatus(deriveStatus(current));
    setTypes(current.types || []);
    setLevel(current.level || "Standard");
    setActive(!!current.active);
    setNotes(current.notes || "");
  }, [trip.isolation_precautions]);

  const save = (updates: Partial<{ status: string; required: boolean; types: string[]; level: string; active: boolean; notes: string }>) => {
    const next = { required: status === "yes", types, level, active, notes, status, ...updates };
    updateField("isolation_precautions", next);
  };

  const handleStatusChange = (newStatus: IsoStatus) => {
    setStatus(newStatus);
    if (newStatus === "na") {
      save({ status: "na", required: false, types: [], level: "Standard", active: false, notes: "" });
      setTypes([]); setLevel("Standard"); setActive(false); setNotes("");
    } else if (newStatus === "no") {
      save({ status: "none", required: false, types: [], level: "Standard", active: false, notes: "" });
      setTypes([]); setLevel("Standard"); setActive(false); setNotes("");
    } else {
      save({ status: "yes", required: true });
    }
  };

  const toggleType = (type: string) => {
    const next = types.includes(type) ? types.filter((t) => t !== type) : [...types, type];
    setTypes(next);
    save({ types: next });
  };

  const STATUS_OPTIONS: { value: IsoStatus; label: string }[] = [
    { value: "na", label: "N/A" },
    { value: "no", label: "No" },
    { value: "yes", label: "Yes" },
  ];

  return (
    <div className="space-y-4 p-4">
      <div>
        <Label className="text-sm font-medium text-foreground flex items-center mb-2">
          Isolation Required? <PCRTooltip text={PCR_TOOLTIPS.isolation_required} />
        </Label>
        <div className="flex gap-1 rounded-lg border border-border p-1 bg-muted/30 w-fit">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleStatusChange(opt.value)}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                status === opt.value
                  ? opt.value === "na"
                    ? "bg-muted text-foreground shadow-sm"
                    : opt.value === "no"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 shadow-sm"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {status === "yes" && (
        <div className="space-y-4 border-l-2 border-primary/20 ml-1 pl-3">
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-2 block">Precaution Level</Label>
            <Select value={level} onValueChange={(v) => { setLevel(v); save({ level: v }); }}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRECAUTION_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-2 flex items-center">
              Precaution Type <PCRTooltip text={PCR_TOOLTIPS.isolation_type} />
            </Label>
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
            <Label className="text-sm font-medium text-foreground flex items-center">
              Active? <PCRTooltip text={PCR_TOOLTIPS.isolation_active} />
            </Label>
            <Switch
              checked={active}
              onCheckedChange={(val) => { setActive(val); save({ active: val }); }}
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

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { RESPIRATORY_QUALITY, PULSE_QUALITY } from "@/lib/pcr-dropdowns";
import { PCRTooltip } from "@/components/pcr/PCRTooltip";
import { PCR_TOOLTIPS } from "@/lib/pcr-tooltips";
import { cn } from "@/lib/utils";

interface VitalsCardProps {
  trip: any;
  updateField: (field: string, value: any) => Promise<void>;
}

interface VitalSet {
  id: string;
  timestamp: string;
  bp_systolic: string;
  bp_diastolic: string;
  pulse: string;
  pulse_quality: string;
  respiratory_rate: string;
  respiratory_quality: string;
  spo2: string;
  temperature: string;
  blood_glucose: string;
  pain_scale: string;
  gcs_eyes: string;
  gcs_verbal: string;
  gcs_motor: string;
  gcs_total?: string;
}

const CHIP_VALUES = ["N/A", "Refused", "None"] as const;
type ChipValue = typeof CHIP_VALUES[number];

const GCS_EYE = [
  { value: "4", label: "4 — Spontaneous" },
  { value: "3", label: "3 — To Voice" },
  { value: "2", label: "2 — To Pain" },
  { value: "1", label: "1 — None" },
];
const GCS_VERBAL = [
  { value: "5", label: "5 — Oriented" },
  { value: "4", label: "4 — Confused" },
  { value: "3", label: "3 — Inappropriate Words" },
  { value: "2", label: "2 — Incomprehensible Sounds" },
  { value: "1", label: "1 — None" },
];
const GCS_MOTOR = [
  { value: "6", label: "6 — Follows Commands" },
  { value: "5", label: "5 — Localizes Pain" },
  { value: "4", label: "4 — Withdrawal" },
  { value: "3", label: "3 — Flexion (Decorticate)" },
  { value: "2", label: "2 — Extension (Decerebrate)" },
  { value: "1", label: "1 — None" },
];

const REQUIRED_FIELDS = ["bp_systolic", "bp_diastolic", "pulse", "spo2", "respiratory_rate"];
const OPTIONAL_FIELDS = ["temperature", "blood_glucose", "pain_scale"];

function isChipValue(v: string): v is ChipValue {
  return CHIP_VALUES.includes(v as ChipValue);
}

function getGCSTotal(e: string, v: string, m: string): number | null {
  const en = parseInt(e), vn = parseInt(v), mn = parseInt(m);
  if (isNaN(en) || isNaN(vn) || isNaN(mn)) return null;
  return en + vn + mn;
}

function getGCSSeverity(total: number): { label: string; color: string } {
  if (total >= 13) return { label: "Mild", color: "text-emerald-600 dark:text-emerald-400" };
  if (total >= 9) return { label: "Moderate", color: "text-amber-600 dark:text-amber-400" };
  return { label: "Severe", color: "text-destructive" };
}

function getFieldBorder(field: string, value: string): string {
  const isRequired = REQUIRED_FIELDS.includes(field);
  const isOptional = OPTIONAL_FIELDS.includes(field);
  const hasValue = !!value && value.trim() !== "";
  const hasChip = isChipValue(value);

  if (hasValue || hasChip) return "border-emerald-400 focus-visible:ring-emerald-400";
  if (isRequired) return "border-destructive focus-visible:ring-destructive";
  if (isOptional) return "";
  return "";
}

function newVitalSet(): VitalSet {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    bp_systolic: "", bp_diastolic: "", pulse: "", pulse_quality: "",
    respiratory_rate: "", respiratory_quality: "", spo2: "", temperature: "",
    blood_glucose: "", pain_scale: "", gcs_eyes: "", gcs_verbal: "", gcs_motor: "",
  };
}

function VitalChips({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const activeChip = isChipValue(value) ? value : null;
  return (
    <div className="flex gap-1 mt-1">
      {CHIP_VALUES.map(chip => (
        <button
          key={chip}
          type="button"
          onClick={() => onChange(activeChip === chip ? "" : chip)}
          className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors",
            activeChip === chip
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
          )}
        >
          {chip}
        </button>
      ))}
    </div>
  );
}

export function VitalsCard({ trip, updateField }: VitalsCardProps) {
  const initial: VitalSet[] = trip.vitals_json?.length > 0
    ? trip.vitals_json.map((v: any) => ({ ...newVitalSet(), ...v }))
    : [newVitalSet()];

  const [sets, setSets] = useState<VitalSet[]>(initial);

  const save = (updated: VitalSet[]) => {
    setSets(updated);
    updateField("vitals_json", updated);
  };

  const updateSet = (idx: number, field: string, value: string) => {
    const updated = [...sets];
    (updated[idx] as any)[field] = value;
    // Auto-calc GCS total
    if (["gcs_eyes", "gcs_verbal", "gcs_motor"].includes(field)) {
      const total = getGCSTotal(updated[idx].gcs_eyes, updated[idx].gcs_verbal, updated[idx].gcs_motor);
      updated[idx].gcs_total = total !== null ? String(total) : "";
    }
    save(updated);
  };

  const addSet = () => save([...sets, newVitalSet()]);
  const removeSet = (idx: number) => { if (sets.length > 1) save(sets.filter((_, i) => i !== idx)); };

  return (
    <div className="space-y-4">
      {sets.map((vs, idx) => {
        const gcsTotal = getGCSTotal(vs.gcs_eyes, vs.gcs_verbal, vs.gcs_motor);
        const gcsSeverity = gcsTotal !== null ? getGCSSeverity(gcsTotal) : null;

        return (
          <div key={vs.id} className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-primary uppercase tracking-wider">
                {idx === 0 ? "Initial Vitals" : `Repeat Vitals #${idx + 1}`}
              </p>
              {sets.length > 1 && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeSet(idx)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-medium text-muted-foreground flex items-center">Systolic <PCRTooltip text={PCR_TOOLTIPS.systolic} /></label>
                <Input type="number" inputMode="numeric" placeholder="120" value={isChipValue(vs.bp_systolic) ? "" : vs.bp_systolic}
                  disabled={isChipValue(vs.bp_systolic)}
                  onChange={(e) => updateSet(idx, "bp_systolic", e.target.value)} className={cn("h-10", getFieldBorder("bp_systolic", vs.bp_systolic))} />
                <VitalChips value={vs.bp_systolic} onChange={(v) => updateSet(idx, "bp_systolic", v)} />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground flex items-center">Diastolic <PCRTooltip text={PCR_TOOLTIPS.diastolic} /></label>
                <Input type="number" inputMode="numeric" placeholder="80" value={isChipValue(vs.bp_diastolic) ? "" : vs.bp_diastolic}
                  disabled={isChipValue(vs.bp_diastolic)}
                  onChange={(e) => updateSet(idx, "bp_diastolic", e.target.value)} className={cn("h-10", getFieldBorder("bp_diastolic", vs.bp_diastolic))} />
                <VitalChips value={vs.bp_diastolic} onChange={(v) => updateSet(idx, "bp_diastolic", v)} />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground flex items-center">Pulse <PCRTooltip text={PCR_TOOLTIPS.pulse} /></label>
                <Input type="number" inputMode="numeric" placeholder="72" value={isChipValue(vs.pulse) ? "" : vs.pulse}
                  disabled={isChipValue(vs.pulse)}
                  onChange={(e) => updateSet(idx, "pulse", e.target.value)} className={cn("h-10", getFieldBorder("pulse", vs.pulse))} />
                <VitalChips value={vs.pulse} onChange={(v) => updateSet(idx, "pulse", v)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium text-muted-foreground flex items-center">Pulse Quality <PCRTooltip text={PCR_TOOLTIPS.pulse_quality} /></label>
                <Select value={vs.pulse_quality} onValueChange={(v) => updateSet(idx, "pulse_quality", v)}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {PULSE_QUALITY.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground flex items-center">SpO2 % <PCRTooltip text={PCR_TOOLTIPS.spo2} /></label>
                <Input type="number" inputMode="numeric" placeholder="98" value={isChipValue(vs.spo2) ? "" : vs.spo2}
                  disabled={isChipValue(vs.spo2)}
                  onChange={(e) => updateSet(idx, "spo2", e.target.value)} className={cn("h-10", getFieldBorder("spo2", vs.spo2))} />
                <VitalChips value={vs.spo2} onChange={(v) => updateSet(idx, "spo2", v)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium text-muted-foreground flex items-center">Resp Rate <PCRTooltip text={PCR_TOOLTIPS.resp_rate} /></label>
                <Input type="number" inputMode="numeric" placeholder="16" value={isChipValue(vs.respiratory_rate) ? "" : vs.respiratory_rate}
                  disabled={isChipValue(vs.respiratory_rate)}
                  onChange={(e) => updateSet(idx, "respiratory_rate", e.target.value)} className={cn("h-10", getFieldBorder("respiratory_rate", vs.respiratory_rate))} />
                <VitalChips value={vs.respiratory_rate} onChange={(v) => updateSet(idx, "respiratory_rate", v)} />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground flex items-center">Resp Quality <PCRTooltip text={PCR_TOOLTIPS.resp_quality} /></label>
                <Select value={vs.respiratory_quality} onValueChange={(v) => updateSet(idx, "respiratory_quality", v)}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {RESPIRATORY_QUALITY.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-medium text-muted-foreground flex items-center">Temp °F <PCRTooltip text={PCR_TOOLTIPS.temp} /></label>
                <Input type="number" inputMode="decimal" placeholder="98.6" value={isChipValue(vs.temperature) ? "" : vs.temperature}
                  disabled={isChipValue(vs.temperature)}
                  onChange={(e) => updateSet(idx, "temperature", e.target.value)} className={cn("h-10", getFieldBorder("temperature", vs.temperature))} />
                <VitalChips value={vs.temperature} onChange={(v) => updateSet(idx, "temperature", v)} />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground flex items-center">BGL <PCRTooltip text={PCR_TOOLTIPS.bgl} /></label>
                <Input type="number" inputMode="numeric" placeholder="100" value={isChipValue(vs.blood_glucose) ? "" : vs.blood_glucose}
                  disabled={isChipValue(vs.blood_glucose)}
                  onChange={(e) => updateSet(idx, "blood_glucose", e.target.value)} className={cn("h-10", getFieldBorder("blood_glucose", vs.blood_glucose))} />
                <VitalChips value={vs.blood_glucose} onChange={(v) => updateSet(idx, "blood_glucose", v)} />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground flex items-center">Pain (0-10) <PCRTooltip text={PCR_TOOLTIPS.pain} /></label>
                <Input type="number" inputMode="numeric" placeholder="0" min="0" max="10" value={isChipValue(vs.pain_scale) ? "" : vs.pain_scale}
                  disabled={isChipValue(vs.pain_scale)}
                  onChange={(e) => updateSet(idx, "pain_scale", e.target.value)} className={cn("h-10", getFieldBorder("pain_scale", vs.pain_scale))} />
                <VitalChips value={vs.pain_scale} onChange={(v) => updateSet(idx, "pain_scale", v)} />
              </div>
            </div>

            {/* GCS Section */}
            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-medium text-muted-foreground flex items-center">
                  Glasgow Coma Scale <PCRTooltip text={PCR_TOOLTIPS.gcs} />
                </label>
                {gcsTotal !== null && gcsSeverity && (
                  <span className={cn("text-xs font-bold", gcsSeverity.color)}>
                    GCS: {gcsTotal} — {gcsSeverity.label}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground flex items-center">Eye (E) <PCRTooltip text={PCR_TOOLTIPS.gcs_eye} /></label>
                  <Select value={vs.gcs_eyes} onValueChange={(v) => updateSet(idx, "gcs_eyes", v)}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="E" /></SelectTrigger>
                    <SelectContent>
                      {GCS_EYE.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground flex items-center">Verbal (V) <PCRTooltip text={PCR_TOOLTIPS.gcs_verbal} /></label>
                  <Select value={vs.gcs_verbal} onValueChange={(v) => updateSet(idx, "gcs_verbal", v)}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="V" /></SelectTrigger>
                    <SelectContent>
                      {GCS_VERBAL.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground flex items-center">Motor (M) <PCRTooltip text={PCR_TOOLTIPS.gcs_motor} /></label>
                  <Select value={vs.gcs_motor} onValueChange={(v) => updateSet(idx, "gcs_motor", v)}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="M" /></SelectTrigger>
                    <SelectContent>
                      {GCS_MOTOR.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <Button variant="outline" className="w-full" onClick={addSet}>
        <Plus className="h-4 w-4 mr-2" /> Add Vitals Set
      </Button>
    </div>
  );
}

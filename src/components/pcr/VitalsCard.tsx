import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, CheckCircle2, Pencil, Check, X } from "lucide-react";
import { RESPIRATORY_QUALITY, PULSE_QUALITY } from "@/lib/pcr-dropdowns";
import { PCRTooltip } from "@/components/pcr/PCRTooltip";
import { PCR_TOOLTIPS } from "@/lib/pcr-tooltips";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface VitalsCardProps {
  trip: any;
  updateField: (field: string, value: any) => Promise<void>;
}

interface VitalSet {
  id: string;
  timestamp: string;
  saved: boolean;
  timestamp_edited?: boolean;
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

function hasValue(v: string): boolean {
  return !!v && v.trim() !== "";
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
  const filled = hasValue(value) || isChipValue(value);

  if (filled) return "border-emerald-400 focus-visible:ring-emerald-400";
  if (isRequired) return "border-destructive focus-visible:ring-destructive";
  if (isOptional) return "";
  return "";
}

function newVitalSet(): VitalSet {
  return {
    id: crypto.randomUUID(),
    timestamp: "",
    saved: false,
    bp_systolic: "", bp_diastolic: "", pulse: "", pulse_quality: "",
    respiratory_rate: "", respiratory_quality: "", spo2: "", temperature: "",
    blood_glucose: "", pain_scale: "", gcs_eyes: "", gcs_verbal: "", gcs_motor: "",
  };
}

function VitalChips({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const activeChip = isChipValue(value) ? value : null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {CHIP_VALUES.map(chip => (
        <button
          key={chip}
          type="button"
          disabled={disabled}
          onClick={() => onChange(activeChip === chip ? "" : chip)}
          className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors",
            activeChip === chip
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50",
            disabled && "opacity-50 cursor-not-allowed"
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
    ? trip.vitals_json.map((v: any) => ({ ...newVitalSet(), ...v, saved: !!v.timestamp }))
    : [newVitalSet()];

  const [sets, setSets] = useState<VitalSet[]>(initial);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [editingTimestamp, setEditingTimestamp] = useState<string | null>(null);
  const [editTimeValue, setEditTimeValue] = useState("");
  const savedCount = sets.filter(s => s.saved).length;

  const persistToDb = (updated: VitalSet[]) => {
    // Only persist saved sets to the database
    const toSave = updated.filter(s => s.saved);
    updateField("vitals_json", toSave);
  };

  const updateSet = (idx: number, field: string, value: string) => {
    const updated = [...sets];
    (updated[idx] as any)[field] = value;
    if (["gcs_eyes", "gcs_verbal", "gcs_motor"].includes(field)) {
      const total = getGCSTotal(updated[idx].gcs_eyes, updated[idx].gcs_verbal, updated[idx].gcs_motor);
      updated[idx].gcs_total = total !== null ? String(total) : "";
    }
    setSets(updated);
    // Clear errors for this set when user edits
    if (errors[updated[idx].id]) {
      setErrors(prev => { const n = { ...prev }; delete n[updated[idx].id]; return n; });
    }
  };

  const validateAndSave = (idx: number) => {
    const vs = sets[idx];
    const missing: string[] = [];

    const check = (field: string, label: string) => {
      const val = (vs as any)[field];
      if (!hasValue(val) && !isChipValue(val)) missing.push(label);
    };

    check("bp_systolic", "Systolic BP");
    check("bp_diastolic", "Diastolic BP");
    check("pulse", "Heart Rate / Pulse");
    check("respiratory_rate", "Respiratory Rate");
    check("spo2", "SpO2");

    if (missing.length > 0) {
      setErrors(prev => ({ ...prev, [vs.id]: missing }));
      toast({
        title: "Required vitals missing",
        description: `Please fill in: ${missing.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    // All good — stamp timestamp now and mark saved
    const updated = [...sets];
    updated[idx] = { ...updated[idx], timestamp: new Date().toISOString(), saved: true };
    setSets(updated);
    persistToDb(updated);
    setErrors(prev => { const n = { ...prev }; delete n[vs.id]; return n; });
    toast({ title: `Vitals set ${idx + 1} saved`, description: `Recorded at ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}` });
  };

  const addSet = () => {
    setSets(prev => [...prev, newVitalSet()]);
  };

  const removeSet = (idx: number) => {
    if (sets.length <= 1) return;
    const updated = sets.filter((_, i) => i !== idx);
    setSets(updated);
    persistToDb(updated);
  };

  const startEditTimestamp = (vs: VitalSet) => {
    const d = new Date(vs.timestamp);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    setEditTimeValue(`${hh}:${mm}`);
    setEditingTimestamp(vs.id);
  };

  const saveEditedTimestamp = (idx: number) => {
    const vs = sets[idx];
    const [hh, mm] = editTimeValue.split(":").map(Number);
    if (isNaN(hh) || isNaN(mm)) return;

    const original = new Date(vs.timestamp);
    const corrected = new Date(original);
    corrected.setHours(hh, mm, 0, 0);

    // Check transport window warning
    const leftScene = trip.left_scene_time;
    const atDest = trip.arrived_dropoff_at;
    if (leftScene && atDest) {
      const ct = corrected.getTime();
      const ls = new Date(leftScene).getTime();
      const ad = new Date(atDest).getTime();
      if (ct < ls || ct > ad) {
        toast({
          title: "Transport window warning",
          description: "This vitals time falls outside the Left Scene → At Destination window. The corrected time will still be saved.",
          variant: "default",
        });
      }
    }

    const updated = [...sets];
    updated[idx] = { ...updated[idx], timestamp: corrected.toISOString(), timestamp_edited: true };
    setSets(updated);
    persistToDb(updated);
    setEditingTimestamp(null);
    toast({ title: "Timestamp corrected", description: `Updated to ${corrected.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}` });
  };

  return (
    <div className="space-y-4">
      {sets.map((vs, idx) => {
        const gcsTotal = getGCSTotal(vs.gcs_eyes, vs.gcs_verbal, vs.gcs_motor);
        const gcsSeverity = gcsTotal !== null ? getGCSSeverity(gcsTotal) : null;
        const isSaved = vs.saved;
        const setErrors_ = errors[vs.id] || [];

        return (
          <div key={vs.id} className={cn("rounded-lg border p-3 sm:p-4 space-y-4", isSaved && "border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-900/10")}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 flex-wrap min-w-0">
                {isSaved && <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                <p className="text-xs font-bold text-primary uppercase tracking-wider">
                  {idx === 0 ? "Initial Vitals" : `Repeat Vitals #${idx + 1}`}
                </p>
                {isSaved && vs.timestamp && editingTimestamp !== vs.id && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="hidden sm:inline">·</span> {new Date(vs.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
                    <button
                      type="button"
                      onClick={() => startEditTimestamp(vs)}
                      className="inline-flex items-center text-muted-foreground/60 hover:text-primary transition-colors"
                      title="Edit timestamp"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    {vs.timestamp_edited && (
                      <span className="text-[10px] text-muted-foreground/50 italic">Edited</span>
                    )}
                  </span>
                )}
                {isSaved && editingTimestamp === vs.id && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground hidden sm:inline">·</span>
                    <Input
                      type="time"
                      value={editTimeValue}
                      onChange={(e) => setEditTimeValue(e.target.value)}
                      className="h-7 w-28 text-xs px-2"
                    />
                    <button type="button" onClick={() => saveEditedTimestamp(idx)} className="text-emerald-600 hover:text-emerald-700" title="Save">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => setEditingTimestamp(null)} className="text-muted-foreground hover:text-destructive" title="Cancel">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
              {sets.length > 1 && !isSaved && (
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeSet(idx)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </div>

            {/* Validation errors */}
            {setErrors_.length > 0 && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2">
                <p className="text-xs font-medium text-destructive">Missing required fields: {setErrors_.join(", ")}</p>
              </div>
            )}

            {/* Vitals timing warning */}
            {(() => {
              const leftScene = trip.left_scene_time;
              const atDest = trip.arrived_dropoff_at;
              if (!leftScene || !atDest || !vs.timestamp) return null;
              const vt = new Date(vs.timestamp).getTime();
              const ls = new Date(leftScene).getTime();
              const ad = new Date(atDest).getTime();
              if (vt < ls || vt > ad) {
                return (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    ⚠ Vitals timestamp should fall between Left Scene and At Destination times for billing compliance.
                  </p>
                );
              }
              return null;
            })()}

            {/* BP / Pulse */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-3">
              <div className="min-w-0">
                <label className="text-sm font-medium text-muted-foreground flex items-center">Systolic <PCRTooltip text={PCR_TOOLTIPS.systolic} /></label>
                <Input type="number" inputMode="numeric" placeholder="120" value={isChipValue(vs.bp_systolic) ? "" : vs.bp_systolic}
                  disabled={isChipValue(vs.bp_systolic) || isSaved}
                  onChange={(e) => updateSet(idx, "bp_systolic", e.target.value)} className={cn("h-11", getFieldBorder("bp_systolic", vs.bp_systolic))} />
                <VitalChips value={vs.bp_systolic} onChange={(v) => updateSet(idx, "bp_systolic", v)} disabled={isSaved} />
              </div>
              <div className="min-w-0">
                <label className="text-sm font-medium text-muted-foreground flex items-center">Diastolic <PCRTooltip text={PCR_TOOLTIPS.diastolic} /></label>
                <Input type="number" inputMode="numeric" placeholder="80" value={isChipValue(vs.bp_diastolic) ? "" : vs.bp_diastolic}
                  disabled={isChipValue(vs.bp_diastolic) || isSaved}
                  onChange={(e) => updateSet(idx, "bp_diastolic", e.target.value)} className={cn("h-11", getFieldBorder("bp_diastolic", vs.bp_diastolic))} />
                <VitalChips value={vs.bp_diastolic} onChange={(v) => updateSet(idx, "bp_diastolic", v)} disabled={isSaved} />
              </div>
              <div className="min-w-0">
                <label className="text-sm font-medium text-muted-foreground flex items-center">Pulse <PCRTooltip text={PCR_TOOLTIPS.pulse} /></label>
                <Input type="number" inputMode="numeric" placeholder="72" value={isChipValue(vs.pulse) ? "" : vs.pulse}
                  disabled={isChipValue(vs.pulse) || isSaved}
                  onChange={(e) => updateSet(idx, "pulse", e.target.value)} className={cn("h-11", getFieldBorder("pulse", vs.pulse))} />
                <VitalChips value={vs.pulse} onChange={(v) => updateSet(idx, "pulse", v)} disabled={isSaved} />
              </div>
            </div>

            {/* Pulse Quality / SpO2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-3">
              <div className="min-w-0">
                <label className="text-sm font-medium text-muted-foreground flex items-center">Pulse Quality <PCRTooltip text={PCR_TOOLTIPS.pulse_quality} /></label>
                <Select value={vs.pulse_quality} onValueChange={(v) => updateSet(idx, "pulse_quality", v)} disabled={isSaved}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {PULSE_QUALITY.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0">
                <label className="text-sm font-medium text-muted-foreground flex items-center">SpO2 % <PCRTooltip text={PCR_TOOLTIPS.spo2} /></label>
                <Input type="number" inputMode="numeric" placeholder="98" value={isChipValue(vs.spo2) ? "" : vs.spo2}
                  disabled={isChipValue(vs.spo2) || isSaved}
                  onChange={(e) => updateSet(idx, "spo2", e.target.value)} className={cn("h-11", getFieldBorder("spo2", vs.spo2))} />
                <VitalChips value={vs.spo2} onChange={(v) => updateSet(idx, "spo2", v)} disabled={isSaved} />
              </div>
            </div>

            {/* Resp Rate / Resp Quality */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-3">
              <div className="min-w-0">
                <label className="text-sm font-medium text-muted-foreground flex items-center">Resp Rate <PCRTooltip text={PCR_TOOLTIPS.resp_rate} /></label>
                <Input type="number" inputMode="numeric" placeholder="16" value={isChipValue(vs.respiratory_rate) ? "" : vs.respiratory_rate}
                  disabled={isChipValue(vs.respiratory_rate) || isSaved}
                  onChange={(e) => updateSet(idx, "respiratory_rate", e.target.value)} className={cn("h-11", getFieldBorder("respiratory_rate", vs.respiratory_rate))} />
                <VitalChips value={vs.respiratory_rate} onChange={(v) => updateSet(idx, "respiratory_rate", v)} disabled={isSaved} />
              </div>
              <div className="min-w-0">
                <label className="text-sm font-medium text-muted-foreground flex items-center">Resp Quality <PCRTooltip text={PCR_TOOLTIPS.resp_quality} /></label>
                <Select value={vs.respiratory_quality} onValueChange={(v) => updateSet(idx, "respiratory_quality", v)} disabled={isSaved}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {RESPIRATORY_QUALITY.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Temp / BGL / Pain */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-3">
              <div className="min-w-0">
                <label className="text-sm font-medium text-muted-foreground flex items-center">Temp °F <PCRTooltip text={PCR_TOOLTIPS.temp} /></label>
                <Input type="number" inputMode="decimal" placeholder="98.6" value={isChipValue(vs.temperature) ? "" : vs.temperature}
                  disabled={isChipValue(vs.temperature) || isSaved}
                  onChange={(e) => updateSet(idx, "temperature", e.target.value)} className={cn("h-11", getFieldBorder("temperature", vs.temperature))} />
                <VitalChips value={vs.temperature} onChange={(v) => updateSet(idx, "temperature", v)} disabled={isSaved} />
              </div>
              <div className="min-w-0">
                <label className="text-sm font-medium text-muted-foreground flex items-center">BGL <PCRTooltip text={PCR_TOOLTIPS.bgl} /></label>
                <Input type="number" inputMode="numeric" placeholder="100" value={isChipValue(vs.blood_glucose) ? "" : vs.blood_glucose}
                  disabled={isChipValue(vs.blood_glucose) || isSaved}
                  onChange={(e) => updateSet(idx, "blood_glucose", e.target.value)} className={cn("h-11", getFieldBorder("blood_glucose", vs.blood_glucose))} />
                <VitalChips value={vs.blood_glucose} onChange={(v) => updateSet(idx, "blood_glucose", v)} disabled={isSaved} />
              </div>
              <div className="min-w-0">
                <label className="text-sm font-medium text-muted-foreground flex items-center">Pain (0-10) <PCRTooltip text={PCR_TOOLTIPS.pain} /></label>
                <Input type="number" inputMode="numeric" placeholder="0" min="0" max="10" value={isChipValue(vs.pain_scale) ? "" : vs.pain_scale}
                  disabled={isChipValue(vs.pain_scale) || isSaved}
                  onChange={(e) => updateSet(idx, "pain_scale", e.target.value)} className={cn("h-11", getFieldBorder("pain_scale", vs.pain_scale))} />
                <VitalChips value={vs.pain_scale} onChange={(v) => updateSet(idx, "pain_scale", v)} disabled={isSaved} />
              </div>
            </div>

            {/* GCS Section */}
            {(() => {
              const gcsFilled = [vs.gcs_eyes, vs.gcs_verbal, vs.gcs_motor].filter(v => !!v && !isNaN(parseInt(v)));
              const gcsContainerBorder = gcsFilled.length === 0
                ? "border-destructive"
                : gcsFilled.length === 3
                  ? "border-emerald-400"
                  : "border-amber-400";
              const getGcsFieldBorder = (val: string) =>
                val && !isNaN(parseInt(val)) ? "border-emerald-400" : "border-destructive";

              return (
                <div className={cn("border rounded-lg p-3 pt-4", gcsContainerBorder)}>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-muted-foreground flex items-center">
                      Glasgow Coma Scale <PCRTooltip text={PCR_TOOLTIPS.gcs} />
                    </label>
                    {gcsTotal !== null && gcsSeverity && (
                      <span className={cn("text-xs font-bold", gcsSeverity.color)}>
                        GCS: {gcsTotal} — {gcsSeverity.label}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="min-w-0">
                      <label className="text-sm font-medium text-muted-foreground flex items-center">Eye (E) <PCRTooltip text={PCR_TOOLTIPS.gcs_eye} /></label>
                      <Select value={vs.gcs_eyes} onValueChange={(v) => updateSet(idx, "gcs_eyes", v)} disabled={isSaved}>
                        <SelectTrigger className={cn("h-11", getGcsFieldBorder(vs.gcs_eyes))}><SelectValue placeholder="E" /></SelectTrigger>
                        <SelectContent>
                          {GCS_EYE.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-0">
                      <label className="text-sm font-medium text-muted-foreground flex items-center">Verbal (V) <PCRTooltip text={PCR_TOOLTIPS.gcs_verbal} /></label>
                      <Select value={vs.gcs_verbal} onValueChange={(v) => updateSet(idx, "gcs_verbal", v)} disabled={isSaved}>
                        <SelectTrigger className={cn("h-11", getGcsFieldBorder(vs.gcs_verbal))}><SelectValue placeholder="V" /></SelectTrigger>
                        <SelectContent>
                          {GCS_VERBAL.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-0">
                      <label className="text-sm font-medium text-muted-foreground flex items-center">Motor (M) <PCRTooltip text={PCR_TOOLTIPS.gcs_motor} /></label>
                      <Select value={vs.gcs_motor} onValueChange={(v) => updateSet(idx, "gcs_motor", v)} disabled={isSaved}>
                        <SelectTrigger className={cn("h-11", getGcsFieldBorder(vs.gcs_motor))}><SelectValue placeholder="M" /></SelectTrigger>
                        <SelectContent>
                          {GCS_MOTOR.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Save button for unsaved sets */}
            {!isSaved && (
              <Button className="w-full h-12 text-base gap-2" onClick={() => validateAndSave(idx)}>
                <Save className="h-4 w-4" />
                Save Vitals
              </Button>
            )}
          </div>
        );
      })}

      {/* Only show Add Another after at least one is saved and no unsaved drafts exist */}
      {savedCount > 0 && sets.every(s => s.saved) && (
        <Button variant="outline" className="w-full" onClick={addSet}>
          <Plus className="h-4 w-4 mr-2" /> Add Another Vitals Set
        </Button>
      )}
    </div>
  );
}

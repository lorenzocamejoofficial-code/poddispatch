import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { RESPIRATORY_QUALITY, PULSE_QUALITY } from "@/lib/pcr-dropdowns";

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
    save(updated);
  };

  const addSet = () => save([...sets, newVitalSet()]);
  const removeSet = (idx: number) => { if (sets.length > 1) save(sets.filter((_, i) => i !== idx)); };

  return (
    <div className="space-y-4">
      {sets.map((vs, idx) => (
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
              <label className="text-[10px] font-medium text-muted-foreground block">Systolic</label>
              <Input type="number" inputMode="numeric" placeholder="120" value={vs.bp_systolic}
                onChange={(e) => updateSet(idx, "bp_systolic", e.target.value)} className="h-10" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block">Diastolic</label>
              <Input type="number" inputMode="numeric" placeholder="80" value={vs.bp_diastolic}
                onChange={(e) => updateSet(idx, "bp_diastolic", e.target.value)} className="h-10" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block">Pulse</label>
              <Input type="number" inputMode="numeric" placeholder="72" value={vs.pulse}
                onChange={(e) => updateSet(idx, "pulse", e.target.value)} className="h-10" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block">Pulse Quality</label>
              <Select value={vs.pulse_quality} onValueChange={(v) => updateSet(idx, "pulse_quality", v)}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {PULSE_QUALITY.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block">SpO2 %</label>
              <Input type="number" inputMode="numeric" placeholder="98" value={vs.spo2}
                onChange={(e) => updateSet(idx, "spo2", e.target.value)} className="h-10" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block">Resp Rate</label>
              <Input type="number" inputMode="numeric" placeholder="16" value={vs.respiratory_rate}
                onChange={(e) => updateSet(idx, "respiratory_rate", e.target.value)} className="h-10" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block">Resp Quality</label>
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
              <label className="text-[10px] font-medium text-muted-foreground block">Temp °F</label>
              <Input type="number" inputMode="decimal" placeholder="98.6" value={vs.temperature}
                onChange={(e) => updateSet(idx, "temperature", e.target.value)} className="h-10" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block">BGL</label>
              <Input type="number" inputMode="numeric" placeholder="100" value={vs.blood_glucose}
                onChange={(e) => updateSet(idx, "blood_glucose", e.target.value)} className="h-10" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block">Pain (0-10)</label>
              <Input type="number" inputMode="numeric" placeholder="0" min="0" max="10" value={vs.pain_scale}
                onChange={(e) => updateSet(idx, "pain_scale", e.target.value)} className="h-10" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-medium text-muted-foreground block">GCS (E/V/M)</label>
            <div className="grid grid-cols-3 gap-2">
              <Input type="number" inputMode="numeric" placeholder="E" min="1" max="4" value={vs.gcs_eyes}
                onChange={(e) => updateSet(idx, "gcs_eyes", e.target.value)} className="h-10" />
              <Input type="number" inputMode="numeric" placeholder="V" min="1" max="5" value={vs.gcs_verbal}
                onChange={(e) => updateSet(idx, "gcs_verbal", e.target.value)} className="h-10" />
              <Input type="number" inputMode="numeric" placeholder="M" min="1" max="6" value={vs.gcs_motor}
                onChange={(e) => updateSet(idx, "gcs_motor", e.target.value)} className="h-10" />
            </div>
          </div>
        </div>
      ))}

      <Button variant="outline" className="w-full" onClick={addSet}>
        <Plus className="h-4 w-4 mr-2" /> Add Vitals Set
      </Button>
    </div>
  );
}

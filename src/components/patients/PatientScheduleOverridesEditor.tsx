import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Info } from "lucide-react";

export interface ScheduleOverride {
  weekday: number;
  chair_time: string;          // "" = inherit default
  duration_hours: string;      // "" = inherit
  duration_minutes: string;    // "" = inherit
}

const DAY_LABELS: Record<number, string> = {
  0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat",
};

interface Props {
  patientId: string | null;       // null when adding a new patient — overrides save after first save
  activeWeekdays: number[];       // weekdays currently selected on the patient form
  defaultChairTime: string;       // for placeholder hint
  defaultDurationHours: string;
  defaultDurationMinutes: string;
  value: ScheduleOverride[];
  onChange: (next: ScheduleOverride[]) => void;
}

/**
 * Per-weekday optional overrides for chair time + duration.
 * Blank fields = inherit the patient's default chair_time / duration.
 */
export function PatientScheduleOverridesEditor({
  patientId,
  activeWeekdays,
  defaultChairTime,
  defaultDurationHours,
  defaultDurationMinutes,
  value,
  onChange,
}: Props) {
  const [loaded, setLoaded] = useState(false);

  // Load existing overrides for this patient on mount / id change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!patientId) { setLoaded(true); return; }
      const { data } = await supabase
        .from("patient_schedule_overrides" as any)
        .select("weekday, chair_time, duration_hours, duration_minutes")
        .eq("patient_id", patientId);
      if (cancelled) return;
      const mapped: ScheduleOverride[] = (data ?? []).map((r: any) => ({
        weekday: r.weekday,
        chair_time: r.chair_time ?? "",
        duration_hours: r.duration_hours != null ? String(r.duration_hours) : "",
        duration_minutes: r.duration_minutes != null ? String(r.duration_minutes) : "",
      }));
      onChange(mapped);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const upsertRow = (weekday: number, patch: Partial<ScheduleOverride>) => {
    const idx = value.findIndex((v) => v.weekday === weekday);
    if (idx === -1) {
      onChange([...value, { weekday, chair_time: "", duration_hours: "", duration_minutes: "", ...patch }]);
    } else {
      const next = [...value];
      next[idx] = { ...next[idx], ...patch };
      onChange(next);
    }
  };

  const getRow = (weekday: number): ScheduleOverride =>
    value.find((v) => v.weekday === weekday) ??
    { weekday, chair_time: "", duration_hours: "", duration_minutes: "" };

  if (activeWeekdays.length === 0) return null;

  return (
    <div className="rounded-md border bg-background p-3 space-y-2">
      <div className="flex items-start gap-2">
        <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-snug">
          Optional per-day overrides. Leave blank to use the patient's default chair time
          {defaultChairTime ? ` (${defaultChairTime})` : ""} and duration.
        </p>
      </div>
      <div className="space-y-2">
        {[...activeWeekdays].sort((a, b) => a - b).map((wd) => {
          const row = getRow(wd);
          return (
            <div key={wd} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-2 text-xs font-medium text-foreground pb-2">
                {DAY_LABELS[wd]}
              </div>
              <div className="col-span-4">
                <Label className="text-[10px] text-muted-foreground">Chair time</Label>
                <Input
                  type="time"
                  value={row.chair_time}
                  placeholder={defaultChairTime}
                  onChange={(e) => upsertRow(wd, { chair_time: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="col-span-3">
                <Label className="text-[10px] text-muted-foreground">Hours</Label>
                <Input
                  type="number"
                  min={0}
                  max={8}
                  value={row.duration_hours}
                  placeholder={defaultDurationHours || "0"}
                  onChange={(e) => upsertRow(wd, { duration_hours: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="col-span-3">
                <Label className="text-[10px] text-muted-foreground">Minutes</Label>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={row.duration_minutes}
                  placeholder={defaultDurationMinutes || "0"}
                  onChange={(e) => upsertRow(wd, { duration_minutes: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Persist overrides for a patient. Only rows with at least one non-blank field
 * for an active weekday are kept. Other days are removed.
 */
export async function saveScheduleOverrides(opts: {
  patientId: string;
  companyId: string;
  activeWeekdays: number[];
  overrides: ScheduleOverride[];
}) {
  const { patientId, companyId, activeWeekdays, overrides } = opts;

  // Delete all existing rows for this patient, then re-insert active ones.
  // Simple and correct given the small row count (max 7 per patient).
  await supabase
    .from("patient_schedule_overrides" as any)
    .delete()
    .eq("patient_id", patientId);

  const rows = overrides
    .filter((o) => activeWeekdays.includes(o.weekday))
    .map((o) => {
      const ct = o.chair_time?.trim() || null;
      const dh = o.duration_hours?.trim() === "" ? null : Number(o.duration_hours);
      const dm = o.duration_minutes?.trim() === "" ? null : Number(o.duration_minutes);
      // Skip empty rows — nothing to override
      if (!ct && dh == null && dm == null) return null;
      return {
        patient_id: patientId,
        company_id: companyId,
        weekday: o.weekday,
        chair_time: ct,
        duration_hours: dh,
        duration_minutes: dm,
      };
    })
    .filter(Boolean) as any[];

  if (rows.length === 0) return;
  await supabase.from("patient_schedule_overrides" as any).insert(rows);
}

import type { LegWindow } from "./schedule-feasibility";
export function clockMinutes(time: string | null | undefined): number | null {
  if (!time || !/^\d{2}:\d{2}(:\d{2})?$/.test(time)) return null;
  const [h, m] = time.split(":").map(Number);
  return h < 24 && m < 60 ? h * 60 + m : null;
}
/** Display-only. Overnight shifts are anchored to their start day; equality is not overrun. */
export function truckRunsPastShift(windows: LegWindow[], shiftStart?: string | null, shiftEnd?: string | null): boolean {
  const end = clockMinutes(shiftEnd), start = clockMinutes(shiftStart);
  if (end == null) return false;
  const overnight = start != null && end <= start;
  const limit = overnight ? end + 1440 : end;
  return windows.some(w => {
    if (w.end == null || w.start == null) return false;
    const finish = overnight && w.start < (start ?? 0) ? w.end + 1440 : w.end;
    return finish > limit;
  });
}

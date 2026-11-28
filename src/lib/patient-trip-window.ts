import { clockMinutes } from "./truck-shift";
/** Half-open transport window: adjacent trips are allowed; facility dwell is NOT occupied transport. */
export function patientTripWindow(pickup: string | null, end: string | null, duration = 30, load = 10, unload = 10) {
  const start = clockMinutes(pickup);
  if (start == null) return null;
  const explicitEnd = clockMinutes(end);
  const finish = explicitEnd == null ? start + load + Math.max(0, duration) + unload : explicitEnd <= start ? explicitEnd + 1440 : explicitEnd;
  return { start, end: finish };
}
export function windowsOverlap(a: { start: number; end: number }, b: { start: number; end: number }) {
  return a.start < b.end && b.start < a.end;
}
export function formatWindowMinute(m: number) {
  const clock = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(clock / 60)).padStart(2, "0")}:${String(clock % 60).padStart(2, "0")}`;
}

/** PCR timestamps are UTC instants; scheduling clocks use the Georgia service date. */
export function recordedWindowMinute(timestamp: string | null | undefined, runDate: string): number | null {
  if (!timestamp) return null;
  const instant = new Date(timestamp);
  if (!Number.isFinite(instant.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(instant);
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  const days = Math.round((Date.parse(date) - Date.parse(runDate)) / 86400000);
  return days * 1440 + Number(part("hour")) * 60 + Number(part("minute"));
}

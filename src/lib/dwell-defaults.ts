export const DEFAULT_DWELL_MINUTES: Record<string, number | null> = {
  dialysis: 240, wound_care: 60, outpatient: 60, outpatient_specialty: 90,
  ift: null, ift_discharge: null, discharge: null, psych_transport: null,
};
export function dwellMinutesFor(type: string | null | undefined, settings?: unknown): number | null {
  const key = type === "woundcare" ? "wound_care" : type;
  if (!key) return null;
  const map = settings && typeof settings === "object" && !Array.isArray(settings) ? settings as Record<string, unknown> : DEFAULT_DWELL_MINUTES;
  const value = Object.prototype.hasOwnProperty.call(map, key) ? map[key] : DEFAULT_DWELL_MINUTES[key];
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

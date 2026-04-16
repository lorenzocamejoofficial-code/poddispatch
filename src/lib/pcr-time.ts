function parseRunDate(runDate: string | null | undefined): Date | null {
  if (!runDate) return null;

  const isoMatch = runDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!isoMatch) return null;

  const year = Number(isoMatch[1]);
  const month = Number(isoMatch[2]);
  const day = Number(isoMatch[3]);
  const parsed = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

export function buildTimestampForRunDate(
  runDate: string | null | undefined,
  sourceDate: Date = new Date(),
): string {
  const anchored = parseRunDate(runDate) ?? new Date(sourceDate);
  anchored.setHours(
    sourceDate.getHours(),
    sourceDate.getMinutes(),
    sourceDate.getSeconds(),
    sourceDate.getMilliseconds(),
  );

  return anchored.toISOString();
}

/**
 * Convert a UTC ISO timestamp into the `YYYY-MM-DDTHH:mm` string
 * that an `<input type="datetime-local">` expects, using the user's
 * LOCAL timezone (not UTC). Returns "" when the input is empty.
 *
 * Why: `new Date(iso).toISOString().slice(0,16)` produces a UTC string
 * which the input then renders as if it were local time, shifting the
 * displayed (and later re-saved) value by the UTC offset.
 */
export function isoToLocalDatetimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/**
 * Convert a `<input type="datetime-local">` string (interpreted in the
 * user's LOCAL timezone) back into a UTC ISO string for storage.
 */
export function localDatetimeInputToIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value); // datetime-local strings are parsed as local time
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function buildTimestampFromRunDateAndTime(
  runDate: string | null | undefined,
  timeValue: string,
): string | null {
  const [hours, minutes] = timeValue.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  const anchored = parseRunDate(runDate) ?? new Date();
  anchored.setHours(hours, minutes, 0, 0);

  return anchored.toISOString();
}
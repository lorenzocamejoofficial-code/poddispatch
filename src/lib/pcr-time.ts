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
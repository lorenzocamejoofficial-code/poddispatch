/**
 * Parses a time string (HH:MM or HH:MM:SS) into total minutes since midnight.
 * Returns null if invalid.
 */
function parseTimeToMinutes(time: string | null): number | null {
  if (!time) return null;
  const parts = time.split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function minutesToTimeString(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(totalMinutes, 24 * 60 - 1));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Given a chair/appointment start time and a treatment duration,
 * returns the earliest valid B-leg pickup time as HH:MM.
 * Returns null if chairTime is null or invalid.
 */
export function getEarliestBLegPickup(
  chairTime: string | null,
  durationHours: number,
  durationMinutes: number
): string | null {
  const startMinutes = parseTimeToMinutes(chairTime);
  if (startMinutes === null) return null;
  const totalDuration = (durationHours || 0) * 60 + (durationMinutes || 0);
  if (totalDuration <= 0) return null;
  return minutesToTimeString(startMinutes + totalDuration);
}

/**
 * Returns true if the B-leg pickup time is before the earliest valid time
 * based on chair time + duration. Returns false if any value is null.
 */
export function isBLegTooEarly(
  bLegPickupTime: string | null,
  chairTime: string | null,
  durationHours: number,
  durationMinutes: number
): boolean {
  if (!bLegPickupTime || !chairTime) return false;
  const earliest = getEarliestBLegPickup(chairTime, durationHours, durationMinutes);
  if (!earliest) return false;
  const bMinutes = parseTimeToMinutes(bLegPickupTime);
  const eMinutes = parseTimeToMinutes(earliest);
  if (bMinutes === null || eMinutes === null) return false;
  return bMinutes < eMinutes;
}

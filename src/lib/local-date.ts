/**
 * Local timezone date utilities.
 * ALWAYS use these instead of new Date().toISOString().split("T")[0]
 * which returns UTC date (can be wrong near midnight).
 */

/** Returns today's date in YYYY-MM-DD using the user's local timezone */
export function getLocalToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Format a schedule_days enum or recurrence_days array into readable day names */
export function formatScheduleDays(
  scheduleDays: string | null | undefined,
  recurrenceDays?: number[] | null
): string {
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Custom recurrence_days (array of day-of-week numbers 0-6)
  if (recurrenceDays && recurrenceDays.length > 0) {
    return recurrenceDays
      .sort((a, b) => a - b)
      .map((d) => DAY_NAMES[d] ?? `Day${d}`)
      .join(", ");
  }

  if (!scheduleDays) return "No schedule";

  // Pre-set patterns
  if (scheduleDays === "MWF") return "Mon, Wed, Fri";
  if (scheduleDays === "TTS") return "Tue, Thu, Sat";

  // If it's already readable, return as-is
  return scheduleDays;
}

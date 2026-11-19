import { addDays, addMonths, endOfYear, format, eachDayOfInterval } from "date-fns";

/** A selected source date begins a seven-day pattern; never snap it to Sunday. */
export function crewExtensionRange(start: string, horizon: "1m" | "3m" | "rest_of_year") {
  const sourceStart = new Date(`${start}T12:00:00`);
  const sourceEnd = addDays(sourceStart, 6);
  const destinationStart = addDays(sourceEnd, 1);
  const destinationEnd = horizon === "rest_of_year"
    ? endOfYear(sourceEnd)
    : addDays(addMonths(destinationStart, horizon === "1m" ? 1 : 3), -1);
  const dates = (a: Date, b: Date) => a <= b
    ? eachDayOfInterval({ start: a, end: b }).map(d => format(d, "yyyy-MM-dd")) : [];
  return {
    sourceDates: dates(sourceStart, sourceEnd),
    destinationDates: dates(destinationStart, destinationEnd),
  };
}
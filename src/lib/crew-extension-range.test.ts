import { describe, expect, it } from "vitest";
import { crewExtensionRange } from "./crew-extension-range";

describe("crew extension dates", () => {
  it("starts immediately after a non-Sunday source range without snapping", () => {
    const range = crewExtensionRange("2026-11-19", "1m");
    expect(range.sourceDates).toEqual(["2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24", "2026-11-25"]);
    expect(range.destinationDates[0]).toBe("2026-11-26");
    expect(range.destinationDates.at(-1)).toBe("2026-12-25");
  });
  it("starts the day after a Sunday-Saturday source", () => {
    expect(crewExtensionRange("2026-11-15", "3m").destinationDates[0]).toBe("2026-11-22");
  });
  it("stops at December 31 rather than copying into the next year", () => {
    const range = crewExtensionRange("2026-12-20", "rest_of_year");
    expect(range.destinationDates).toEqual(["2026-12-27", "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31"]);
  });
  it("does not invent dates when the source ends on December 31", () => {
    expect(crewExtensionRange("2026-12-25", "rest_of_year").destinationDates).toEqual([]);
  });
});
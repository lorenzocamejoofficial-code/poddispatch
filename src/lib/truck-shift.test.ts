import { describe, it, expect } from "vitest";
import { truckRunsPastShift } from "./truck-shift";
const window = (start: number, end: number) => ({ legId: "synthetic", label: "Synthetic", start, end, basis: "scheduled" as const });
describe("truck shift advisory", () => {
  it("keeps null shift end silent", () => expect(truckRunsPastShift([window(1200, 1300)], null, null)).toBe(false));
  it("flags only windows ending strictly after shift end", () => {
    expect(truckRunsPastShift([window(1000, 1020)], "08:00", "17:00")).toBe(false);
    expect(truckRunsPastShift([window(1000, 1021)], "08:00", "17:00")).toBe(true);
  });
  it("handles an overnight shift and post-midnight runs", () => {
    expect(truckRunsPastShift([window(1380, 1500)], "22:00", "06:00")).toBe(false);
    expect(truckRunsPastShift([window(300, 361)], "22:00", "06:00")).toBe(true);
  });
});

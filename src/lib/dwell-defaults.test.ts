import { describe, it, expect } from "vitest";
import { DEFAULT_DWELL_MINUTES, dwellMinutesFor } from "./dwell-defaults";
import { suggestReturnPickup, summarize, suggestTripDuration } from "./patient-time-prediction";
const input = { chairTime: "08:00", aLegDropTime: "08:00", turnaround: summarize([]), plannedChairMinutes: 0 };
describe("facility dwell fallback", () => {
  it.each([["dialysis", 240], ["wound_care", 60], ["outpatient", 60], ["outpatient_specialty", 90]])("seeds %s to %i minutes", (type, value) => expect(dwellMinutesFor(String(type))).toBe(value));
  it.each(["ift", "ift_discharge", "discharge", "psych_transport"])("leaves %s return wait null", type => {
    expect(dwellMinutesFor(type)).toBeNull();
    expect(suggestReturnPickup({ ...input, transportType: type }).value).toBeNull();
  });
  it("adds dwell to A drop only, without the legacy chair buffer", () => expect(suggestReturnPickup({ ...input, transportType: "dialysis" })).toMatchObject({ value: "12:00", source: "default" }));
  it("uses learned turnaround and explicit chair duration before company defaults", () => {
    expect(suggestReturnPickup({ ...input, transportType: "dialysis", turnaround: summarize([180,180,180,180,180]) })).toMatchObject({ value: "11:00", source: "history" });
    expect(suggestReturnPickup({ ...input, transportType: "dialysis", plannedChairMinutes: 120 })).toMatchObject({ value: "10:15", source: "plan" });
    expect(suggestReturnPickup({ ...input, transportType: "dialysis", turnaround: summarize([180,180,180,180]) })).toMatchObject({ value: "12:00", source: "default" });
  });
  it("allows tuned defaults or null without changing 30-minute in-vehicle fallback", () => {
    expect(suggestReturnPickup({ ...input, transportType: "dialysis", dwellDefaults: { ...DEFAULT_DWELL_MINUTES, dialysis: 300 } }).value).toBe("13:00");
    expect(dwellMinutesFor("dialysis", { dialysis: null })).toBeNull();
    expect(suggestTripDuration({ stats: summarize([]), plannedMinutes: null }).value).toBe(30);
  });
  it("does not invent an A drop when no anchor exists", () => expect(suggestReturnPickup({ ...input, chairTime: null, aLegDropTime: null, transportType: "dialysis" }).value).toBeNull());
});

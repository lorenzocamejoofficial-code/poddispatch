import { describe, expect, it } from "vitest";
import { buildTruckSuggestionFeedback } from "./truck-suggestion-feedback";

describe("buildTruckSuggestionFeedback", () => {
  it("names the run and suitable-truck count when a truck is available", () => {
    expect(buildTruckSuggestionFeedback({
      patientName: "Sam Example",
      legType: "A",
      pickupTime: "08:30:00",
      suitableCount: 3,
    })).toBe("Ranked 3 trucks for Sam Example A 08:30 — drag to place");
  });

  it("directs the dispatcher to the reasons when every truck is excluded", () => {
    expect(buildTruckSuggestionFeedback({
      patientName: "Sam Example",
      legType: "B",
      pickupTime: "14:00:00",
      suitableCount: 0,
    })).toBe("No suitable truck for Sam Example — see reasons");
  });

  it("omits a missing pickup time from the ranked confirmation", () => {
    expect(buildTruckSuggestionFeedback({
      patientName: "Sam Example",
      legType: "A",
      pickupTime: null,
      suitableCount: 1,
    })).toBe("Ranked 1 trucks for Sam Example A — drag to place");
  });
});

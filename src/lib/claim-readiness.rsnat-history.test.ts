import { describe, it, expect } from "vitest";
import { evaluateRsnatHistoryEligibility } from "@/lib/claim-readiness";

describe("evaluateRsnatHistoryEligibility", () => {
  it("3 dates within 10 days → three_in_ten", () => {
    const r = evaluateRsnatHistoryEligibility(["2026-10-01", "2026-10-05", "2026-10-10"]);
    expect(r).toMatchObject({ eligible: true, rule: "three_in_ten" });
  });
  it("one per week for 3 consecutive weeks, spread >10 days → weekly_for_three", () => {
    // 2026-10-01 Thu, 10-08 Thu, 10-15 Thu: span 14 days, consecutive weeks
    const r = evaluateRsnatHistoryEligibility(["2026-10-01", "2026-10-08", "2026-10-15"]);
    expect(r).toMatchObject({ eligible: true, rule: "weekly_for_three" });
  });
  it("2 dates close together → not eligible", () => {
    expect(evaluateRsnatHistoryEligibility(["2026-10-01", "2026-10-02", "2026-10-02"]).eligible).toBe(false);
  });
  it("weeks 1 and 3 but not 2, no 10-day cluster → not eligible", () => {
    const r = evaluateRsnatHistoryEligibility(["2026-10-01", "2026-10-15", "2026-10-29"]);
    expect(r).toMatchObject({ eligible: false, rule: null });
  });
  it("empty → not eligible", () => {
    expect(evaluateRsnatHistoryEligibility([])).toMatchObject({ eligible: false, rule: null });
  });
});

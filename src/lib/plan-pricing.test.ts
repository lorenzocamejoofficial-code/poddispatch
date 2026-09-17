import { describe, it, expect } from "vitest";
import { resolveMonthlyCents, sumMonthlyDollars, PLAN_MONTHLY_CENTS } from "./plan-pricing";

describe("plan-pricing", () => {
  it("uses the stored amount when present", () => {
    expect(resolveMonthlyCents({ monthly_amount_cents: 79_900, plan_id: "pro" })).toBe(79_900);
  });

  it("falls back to the founding price for a founding row", () => {
    expect(resolveMonthlyCents({ monthly_amount_cents: null, is_founding: true, plan_id: null }))
      .toBe(PLAN_MONTHLY_CENTS.founding);
  });

  it("falls back to the published plan price", () => {
    expect(resolveMonthlyCents({ monthly_amount_cents: null, plan_id: "pro" })).toBe(149_900);
    expect(resolveMonthlyCents({ monthly_amount_cents: null, plan_id: "starter" })).toBe(79_900);
  });

  it("never invents the old $599 default", () => {
    expect(resolveMonthlyCents({ monthly_amount_cents: null, plan_id: null })).toBeNull();
    expect(resolveMonthlyCents({ monthly_amount_cents: 0, plan_id: "poddispatch_standard" })).toBeNull();
    expect(resolveMonthlyCents(null)).toBeNull();
  });

  it("sums priced rows and counts the unpriced ones separately", () => {
    const { dollars, unpriced } = sumMonthlyDollars([
      { monthly_amount_cents: 79_900 },
      { monthly_amount_cents: null, plan_id: "pro" },
      { monthly_amount_cents: null, plan_id: null },
    ]);
    expect(dollars).toBe(2298);
    expect(unpriced).toBe(1);
  });
});

import { describe, it, expect } from "vitest";
import {
  applyFoundingGuard,
  monthlyAmountCentsFromPrice,
  FOUNDING_MONTHLY_CENTS,
} from "../../supabase/functions/stripe-webhook/founding-guard";

describe("applyFoundingGuard", () => {
  it("never flips a founding row to non-founding", () => {
    const { update, ignoredStaleMetadata } = applyFoundingGuard(
      { subscription_status: "active", is_founding: false, plan_id: "pro" },
      { is_founding: true, plan_id: "founding" },
    );
    expect(update.is_founding).toBeUndefined();
    expect(update.plan_id).toBeUndefined();
    expect(update.subscription_status).toBe("active");
    expect(ignoredStaleMetadata).toBe(true);
  });

  it("leaves non-founding rows alone", () => {
    const { update, ignoredStaleMetadata } = applyFoundingGuard(
      { is_founding: true, plan_id: "founding" },
      { is_founding: false, plan_id: "starter" },
    );
    expect(update.is_founding).toBe(true);
    expect(update.plan_id).toBe("founding");
    expect(ignoredStaleMetadata).toBe(false);
  });

  it("treats a missing existing row as non-founding", () => {
    const { update } = applyFoundingGuard({ plan_id: "starter" }, null);
    expect(update.plan_id).toBe("starter");
  });

  it("does not warn when founding metadata already agrees", () => {
    const { ignoredStaleMetadata } = applyFoundingGuard(
      { is_founding: true, plan_id: "founding" },
      { is_founding: true, plan_id: "founding" },
    );
    expect(ignoredStaleMetadata).toBe(false);
  });
});

describe("monthlyAmountCentsFromPrice", () => {
  it("reads a monthly founding price", () => {
    expect(
      monthlyAmountCentsFromPrice(
        { unit_amount: 79900, recurring: { interval: "month", interval_count: 1 } },
        true,
      ),
    ).toBe(FOUNDING_MONTHLY_CENTS);
  });

  it("converts a yearly price to a monthly equivalent", () => {
    expect(
      monthlyAmountCentsFromPrice(
        { unit_amount: 799000, recurring: { interval: "year", interval_count: 1 } },
        false,
      ),
    ).toBe(66583);
  });

  it("falls back to $799 for founding when the price is unreadable", () => {
    expect(monthlyAmountCentsFromPrice(null, true)).toBe(FOUNDING_MONTHLY_CENTS);
  });

  it("returns null for non-founding when the price is unreadable", () => {
    expect(monthlyAmountCentsFromPrice(undefined, false)).toBeNull();
  });
});

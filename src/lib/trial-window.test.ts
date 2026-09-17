import { describe, it, expect } from "vitest";
import { resolveTrialEnd, trialDaysLeft, isTrialExpired, TRIAL_LENGTH_DAYS } from "./trial-window";

const DAY = 86_400_000;

describe("trial-window", () => {
  it("prefers the stored trial_ends_at", () => {
    const now = new Date("2026-09-17T00:00:00Z");
    const end = new Date("2026-09-27T00:00:00Z");
    expect(trialDaysLeft({ trial_ends_at: end.toISOString(), trial_started_at: "2026-01-01T00:00:00Z" }, now)).toBe(10);
  });

  it("falls back to trial_started_at + 30 days when trial_ends_at is null", () => {
    const start = new Date("2026-09-01T00:00:00Z");
    const now = new Date("2026-09-17T00:00:00Z");
    expect(resolveTrialEnd({ trial_started_at: start.toISOString(), trial_ends_at: null })?.getTime())
      .toBe(start.getTime() + TRIAL_LENGTH_DAYS * DAY);
    expect(trialDaysLeft({ trial_started_at: start.toISOString(), trial_ends_at: null }, now)).toBe(14);
  });

  it("returns null when neither date is known", () => {
    expect(resolveTrialEnd({})).toBeNull();
    expect(trialDaysLeft({})).toBeNull();
    expect(isTrialExpired({})).toBeNull();
    expect(trialDaysLeft(null)).toBeNull();
  });

  it("reports expiry once the window closes", () => {
    const start = new Date("2026-07-26T04:37:00Z").toISOString();
    expect(isTrialExpired({ trial_started_at: start }, new Date("2026-08-01T00:00:00Z"))).toBe(false);
    expect(isTrialExpired({ trial_started_at: start }, new Date("2026-09-17T00:00:00Z"))).toBe(true);
  });

  it("agrees across surfaces for the same row", () => {
    const row = { trial_started_at: "2026-09-01T00:00:00Z", trial_ends_at: null };
    const now = new Date("2026-09-17T00:00:00Z");
    expect(trialDaysLeft(row, now)).toBe(trialDaysLeft({ ...row }, now));
  });
});

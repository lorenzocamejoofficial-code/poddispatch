import { describe, it, expect } from "vitest";
import { resolveTrialEnd, trialDaysLeft, isTrialExpired, TRIAL_LENGTH_DAYS } from "./trial-window";

const DAY = 86_400_000;
const NOW = new Date("2026-03-10T12:00:00Z");

describe("shared trial clock", () => {
  it("prefers the stored end date over the derived one", () => {
    const end = resolveTrialEnd({
      trial_started_at: "2026-01-01T00:00:00Z",
      trial_ends_at: "2026-04-01T00:00:00Z",
    });
    expect(end?.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  it("derives start + 30 days when the end date is missing", () => {
    const end = resolveTrialEnd({ trial_started_at: "2026-03-01T00:00:00Z", trial_ends_at: null });
    expect(end?.getTime()).toBe(new Date("2026-03-01T00:00:00Z").getTime() + TRIAL_LENGTH_DAYS * DAY);
  });

  it("returns null when neither date is known", () => {
    expect(resolveTrialEnd({ trial_started_at: null, trial_ends_at: null })).toBeNull();
    expect(trialDaysLeft({}, NOW)).toBeNull();
    expect(isTrialExpired({}, NOW)).toBeNull();
  });

  it("reports the same days-left for every surface reading the same row", () => {
    const row = { trial_ends_at: "2026-03-20T12:00:00Z", trial_started_at: "2026-02-18T12:00:00Z" };
    expect(trialDaysLeft(row, NOW)).toBe(10);
    expect(isTrialExpired(row, NOW)).toBe(false);
  });

  it("goes negative (not clamped) once the window closes", () => {
    const row = { trial_ends_at: "2026-03-05T12:00:00Z" };
    expect(trialDaysLeft(row, NOW)).toBe(-5);
    expect(isTrialExpired(row, NOW)).toBe(true);
  });

  it("treats the exact end instant as expired", () => {
    expect(isTrialExpired({ trial_ends_at: NOW.toISOString() }, NOW)).toBe(true);
  });
});

// Mirrors the selection logic in supabase/functions/sweep-trial-expiry: the
// sweep must persist exactly what the shared helper computes, and must be a
// no-op on a second run.
const TRIAL_STATUSES = ["trial", "trial_active", "TEST_ACTIVE"];

interface Row {
  subscription_status: string;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  is_comped?: boolean;
}

function sweep(rows: Row[], now: Date) {
  let expired = 0;
  for (const r of rows) {
    if (!TRIAL_STATUSES.includes(r.subscription_status)) continue;
    if (r.is_comped) continue;
    if (isTrialExpired(r, now) !== true) continue;
    r.subscription_status = "trial_expired";
    r.trial_ends_at ??= resolveTrialEnd(r)!.toISOString();
    expired++;
  }
  return expired;
}

describe("trial expiry sweep", () => {
  it("expires only past-due running trials and is idempotent", () => {
    const rows: Row[] = [
      { subscription_status: "trial_active", trial_ends_at: "2026-03-01T00:00:00Z" },
      { subscription_status: "trial_active", trial_ends_at: "2026-04-01T00:00:00Z" },
      { subscription_status: "active", trial_ends_at: "2026-01-01T00:00:00Z" },
      { subscription_status: "cancelled", trial_ends_at: "2026-01-01T00:00:00Z" },
      { subscription_status: "trial_active", trial_started_at: "2026-01-01T00:00:00Z", trial_ends_at: null },
      { subscription_status: "trial_active", trial_ends_at: "2026-01-01T00:00:00Z", is_comped: true },
      { subscription_status: "trial_active", trial_ends_at: null, trial_started_at: null },
    ];
    expect(sweep(rows, NOW)).toBe(2);
    expect(rows[4].trial_ends_at).toBe("2026-01-31T00:00:00.000Z");
    expect(rows[5].subscription_status).toBe("trial_active");
    expect(rows[6].subscription_status).toBe("trial_active");
    // Second run changes nothing.
    expect(sweep(rows, NOW)).toBe(0);
  });

  it("agrees with the login gate for every row it leaves alone", () => {
    const rows: Row[] = [
      { subscription_status: "trial_active", trial_ends_at: "2026-03-01T00:00:00Z" },
      { subscription_status: "trial_active", trial_ends_at: "2026-03-20T00:00:00Z" },
    ];
    sweep(rows, NOW);
    for (const r of rows) {
      const gateSaysExpired = isTrialExpired(r, NOW) === true;
      expect(r.subscription_status === "trial_expired").toBe(gateSaysExpired);
    }
  });
});

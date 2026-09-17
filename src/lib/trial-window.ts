/**
 * Single source of truth for how long a trial lasts and when it ends.
 *
 * Several surfaces used to each re-derive this (creator Trial Countdown hardcoded
 * `trial_started_at + 30 days`, the company health table read `trial_ends_at`, the
 * tenant trial banner hardcoded 30 again), so the same company could show different
 * days-left depending on which panel you looked at. Everything display-facing should
 * import from here.
 */

export const TRIAL_LENGTH_DAYS = 30;

const DAY_MS = 86_400_000;

export interface TrialWindowSource {
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
}

/**
 * Resolve the trial end date for a subscription row.
 * Prefers the stored `trial_ends_at`; falls back to `trial_started_at + TRIAL_LENGTH_DAYS`
 * for rows written before that column was populated. Returns null when neither is known.
 */
export function resolveTrialEnd(row: TrialWindowSource | null | undefined): Date | null {
  if (!row) return null;
  if (row.trial_ends_at) {
    const d = new Date(row.trial_ends_at);
    if (!isNaN(d.getTime())) return d;
  }
  if (row.trial_started_at) {
    const start = new Date(row.trial_started_at);
    if (!isNaN(start.getTime())) return new Date(start.getTime() + TRIAL_LENGTH_DAYS * DAY_MS);
  }
  return null;
}

/** Whole days remaining until the trial ends. Negative when already past. Null when unknown. */
export function trialDaysLeft(row: TrialWindowSource | null | undefined, now: Date = new Date()): number | null {
  const end = resolveTrialEnd(row);
  if (!end) return null;
  return Math.ceil((end.getTime() - now.getTime()) / DAY_MS);
}

/** True when the trial window has closed. False when still running, null when unknown. */
export function isTrialExpired(row: TrialWindowSource | null | undefined, now: Date = new Date()): boolean | null {
  const days = trialDaysLeft(row, now);
  if (days === null) return null;
  return days <= 0;
}

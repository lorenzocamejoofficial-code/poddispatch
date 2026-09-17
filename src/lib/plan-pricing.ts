/**
 * Plan pricing resolution for creator revenue metrics.
 *
 * The SaaS metrics panel used to fall back to a stale hardcoded 59900 ($599) whenever
 * `monthly_amount_cents` was missing, and computed "New Business MRR" as a flat
 * `count * 599` regardless of plan. Both silently misreported real revenue.
 *
 * Rule now: use the stored amount when present, otherwise fall back to the published
 * price for the recorded plan, otherwise report the row as UNPRICED and exclude it
 * from revenue totals rather than inventing a number.
 */

/** Published monthly list prices, in cents. Yearly plans bill 10 months up front. */
export const PLAN_MONTHLY_CENTS: Record<string, number> = {
  founding: 79_900,
  starter: 79_900,
  pro: 149_900,
};

export interface PricedRow {
  monthly_amount_cents?: number | null;
  plan_id?: string | null;
  is_founding?: boolean | null;
}

/**
 * Monthly revenue for one subscription row, in cents.
 * Returns null when the amount cannot be established — callers must treat null as
 * "unknown", never as zero and never as a default price.
 */
export function resolveMonthlyCents(row: PricedRow | null | undefined): number | null {
  if (!row) return null;
  if (typeof row.monthly_amount_cents === "number" && row.monthly_amount_cents > 0) {
    return row.monthly_amount_cents;
  }
  if (row.is_founding) return PLAN_MONTHLY_CENTS.founding;
  const plan = (row.plan_id ?? "").toLowerCase();
  if (plan && PLAN_MONTHLY_CENTS[plan]) return PLAN_MONTHLY_CENTS[plan];
  return null;
}

/** Sum monthly revenue across rows, reporting how many rows had no resolvable price. */
export function sumMonthlyDollars(rows: PricedRow[]): { dollars: number; unpriced: number } {
  let cents = 0;
  let unpriced = 0;
  for (const r of rows) {
    const c = resolveMonthlyCents(r);
    if (c === null) unpriced++;
    else cents += c;
  }
  return { dollars: cents / 100, unpriced };
}

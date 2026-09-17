// Pure, dependency-free helpers for the Stripe webhook.
//
// Founding is ONE-WAY in this function: once a subscription_records row has
// is_founding = true, no Stripe event may flip it back to false or move
// plan_id off 'founding'. Only the creator grant/revoke path in
// manage-company may change founding status.

export const FOUNDING_MONTHLY_CENTS = 79900;

export type ExistingSubRow = {
  is_founding?: boolean | null;
  plan_id?: string | null;
} | null;

/**
 * Applies founding protection to a pending subscription_records update.
 *
 * When the existing row is founding, `is_founding` and `plan_id` are stripped
 * from the update entirely so the stored values survive untouched. Every other
 * field passes through unchanged.
 */
export function applyFoundingGuard(
  update: Record<string, unknown>,
  existing: ExistingSubRow,
): { update: Record<string, unknown>; ignoredStaleMetadata: boolean } {
  const isExistingFounding = existing?.is_founding === true;
  if (!isExistingFounding) return { update, ignoredStaleMetadata: false };

  const guarded = { ...update };
  const staleFounding = "is_founding" in guarded && guarded.is_founding !== true;
  const stalePlan = "plan_id" in guarded && guarded.plan_id !== "founding";

  delete guarded.is_founding;
  delete guarded.plan_id;

  return { update: guarded, ignoredStaleMetadata: staleFounding || stalePlan };
}

type PriceLike = {
  unit_amount?: number | null;
  recurring?: { interval?: string | null; interval_count?: number | null } | null;
} | null | undefined;

/**
 * Monthly-equivalent amount in cents derived from the real Stripe price.
 * Yearly prices are divided by 12 (e.g. Starter yearly 799000 -> 66583).
 * Returns null when the price cannot be read, so callers can skip the write
 * rather than zeroing a good value.
 */
export function monthlyAmountCentsFromPrice(
  price: PriceLike,
  isFounding: boolean,
): number | null {
  const unit = price?.unit_amount;
  if (typeof unit !== "number" || unit <= 0) {
    // Fallback: a founding company is always $799/mo. Otherwise leave alone.
    return isFounding ? FOUNDING_MONTHLY_CENTS : null;
  }
  const interval = price?.recurring?.interval ?? "month";
  const count = price?.recurring?.interval_count ?? 1;
  let months = count;
  if (interval === "year") months = 12 * count;
  else if (interval === "week") months = count / 4.345;
  else if (interval === "day") months = count / 30.44;
  if (!months || months <= 0) months = 1;
  return Math.round(unit / months);
}

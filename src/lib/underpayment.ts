/**
 * Underpayment ("Paid Short") detection.
 *
 * A claim marked `paid` is not the same thing as a claim paid *correctly*.
 * Payers routinely remit less than the contracted allowed amount — a bundled
 * mileage line, a silently applied sequestration cut, a duplicate-line denial
 * inside an otherwise-paid CLP. Nothing in the app surfaced that gap, so the
 * money quietly disappeared once the claim flipped to "paid".
 *
 * This module is the single source of truth for "was this claim paid short?".
 * It is a pure function over the posted money fields (835 CLP/SVC values that
 * the remittance importer writes onto claim_records) so it can be unit tested
 * and reused by the Missing Money scanner and any claim-level UI.
 *
 * DELIBERATE NON-GOALS
 *  - It never touches the 837P/EDI path. Detection only, no claim mutation.
 *  - It never flags against billed charges alone. Charges are always higher
 *    than the allowed amount by design; comparing to charges would flag every
 *    correctly-paid claim. Without an allowed or expected amount on file we
 *    report "no benchmark" rather than inventing one.
 */

export interface PaymentSnapshot {
  /** What we billed. Never used as a payment benchmark on its own. */
  total_charge?: number | null;
  /** Our own contract/fee-schedule expectation for this claim. */
  expected_revenue?: number | null;
  /** Payer-reported allowed amount (835 CLP04-adjacent). Best benchmark. */
  allowed_amount?: number | null;
  /** Dollars actually received from the payer (835 CLP04). */
  amount_paid?: number | null;
  /** Deductible / coinsurance / copay pushed to the patient (PR-*). */
  patient_responsibility_amount?: number | null;
  /** Contractual write-off recorded at posting (CO-45 and friends). */
  write_off_amount?: number | null;
  /** CARC codes posted with the remittance. */
  adjustment_codes?: string[] | null;
}

export type BenchmarkSource = "allowed" | "expected" | "none";

export interface UnderpaymentResult {
  /** True when the payer owes more than it sent. */
  isShort: boolean;
  /** Which figure we measured against. */
  benchmarkSource: BenchmarkSource;
  /** The benchmark dollars (allowed or expected). 0 when none available. */
  benchmark: number;
  /** Benchmark minus patient responsibility — what the payer itself owed. */
  expectedFromPayer: number;
  /** Dollars actually received. */
  paid: number;
  /** expectedFromPayer - paid, floored at 0 and rounded to cents. */
  shortfall: number;
  /** Shortfall as a share of expectedFromPayer (0-1). */
  shortfallPct: number;
  /** Plain-English explanation for the biller. */
  reason: string;
}

/** Ignore rounding noise: a claim is only "short" past both thresholds. */
export const UNDERPAY_DOLLAR_TOLERANCE = 1;
export const UNDERPAY_PCT_TOLERANCE = 0.02;

const money = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number): number => Math.round(n * 100) / 100;

const NO_BENCHMARK: Omit<UnderpaymentResult, "paid"> = {
  isShort: false,
  benchmarkSource: "none",
  benchmark: 0,
  expectedFromPayer: 0,
  shortfall: 0,
  shortfallPct: 0,
  reason:
    "No allowed or expected amount on file — cannot verify this payment. Add a contracted rate in the Charge Master or import the 835 so the allowed amount posts.",
};

/**
 * Compare what a payer should have sent against what it actually sent.
 *
 * Benchmark precedence:
 *   1. `allowed_amount` — the payer's own adjudicated allowable. Already net
 *      of the contractual write-off, so the write-off is NOT subtracted again.
 *   2. `expected_revenue` — our fee-schedule expectation when no 835 allowed
 *      amount posted. Write-offs are deliberately not subtracted here: an
 *      unverified write-off is exactly the leak this check exists to catch.
 *   3. Nothing — reported as `benchmarkSource: "none"`, never flagged.
 */
export function evaluateUnderpayment(snap: PaymentSnapshot): UnderpaymentResult {
  const paid = round2(money(snap.amount_paid));
  const patientResp = round2(money(snap.patient_responsibility_amount));

  const allowed = money(snap.allowed_amount);
  const expected = money(snap.expected_revenue);

  let benchmark = 0;
  let benchmarkSource: BenchmarkSource = "none";
  if (allowed > 0) {
    benchmark = round2(allowed);
    benchmarkSource = "allowed";
  } else if (expected > 0) {
    benchmark = round2(expected);
    benchmarkSource = "expected";
  }

  if (benchmarkSource === "none") {
    return { ...NO_BENCHMARK, paid };
  }

  const expectedFromPayer = round2(Math.max(benchmark - patientResp, 0));
  const shortfall = round2(Math.max(expectedFromPayer - paid, 0));
  const shortfallPct = expectedFromPayer > 0 ? shortfall / expectedFromPayer : 0;

  // Posted as paid but nothing actually arrived — always worth a look, no
  // percentage tolerance applies.
  if (expectedFromPayer > UNDERPAY_DOLLAR_TOLERANCE && paid <= 0) {
    return {
      isShort: true,
      benchmarkSource,
      benchmark,
      expectedFromPayer,
      paid,
      shortfall,
      shortfallPct: 1,
      reason: `Marked paid but $0 was received. ${
        benchmarkSource === "allowed" ? "Payer allowed" : "Expected"
      } $${expectedFromPayer.toFixed(2)}.`,
    };
  }

  const isShort =
    shortfall > UNDERPAY_DOLLAR_TOLERANCE && shortfallPct > UNDERPAY_PCT_TOLERANCE;

  const codes = (snap.adjustment_codes ?? []).filter(Boolean).map(String);
  const codeNote = codes.length ? ` Posted adjustments: ${codes.join(", ")}.` : "";

  return {
    isShort,
    benchmarkSource,
    benchmark,
    expectedFromPayer,
    paid,
    shortfall,
    shortfallPct,
    reason: isShort
      ? `Paid $${paid.toFixed(2)} against ${
          benchmarkSource === "allowed" ? "an allowed" : "an expected"
        } $${expectedFromPayer.toFixed(2)} (after $${patientResp.toFixed(
          2,
        )} patient responsibility) — $${shortfall.toFixed(2)} short, ${(
          shortfallPct * 100
        ).toFixed(0)}%.${codeNote} Review the remittance and appeal or rebill the balance.`
      : `Paid in full against the ${
          benchmarkSource === "allowed" ? "allowed" : "expected"
        } amount.`,
  };
}

/** Compact label for the Missing Money row. */
export function underpaymentSummaryLine(r: UnderpaymentResult): string {
  if (!r.isShort) return "";
  return `exp $${r.expectedFromPayer.toFixed(2)} · paid $${r.paid.toFixed(2)}`;
}

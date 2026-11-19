/**
 * Missing Money tie-in for coverage_checks (pure, no I/O).
 * - Unreviewed discovery results implying a secondary become a "review" prompt
 *   (not billable yet).
 * - Only a confirmed_secondary review writes patients.secondary_payer (via
 *   planReviewAction), which is what admits that patient's paid claims into
 *   the existing "Secondary Not Billed" bucket.
 */
import { isSecondaryOpportunity, type CoverageCheckRow } from "./review-actions";

export type TieInRow = CoverageCheckRow & { implied_cob_order: string; patient_id: string; checked_at: string };

/** One prompt per patient (newest qualifying result wins). */
export function secondaryReviewPrompts<T extends TieInRow>(rows: T[]): T[] {
  const byPatient = new Map<string, T>();
  for (const r of rows) {
    if (!isSecondaryOpportunity(r)) continue;
    const prev = byPatient.get(r.patient_id);
    if (!prev || r.checked_at > prev.checked_at) byPatient.set(r.patient_id, r);
  }
  return [...byPatient.values()];
}

/** Same rule the existing bucket uses: patient must have a secondary payer on file. */
export function patientQualifiesForSecondaryBucket(patient: { secondary_payer?: string | null } | null | undefined): boolean {
  return !!patient?.secondary_payer;
}

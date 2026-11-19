/**
 * Denial Recovery checklist reconciliation.
 *
 * The CARC switch in DenialRecoveryEngine only knows what a denial code
 * USUALLY means. The claim's real state comes from detectClaimBlockers (the
 * same rules as the claim card). This turns the two into one actionable list:
 *   - every real blocker becomes an item, worded and linked exactly as on the card;
 *   - CARC items tied to claim fields are dropped (if the field is really
 *     missing, its blocker is already listed; if it is filled in, it is not a step);
 *   - CARC judgment steps with no field (appeal letter, documentation review)
 *     are kept, because no validator can decide them.
 */
import type { ReadinessIssue } from "@/lib/claim-readiness";

export interface DenialChecklistItem {
  id: string;
  label: string;
  fields?: string[];
  fixPath?: string;
  fixLabel?: string;
  /** True when the item is a live blocker: it clears only when the field is
   *  fixed and re-checked, never by ticking. */
  blocker?: boolean;
}

export interface DenialFixContext {
  tripId: string | null;
  patientId: string | null;
  claimId: string;
}

const PATIENT_FIELDS = new Set([
  "member_id", "patient_name", "patient_dob", "patient_sex", "patient_address", "patient_zip",
  "prior_auth_utn", "rsnat", "secondary_payer",
]);
const CLAIM_FIELDS = new Set(["hcpcs_codes", "total_charge", "charges", "payer", "payer_id", "pcs_certification_date", "timely_filing"]);

/** Where a field is fixed when the blocker itself carries no link. */
export function denialFixPath(field: string, ctx: DenialFixContext): { fixPath: string; fixLabel: string } {
  if (PATIENT_FIELDS.has(field)) {
    return {
      fixPath: ctx.patientId ? `/patients?patientId=${ctx.patientId}&focus=${field}` : `/patients?focus=${field}`,
      fixLabel: "Fix in patient chart",
    };
  }
  if (!CLAIM_FIELDS.has(field) && ctx.tripId) {
    return { fixPath: `/trips?tripId=${ctx.tripId}&focus=${field}`, fixLabel: "Open trip record" };
  }
  return { fixPath: `/billing?claimId=${ctx.claimId}&focus=${field}`, fixLabel: "Open claim" };
}

export function reconcileDenialChecklist(
  carcItems: DenialChecklistItem[],
  blockers: ReadinessIssue[],
  ctx: DenialFixContext,
): DenialChecklistItem[] {
  const seen = new Set<string>();
  const blockerItems: DenialChecklistItem[] = [];
  for (const b of blockers) {
    if (b.severity !== "block") continue;
    const key = `${b.field}|${b.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const link = b.fixPath ? { fixPath: b.fixPath, fixLabel: b.fixLabel ?? "Fix" } : denialFixPath(b.field, ctx);
    blockerItems.push({ id: `blocker:${key}`, label: b.message, fields: [b.field], blocker: true, ...link });
  }
  const judgment = carcItems.filter((i) => !i.fields || i.fields.length === 0);
  return [...blockerItems, ...judgment];
}

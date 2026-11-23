import { describe, it, expect } from "vitest";
import { planReviewAction } from "./review-actions";
import { secondaryReviewPrompts, patientQualifiesForSecondaryBucket, type TieInRow } from "./tie-in";

const row = (o: Partial<TieInRow> = {}): TieInRow => ({
  id: "c1", patient_id: "p1", check_type: "discovery", status: "coverage_found",
  payer_name: "Sample Payer", payer_member_id: "SAMPLE123", reviewed: false, review_action: null,
  implied_cob_order: "secondary", checked_at: "2026-01-02T00:00:00Z", ...o,
});

describe("coverage → Missing Money tie-in", () => {
  it("unreviewed secondary discovery becomes a review prompt", () => {
    expect(secondaryReviewPrompts([row()])).toHaveLength(1);
  });
  it("primary, not-found, eligibility and reviewed rows are not prompts", () => {
    expect(secondaryReviewPrompts([
      row({ implied_cob_order: "primary" }),
      row({ status: "none" }),
      row({ check_type: "eligibility", status: "active" }),
      row({ reviewed: true, review_action: "dismissed" }),
    ])).toHaveLength(0);
  });
  it("dedupes to one prompt per patient, newest first", () => {
    const out = secondaryReviewPrompts([row({ id: "old" }), row({ id: "new", checked_at: "2026-02-01T00:00:00Z" })]);
    expect(out.map((r) => r.id)).toEqual(["new"]);
  });
  it("patient enters the secondary bucket only after confirmed_secondary", () => {
    const patient: { secondary_payer: string | null } = { secondary_payer: null };
    expect(patientQualifiesForSecondaryBucket(patient)).toBe(false);
    const dismissed = planReviewAction(row(), "dismissed", "u1", "2026-01-03T00:00:00Z");
    expect(patientQualifiesForSecondaryBucket({ ...patient, ...(dismissed.patientUpdate ?? {}) })).toBe(false);
    const confirmed = planReviewAction(row(), "confirmed_secondary", "u1", "2026-01-03T00:00:00Z");
    const after = { ...patient, ...confirmed.patientUpdate };
    expect(patientQualifiesForSecondaryBucket(after)).toBe(true);
    expect(confirmed.patientUpdate).toEqual({ secondary_payer: "Sample Payer", secondary_member_id: "SAMPLE123" });
    expect(confirmed.checkUpdate.review_action).toBe("confirmed_secondary");
  });
  it("tertiary confirmation removes the review prompt without creating a secondary bucket", () => {
    const check = row({ group_number: "SAMPLE-GROUP", payer_id: "SAMPLE-PAYER" });
    const confirmed = planReviewAction(check, "confirmed_tertiary", "u1", "2026-01-03T00:00:00Z");
    expect(confirmed.patientUpdate).toEqual({ tertiary_payer: "Sample Payer", tertiary_member_id: "SAMPLE123", tertiary_group_number: "SAMPLE-GROUP", tertiary_payer_id: "SAMPLE-PAYER" });
    expect(secondaryReviewPrompts([{ ...check, ...confirmed.checkUpdate }])).toEqual([]);
    expect(patientQualifiesForSecondaryBucket({ secondary_payer: null, ...confirmed.patientUpdate })).toBe(false);
  });

});

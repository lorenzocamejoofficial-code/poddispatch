import { describe, it, expect } from "vitest";
import {
  StubProvider, OfficeAllyProvider, selectCoverageProvider, ProviderNotConfiguredError, toCoverageCheckRow,
} from "../../../supabase/functions/_shared/coverage/providers";
import { planReviewAction, isSecondaryOpportunity } from "./review-actions";

const patient = { patient_id: "00000000-0000-0000-0000-000000000001", first_name: "Test", last_name: "Synthetic", dob: "1950-01-01", primary_payer: "Medicare", member_id: "9MD0CA0AA01" };

describe("coverage providers", () => {
  it("defaults to the stub and selects Office Ally only by flag", () => {
    expect(selectCoverageProvider(null).source).toBe("stub");
    expect(selectCoverageProvider("weird").source).toBe("stub");
    expect(selectCoverageProvider("office_ally").source).toBe("office_ally");
  });
  it("stub discovery is deterministic, labeled SAMPLE, secondary/medium", async () => {
    const p = new StubProvider();
    const a = await p.discoverCoverage(patient);
    expect(a).toEqual(await p.discoverCoverage(patient));
    expect(a.source).toBe("stub");
    expect(a.status).toBe("coverage_found");
    expect(a.implied_cob_order).toBe("secondary");
    expect(a.confidence).toBe("medium");
    expect(a.payer_name).toMatch(/^SAMPLE/);
    expect(a.raw_response).toMatchObject({ sample: true });
  });
  it("stub eligibility is unknown without a payer on file", async () => {
    const r = await new StubProvider().checkEligibility({ ...patient, primary_payer: null });
    expect(r.status).toBe("unknown");
  });
  it("Office Ally seam rejects as not configured", async () => {
    await expect(new OfficeAllyProvider().discoverCoverage(patient)).rejects.toBeInstanceOf(ProviderNotConfiguredError);
    await expect(new OfficeAllyProvider().checkEligibility(patient)).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });
  it("row is stored unreviewed", async () => {
    const r = await new StubProvider().discoverCoverage(patient);
    const row = toCoverageCheckRow("c1", patient.patient_id, r, "2026-11-19T00:00:00Z");
    expect(row.reviewed).toBe(false);
    expect(row.company_id).toBe("c1");
    expect(row.group_number).toBe("SAMPLE-GROUP-002");
    expect(row.payer_id).toBe("SAMPLE-PAYER-002");
  });
});

const base = { id: "x", check_type: "discovery" as const, status: "coverage_found", payer_name: "SAMPLE BCBS", payer_member_id: "SAMPLE1", reviewed: false, review_action: null };

describe("review actions", () => {
  it("confirm secondary writes secondary fields", () => {
    const p = planReviewAction(base, "confirmed_secondary", "u", "t");
    expect(p.patientUpdate).toEqual({ secondary_payer: "SAMPLE BCBS", secondary_member_id: "SAMPLE1" });
    expect(p.checkUpdate).toEqual({ reviewed: true, review_action: "confirmed_secondary", reviewed_by: "u", reviewed_at: "t" });
  });
  it("confirm primary writes primary fields", () => {
    expect(planReviewAction(base, "confirmed_primary", "u", "t").patientUpdate).toEqual({ primary_payer: "SAMPLE BCBS", member_id: "SAMPLE1" });
  });
  it("dismiss touches no patient fields", () => {
    expect(planReviewAction(base, "dismissed", "u", "t").patientUpdate).toBeNull();
  });
  it("cannot review twice", () => {
    expect(() => planReviewAction({ ...base, reviewed: true, review_action: "dismissed" }, "dismissed", "u", "t")).toThrow();
  });
  it("cannot confirm a 'none' result", () => {
    expect(() => planReviewAction({ ...base, status: "none" }, "confirmed_secondary", "u", "t")).toThrow();
  });
  it("secondary opportunity only for unreviewed found secondary discovery", () => {
    expect(isSecondaryOpportunity({ ...base, implied_cob_order: "secondary" })).toBe(true);
    expect(isSecondaryOpportunity({ ...base, implied_cob_order: "primary" })).toBe(false);
    expect(isSecondaryOpportunity({ ...base, implied_cob_order: "secondary", reviewed: true, review_action: "dismissed" })).toBe(false);
  });
  it("missing identifiers on older results do not erase patient fields", () => {
    const result = planReviewAction({ ...base, group_number: null, payer_id: null }, "confirmed_primary", "u", "t");
    expect(result.patientUpdate).toEqual({ primary_payer: "SAMPLE BCBS", member_id: "SAMPLE1" });
  });

});

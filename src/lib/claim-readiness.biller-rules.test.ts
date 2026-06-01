import { describe, it, expect } from "vitest";
import {
  evaluateClaimReadiness,
  isRsnatTransport,
  type ReadinessInputs,
} from "./claim-readiness";

// Minimal claim that passes every existing readiness check so each fixture
// isolates ONLY the new biller-stage rule under test.
const baseClaim: ReadinessInputs["claim"] = {
  id: "claim-1",
  patient_id: "pat-1",
  trip_id: "trip-1",
  patient_name: "Doe, Jane",
  patient_dob: "1955-04-12",
  patient_sex: "F",
  patient_address: "100 Main St",
  patient_city: "Atlanta",
  patient_state: "GA",
  patient_zip: "30301",
  member_id: "MED12345",
  payer_name: "Medicare Part B",
  payer_id: "MEDI",
  payer_type: "medicare",
  run_date: "2026-06-01",
  hcpcs_codes: ["A0428"],
  hcpcs_modifiers: ["NH"],
  total_charge: 250,
  base_charge: 200,
  mileage_charge: 50,
  loaded_miles: 5,
  origin_type: "N",
  destination_type: "H",
  origin_zip: "30301",
  diagnosis_codes: [],
  auth_number: null,
  icd10_codes: ["I10"],
  bed_confined: false,
  requires_monitoring: false,
  stretcher_placement: null,
  oxygen_required: false,
  weight_lbs: null,
  pickup_facility_name: null,
  dropoff_facility_name: null,
  pcs_on_file: false,
  claim_filing_indicator: "MB",
};

function billerBlocks(issues: ReturnType<typeof evaluateClaimReadiness>) {
  return issues.filter((i) => i.stage === "biller" && i.severity === "block");
}

describe("evaluateClaimReadiness — biller-stage rules (additive)", () => {
  it("baseline non-stretcher / non-RSNAT / no-PCS claim produces NO new biller blocks", () => {
    const issues = evaluateClaimReadiness({ claim: baseClaim });
    expect(billerBlocks(issues)).toEqual([]);
  });

  describe("Rule 5 — PCS certification date", () => {
    it("BLOCKS when pcs_on_file=true and cert date missing", () => {
      const issues = evaluateClaimReadiness({
        claim: { ...baseClaim, pcs_on_file: true, pcs_certification_date: null },
      });
      const blocks = billerBlocks(issues);
      expect(blocks.map((b) => b.field)).toContain("pcs_certification_date");
      expect(blocks.find((b) => b.field === "pcs_certification_date")?.message)
        .toBe("PCS certification date missing");
    });

    it("PASSES when pcs_on_file=true and cert date present", () => {
      const issues = evaluateClaimReadiness({
        claim: { ...baseClaim, pcs_on_file: true, pcs_certification_date: "2026-05-01" },
      });
      expect(billerBlocks(issues).find((b) => b.field === "pcs_certification_date"))
        .toBeUndefined();
    });

    it("PASSES (skipped) when pcs_on_file=false", () => {
      const issues = evaluateClaimReadiness({
        claim: { ...baseClaim, pcs_on_file: false, pcs_certification_date: null },
      });
      expect(billerBlocks(issues).find((b) => b.field === "pcs_certification_date"))
        .toBeUndefined();
    });
  });

  describe("Rule 4 — Stretcher secondary ICD", () => {
    it("BLOCKS when stretcher set and only one ICD-10 code", () => {
      const issues = evaluateClaimReadiness({
        claim: { ...baseClaim, stretcher_placement: "supine", icd10_codes: ["I10"] },
      });
      const blocks = billerBlocks(issues);
      const stretcherIssue = blocks.find(
        (b) => b.message.includes("Stretcher claim needs a secondary diagnosis"),
      );
      expect(stretcherIssue).toBeDefined();
      expect(stretcherIssue?.field).toBe("icd10_codes");
    });

    it("PASSES when stretcher set and two ICD-10 codes present", () => {
      const issues = evaluateClaimReadiness({
        claim: {
          ...baseClaim,
          stretcher_placement: "supine",
          icd10_codes: ["I10", "M62.81"],
        },
      });
      expect(billerBlocks(issues).find((b) => b.field === "icd10_codes"))
        .toBeUndefined();
    });

    it("PASSES (skipped) when stretcher_placement is 'ambulatory'", () => {
      const issues = evaluateClaimReadiness({
        claim: { ...baseClaim, stretcher_placement: "ambulatory", icd10_codes: ["I10"] },
      });
      expect(billerBlocks(issues).find((b) => b.field === "icd10_codes"))
        .toBeUndefined();
    });
  });

  describe("Rule 2 — RSNAT prior authorization", () => {
    it("isRsnatTransport: TRUE for Medicare + dialysis destination", () => {
      expect(
        isRsnatTransport(
          { ...baseClaim },
          null,
          { destination_facility_type: "dialysis" },
        ),
      ).toBe(true);
    });

    it("isRsnatTransport: TRUE for Medicare + recurring ≥3/week", () => {
      expect(
        isRsnatTransport(
          { ...baseClaim },
          { recurrence_days: [1, 3, 5] },
        ),
      ).toBe(true);
    });

    it("isRsnatTransport: FALSE for non-Medicare standing order (Medicare gate required)", () => {
      expect(
        isRsnatTransport(
          { ...baseClaim, payer_type: "commercial", payer_name: "Aetna" },
          { standing_order: true, recurrence_days: [1, 2, 3, 4, 5] },
          { destination_facility_type: "dialysis" },
        ),
      ).toBe(false);
    });

    it("BLOCKS Medicare dialysis transport when prior_auth_utn missing", () => {
      const issues = evaluateClaimReadiness({
        claim: baseClaim,
        transport: { destination_facility_type: "dialysis" },
        patient: { prior_auth_utn: null, prior_auth_period_end: null },
      });
      const rsnat = billerBlocks(issues).find((b) => b.field === "prior_auth_utn");
      expect(rsnat).toBeDefined();
      expect(rsnat?.message).toBe(
        "Prior authorization (RSNAT) required for repetitive Medicare transport",
      );
    });

    it("BLOCKS Medicare dialysis transport when prior_auth_period_end < run_date", () => {
      const issues = evaluateClaimReadiness({
        claim: baseClaim,
        transport: { destination_facility_type: "dialysis" },
        patient: { prior_auth_utn: "UTN12345", prior_auth_period_end: "2026-05-01" },
      });
      expect(
        billerBlocks(issues).find((b) => b.field === "prior_auth_utn"),
      ).toBeDefined();
    });

    it("PASSES Medicare dialysis transport with valid UTN and active period", () => {
      const issues = evaluateClaimReadiness({
        claim: baseClaim,
        transport: { destination_facility_type: "dialysis" },
        patient: { prior_auth_utn: "UTN12345", prior_auth_period_end: "2026-12-31" },
      });
      expect(
        billerBlocks(issues).find((b) => b.field === "prior_auth_utn"),
      ).toBeUndefined();
    });

    it("PASSES (skipped) non-Medicare dialysis transport with no auth", () => {
      const issues = evaluateClaimReadiness({
        claim: { ...baseClaim, payer_type: "commercial", payer_name: "Aetna" },
        transport: { destination_facility_type: "dialysis" },
        patient: { prior_auth_utn: null },
      });
      expect(
        billerBlocks(issues).find((b) => b.field === "prior_auth_utn"),
      ).toBeUndefined();
    });
  });
});
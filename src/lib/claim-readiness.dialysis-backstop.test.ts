import { describe, it, expect } from "vitest";
import { evaluateClaimReadiness, type ReadinessInputs } from "./claim-readiness";

const base: ReadinessInputs["claim"] = {
  id: "c1",
  patient_id: "p1",
  trip_id: "t1",
  patient_name: "Doe, Jane",
  patient_dob: "1955-04-12",
  patient_sex: "F",
  patient_address: "100 Main St",
  patient_city: "Atlanta",
  patient_state: "GA",
  patient_zip: "30301",
  member_id: "MED12345",
  payer_name: "Aetna",
  payer_id: "AETNA",
  payer_type: "commercial",
  run_date: "2026-06-01",
  hcpcs_codes: ["A0428"],
  hcpcs_modifiers: [],
  total_charge: 250,
  base_charge: 200,
  mileage_charge: 50,
  loaded_miles: 5,
  origin_zip: "30301",
  icd10_codes: ["I10"],
  pcs_on_file: false,
};

const dialysisBlocks = (issues: ReturnType<typeof evaluateClaimReadiness>) =>
  issues.filter((i) => i.stage === "biller" && /Dialysis leg didn't resolve/.test(i.message));

describe("Rule 1 backstop — dialysis must resolve to J/G", () => {
  it("BLOCKS dialysis-typed destination with no facility meta (resolves to D)", () => {
    const issues = evaluateClaimReadiness({
      claim: { ...base, origin_type: "Residence", destination_type: "Dialysis Facility" },
    });
    expect(dialysisBlocks(issues)).toHaveLength(1);
    expect(dialysisBlocks(issues)[0].field).toBe("destination_type");
  });

  it("BLOCKS dialysis-typed origin (return leg) with no facility meta", () => {
    const issues = evaluateClaimReadiness({
      claim: { ...base, origin_type: "Dialysis Facility", destination_type: "Residence" },
    });
    expect(dialysisBlocks(issues)).toHaveLength(1);
    expect(dialysisBlocks(issues)[0].field).toBe("origin_type");
  });

  it("BLOCKS when facility meta says dialysis but subtype is null", () => {
    const issues = evaluateClaimReadiness({
      claim: {
        ...base,
        origin_type: "Residence",
        destination_type: "Dialysis Facility",
        destination_facility_meta: { facility_type: "dialysis", dialysis_subtype: null },
      },
    });
    expect(dialysisBlocks(issues)).toHaveLength(1);
  });

  it("PASSES dialysis destination when facility resolves to J (freestanding)", () => {
    const issues = evaluateClaimReadiness({
      claim: {
        ...base,
        origin_type: "Residence",
        destination_type: "Dialysis Facility",
        destination_facility_meta: { facility_type: "dialysis", dialysis_subtype: "freestanding" },
      },
    });
    expect(dialysisBlocks(issues)).toHaveLength(0);
  });

  it("PASSES dialysis origin when facility resolves to G (hospital-based)", () => {
    const issues = evaluateClaimReadiness({
      claim: {
        ...base,
        origin_type: "Dialysis Facility",
        destination_type: "Residence",
        origin_facility_meta: { facility_type: "dialysis", dialysis_subtype: "hospital_based" },
      },
    });
    expect(dialysisBlocks(issues)).toHaveLength(0);
  });

  it("UNAFFECTED for non-dialysis leg (Residence → Hospital)", () => {
    const issues = evaluateClaimReadiness({
      claim: { ...base, origin_type: "Residence", destination_type: "Hospital" },
    });
    expect(dialysisBlocks(issues)).toHaveLength(0);
  });
});
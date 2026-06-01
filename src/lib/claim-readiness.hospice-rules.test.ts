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
  payer_name: "Medicare Part B",
  payer_id: "MEDI",
  payer_type: "medicare",
  run_date: "2026-06-01",
  hcpcs_codes: ["A0428"],
  hcpcs_modifiers: [],
  total_charge: 250,
  base_charge: 200,
  mileage_charge: 50,
  loaded_miles: 5,
  origin_type: "Residence",
  destination_type: "Hospital",
  origin_zip: "30301",
  icd10_codes: ["I10"],
  pcs_on_file: false,
};

const billerBlocks = (issues: ReturnType<typeof evaluateClaimReadiness>) =>
  issues.filter((i) => i.stage === "biller" && i.severity === "block");

const hospiceBlocks = (issues: ReturnType<typeof evaluateClaimReadiness>) =>
  billerBlocks(issues).filter((i) => i.field === "hospice_unrelated_to_terminal");

const z515Blocks = (issues: ReturnType<typeof evaluateClaimReadiness>) =>
  billerBlocks(issues).filter((i) => /Z51\.5/.test(i.message));

describe("Rule 3a — Hospice + Medicare", () => {
  it("BLOCKS hospice + Medicare without unrelated confirmation", () => {
    const issues = evaluateClaimReadiness({
      claim: base,
      patient: { hospice_enrolled: true },
    });
    expect(hospiceBlocks(issues)).toHaveLength(1);
  });

  it("PASSES hospice + Medicare when unrelated confirmed", () => {
    const issues = evaluateClaimReadiness({
      claim: { ...base, hospice_unrelated_to_terminal: true },
      patient: { hospice_enrolled: true },
    });
    expect(hospiceBlocks(issues)).toHaveLength(0);
  });

  it("UNAFFECTED for hospice + non-Medicare payer", () => {
    const issues = evaluateClaimReadiness({
      claim: { ...base, payer_name: "Aetna", payer_id: "AETNA", payer_type: "commercial" },
      patient: { hospice_enrolled: true },
    });
    expect(hospiceBlocks(issues)).toHaveLength(0);
  });

  it("UNAFFECTED for baseline non-hospice Medicare claim", () => {
    const issues = evaluateClaimReadiness({ claim: base });
    expect(hospiceBlocks(issues)).toHaveLength(0);
  });
});

describe("Rule 3b — Z51.5 palliative care alone", () => {
  it("BLOCKS when Z51.5 is the only diagnosis", () => {
    const issues = evaluateClaimReadiness({
      claim: { ...base, icd10_codes: ["Z51.5"] },
    });
    expect(z515Blocks(issues)).toHaveLength(1);
  });

  it("PASSES when Z51.5 is paired with a real terminal-illness dx", () => {
    const issues = evaluateClaimReadiness({
      claim: { ...base, icd10_codes: ["Z51.5", "C34.90"] },
    });
    expect(z515Blocks(issues)).toHaveLength(0);
  });

  it("UNAFFECTED for baseline (no Z51.5)", () => {
    const issues = evaluateClaimReadiness({ claim: base });
    expect(z515Blocks(issues)).toHaveLength(0);
  });
});
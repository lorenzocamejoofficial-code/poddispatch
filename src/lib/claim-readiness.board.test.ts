import { describe, expect, it, vi, afterEach } from "vitest";
import { detectClaimBlockers, buildReadinessInputs } from "./claim-blockers";
import { evaluateClaimReadiness } from "./claim-readiness";

const clean = {
  id: "synthetic-claim", patient_id: "synthetic-patient", trip_id: "synthetic-trip",
  patient_name: "Synthetic Patient", patient_dob: "1950-01-01", patient_sex: "F",
  patient_address: "100 Test St, Atlanta, GA 30301", member_id: "1EG4TE5MK73",
  payer_type: "medicare", payer_name: "Medicare", run_date: "2026-11-19",
  total_charge: 400, hcpcs_codes: ["A0428"], icd10_codes: ["R53.1"],
  origin_type: "Residence", destination_type: "Hospital", origin_zip: "30301",
};

afterEach(() => vi.useRealTimers());

describe("billing board shared hard readiness", () => {
  it.each([
    ["icd10_codes", { icd10_codes: [] }],
    ["origin_type", { origin_type: null }],
    ["destination_type", { destination_type: null }],
    ["member_id", { member_id: null }],
    ["timely_filing", { run_date: "2020-01-01" }],
  ])("treats %s as a hard block for both the card and status reconciliation", (field, changes) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-19T12:00:00Z"));
    const claim = { ...clean, ...changes };
    const blockers = detectClaimBlockers(claim);
    expect(blockers).toEqual(evaluateClaimReadiness(buildReadinessInputs(claim)).filter(i => i.severity === "block"));
    expect(blockers.some(i => i.field === field && i.severity === "block")).toBe(true);
    expect(detectClaimBlockers(clean)).toEqual([]);
  });
});
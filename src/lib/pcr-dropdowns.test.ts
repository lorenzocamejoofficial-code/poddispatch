import { describe, it, expect } from "vitest";
import { getPcsConditionalRequirements } from "./pcr-dropdowns";

// 10 digits whose 10th digit matches the CMS Luhn check digit over
// "80840" + the first 9 digits — a real, billable NPI shape.
const VALID_NPI = "1000000004";
// Same prefix with the check digit bumped by one: still exactly 10 digits,
// but the checksum no longer matches, so it must be rejected.
const LUHN_INVALID_NPI = "1000000005";

describe("getPcsConditionalRequirements", () => {
  it("adds no requirement when no PCS is on file", () => {
    expect(getPcsConditionalRequirements({ pcs_on_file: false })).toHaveLength(0);
    expect(getPcsConditionalRequirements({})).toHaveLength(0);
  });

  it("requires the PCS physician NPI when a PCS is on file", () => {
    const fields = getPcsConditionalRequirements({ pcs_on_file: true }).map(r => r.field);
    expect(fields).toContain("pcs_physician_npi");
  });

  it("reports a missing NPI as not satisfied", () => {
    const p = { pcs_on_file: true, pcs_physician_npi: "" };
    expect(getPcsConditionalRequirements(p)[0].check(p)).toBe(false);
  });

  it("reports a 10-digit but Luhn-invalid NPI as not satisfied", () => {
    const p = { pcs_on_file: true, pcs_physician_npi: LUHN_INVALID_NPI };
    expect(getPcsConditionalRequirements(p)[0].check(p)).toBe(false);
  });

  it("accepts a Luhn-valid NPI", () => {
    const p = { pcs_on_file: true, pcs_physician_npi: VALID_NPI };
    expect(getPcsConditionalRequirements(p)[0].check(p)).toBe(true);
  });

  it("accepts a Luhn-valid NPI carrying surrounding whitespace", () => {
    const p = { pcs_on_file: true, pcs_physician_npi: `  ${VALID_NPI}  ` };
    expect(getPcsConditionalRequirements(p)[0].check(p)).toBe(true);
  });
});

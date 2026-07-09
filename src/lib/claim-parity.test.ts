/**
 * Claim-parity harness — Phase 1b CI gate.
 *
 * PURPOSE: Every future PCR card migration (VitalsCard, MedicationsCard,
 * ProceduresCard, …) that adds a NEMSIS `_code` column alongside an existing
 * billing-critical display column MUST prove the 837P output is unchanged.
 *
 * This file provides the reusable helper `assertClaimEdiParity(a, b)` plus a
 * baseline sanity test. Card-migration test files import the helper and add
 * their own scenarios of the form:
 *
 *   const legacy  = fixtureClaim({ service_level: "BLS" });
 *   const migrated = fixtureClaim({ service_level: "BLS" }); // + _code column
 *   assertClaimEdiParity(legacy, migrated);
 *
 * The generator's own random control numbers and current-time stamps are
 * masked before comparison so only the payload matters.
 */

import { describe, it, expect } from "vitest";
import {
  generateEDI837P,
  type ClaimForEDI,
  type ProviderInfo,
  type SubmitterInfo,
} from "@/lib/edi-837p-generator";

/** Strip volatile bytes from an 837P payload so two runs made moments apart
 *  are byte-identical when the underlying claim data matches. */
export function normalizeEdi(edi: string): string {
  return edi
    // ISA date/time (positions 9–10) and control numbers are time/random.
    .replace(/^ISA\*.*$/m, "ISA*<masked>")
    .replace(/^GS\*.*$/m, "GS*<masked>")
    .replace(/^GE\*.*$/m, "GE*<masked>")
    .replace(/^IEA\*.*$/m, "IEA*<masked>")
    // BHT03 submitter-assigned reference is timestamp-derived in some paths.
    .replace(/^BHT\*[^~]*/gm, (s) => s.replace(/\d{8,}/g, "<n>"));
}

/** Diff two claim EDIs and fail with a readable message when they differ.
 *  Card-migration tests should call this instead of comparing strings raw. */
export function assertClaimEdiParity(
  a: ClaimForEDI,
  b: ClaimForEDI,
  providerMap: Map<string, ProviderInfo>,
  submitter: SubmitterInfo,
): void {
  const ediA = normalizeEdi(generateEDI837P([a], providerMap, submitter));
  const ediB = normalizeEdi(generateEDI837P([b], providerMap, submitter));
  expect(ediB).toBe(ediA);
}

const provider: ProviderInfo = {
  npi: "1234567893",
  tax_id: "123456789",
  organization_name: "TEST EMS LLC",
  address: "100 Main St",
  city: "Atlanta",
  state: "GA",
  zip: "30301",
  phone: "4045551212",
};

const submitter: SubmitterInfo = {
  submitter_id: "SUB123",
  submitter_name: "TEST EMS LLC",
  contact_name: "Jane Doe",
  contact_phone: "4045551212",
  usage_indicator: "T",
};

/** Minimal fixture claim. Callers override only the fields relevant to their
 *  migration scenario. Keep this stable — changes here ripple to every card
 *  parity test. */
export function fixtureClaim(overrides: Partial<ClaimForEDI> = {}): ClaimForEDI {
  return {
    claim_id: "00000000-0000-0000-0000-000000000001",
    company_id: "co-1",
    patient_name: "Doe, John",
    patient_dob: "1950-01-01",
    patient_sex: "M",
    patient_address: "200 Oak Ave",
    patient_city: "Atlanta",
    patient_state: "GA",
    patient_zip: "30301",
    member_id: "MBR123",
    payer_name: "MEDICARE B",
    payer_id: "12345",
    payer_type: "medicare",
    run_date: "2026-07-01",
    hcpcs_codes: ["A0428"],
    hcpcs_modifiers: ["RH"],
    total_charge: 500,
    base_charge: 400,
    mileage_charge: 100,
    loaded_miles: 10,
    origin_type: "residence",
    destination_type: "hospital",
    origin_address: "200 Oak Ave",
    origin_city: "Atlanta",
    origin_state: "GA",
    origin_zip: "30301",
    destination_address: "1 Hospital Way",
    destination_city: "Atlanta",
    destination_state: "GA",
    destination_zip: "30301",
    diagnosis_codes: ["R53.1"],
    auth_number: null,
    icd10_codes: ["R53.1"],
    bed_confined: true,
    requires_monitoring: false,
    stretcher_placement: null,
    oxygen_required: false,
    weight_lbs: null,
    pickup_facility_name: null,
    dropoff_facility_name: "Test Hospital",
    claim_filing_indicator: "MB",
    ...overrides,
  };
}

describe("claim-parity harness (baseline)", () => {
  const providerMap = new Map([["co-1", provider]]);

  it("is deterministic after normalization for identical inputs", () => {
    const claim = fixtureClaim();
    assertClaimEdiParity(claim, fixtureClaim(), providerMap, submitter);
  });

  it("detects a real payload difference (guard against a broken normalizer)", () => {
    const a = fixtureClaim({ total_charge: 500 });
    const b = fixtureClaim({ total_charge: 999 });
    const ediA = normalizeEdi(generateEDI837P([a], providerMap, submitter));
    const ediB = normalizeEdi(generateEDI837P([b], providerMap, submitter));
    expect(ediB).not.toBe(ediA);
  });
});
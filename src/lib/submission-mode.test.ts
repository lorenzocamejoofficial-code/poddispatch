/**
 * Live-vs-test envelope parity gate.
 *
 * Company TYPE is the only thing that decides the ISA15 usage indicator:
 *   real company (not sandbox, not creator-test) -> ISA15 = P (live)
 *   sandbox / creator-test company               -> ISA15 = T (OATEST)
 *
 * Nothing else may influence it — not per-claim `is_simulated`, not the batch
 * contents, not the global vendor `test_mode` row.
 */
import { describe, it, expect } from "vitest";
import { isTestCompanyRow } from "@/lib/submission-mode";
import { generateEDI837P, type ProviderInfo, type SubmitterInfo } from "@/lib/edi-837p-generator";
import { fixtureClaim } from "@/lib/claim-parity.test";

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

const submitter = (isTest: boolean): SubmitterInfo => ({
  submitter_id: "SUB123",
  submitter_name: "TEST EMS LLC",
  contact_name: "Jane Doe",
  contact_phone: "4045551212",
  usage_indicator: isTest ? "T" : "P",
});

const isa15 = (edi: string): string => {
  const isa = edi.split("~")[0];
  return isa.split("*")[15];
};

describe("company type decides live vs test", () => {
  it("real company is live", () => {
    expect(isTestCompanyRow({ is_sandbox: false, creator_test_tenant: false })).toBe(false);
  });

  it("sandbox company is test", () => {
    expect(isTestCompanyRow({ is_sandbox: true, creator_test_tenant: false })).toBe(true);
  });

  it("creator test tenant is test", () => {
    expect(isTestCompanyRow({ is_sandbox: false, creator_test_tenant: true })).toBe(true);
  });

  it("missing/unknown company defaults to live, never test", () => {
    expect(isTestCompanyRow(null)).toBe(false);
    expect(isTestCompanyRow({})).toBe(false);
  });
});

describe("ISA15 parity", () => {
  const providerMap = new Map([["co-1", provider]]);

  it("real company file carries ISA15=P", () => {
    const isTest = isTestCompanyRow({ is_sandbox: false, creator_test_tenant: false });
    const edi = generateEDI837P([fixtureClaim()], providerMap, submitter(isTest));
    expect(isa15(edi)).toBe("P");
  });

  it("sandbox company file carries ISA15=T", () => {
    const isTest = isTestCompanyRow({ is_sandbox: true, creator_test_tenant: false });
    const edi = generateEDI837P([fixtureClaim()], providerMap, submitter(isTest));
    expect(isa15(edi)).toBe("T");
  });
});

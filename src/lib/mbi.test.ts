import { describe, it, expect } from "vitest";
import { isValidMbi } from "@/lib/mbi";
import { missingIntakeFields } from "@/lib/intake-axis-policy";
import { evaluateClaimReadiness } from "@/lib/claim-readiness";

describe("isValidMbi (CMS 11-character format)", () => {
  it("accepts the CMS sample MBI, with or without dashes", () => {
    expect(isValidMbi("1EG4TE5MK73")).toBe(true);
    expect(isValidMbi("1EG4-TE5-MK73")).toBe(true);
    expect(isValidMbi("1eg4te5mk73")).toBe(true);
  });
  it.each(["A123456789", "0EG4TE5MK73", "1SG4TE5MK73", "1EG4TE5MK7", "1EG4TE5MK733", "1EGATE5MK73", "TEST123"])(
    "rejects %s", (v) => expect(isValidMbi(v)).toBe(false));
});

describe("Medicare MBI on intake and billing", () => {
  it("recurring Medicare patient with a malformed MBI reports member_id", () => {
    const issues = missingIntakeFields({ transport_type: "dialysis", primary_payer: "medicare", member_id: "A123456789" }, "recurring");
    expect(issues.some((i) => i.field === "member_id")).toBe(true);
  });
  it("recurring Medicare patient with blank member ID reports member_id", () => {
    const issues = missingIntakeFields({ transport_type: "wound_care", primary_payer: "medicare", member_id: "" }, "recurring");
    expect(issues.some((i) => i.field === "member_id")).toBe(true);
  });
  it("commercial patient is not held to the MBI format", () => {
    const issues = missingIntakeFields({ transport_type: "dialysis", primary_payer: "commercial", member_id: "W123456789" }, "recurring");
    expect(issues.some((i) => i.field === "member_id")).toBe(false);
  });
  const block = (claim: any) => evaluateClaimReadiness({ claim } as any).filter((i) => i.severity === "block" && i.field === "member_id");
  it("billing blocks a Medicare claim with a malformed MBI", () => {
    expect(block({ payer_type: "medicare", member_id: "A123456789" })).toHaveLength(1);
  });
  it("billing still blocks blank and UNKNOWN", () => {
    expect(block({ payer_type: "medicare", member_id: "UNKNOWN" })).toHaveLength(1);
    expect(block({ payer_type: "medicare", member_id: "" })).toHaveLength(1);
  });
  it("billing accepts a valid MBI and ignores format for Medicaid", () => {
    expect(block({ payer_type: "medicare", member_id: "1EG4TE5MK73" })).toHaveLength(0);
    expect(block({ payer_type: "medicaid", member_id: "GA12345" })).toHaveLength(0);
  });
});

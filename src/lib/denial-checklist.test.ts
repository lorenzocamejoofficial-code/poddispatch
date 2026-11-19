import { describe, it, expect } from "vitest";
import { reconcileDenialChecklist, denialFixPath } from "@/lib/denial-checklist";

const ctx = { tripId: "trip-1", patientId: "pat-1", claimId: "claim-1" };
const carcCo16 = [
  { id: "icd10", label: "Verify ICD-10", fields: ["icd10_codes"] },
  { id: "member_id", label: "Verify member ID", fields: ["member_id"] },
  { id: "origin_dest", label: "Verify O/D", fields: ["origin_type", "destination_type"] },
  { id: "appeal_prep", label: "Prepare appeal letter" },
];
const block = (field: string, message: string, fixPath?: string, fixLabel?: string) =>
  ({ field, message, severity: "block", stage: "export", fixPath, fixLabel }) as any;

describe("reconcileDenialChecklist", () => {
  it("shows no phantom field steps when the claim has no blockers", () => {
    const items = reconcileDenialChecklist(carcCo16, [], ctx);
    expect(items.map((i) => i.id)).toEqual(["appeal_prep"]);
  });
  it("lists exactly the claim's real blockers, including ones the CARC list never mentions", () => {
    const items = reconcileDenialChecklist(carcCo16, [
      block("icd10_codes", "ICD-10 code required", "/pcr?tripId=trip-1&focus=icd10", "Fix in PCR"),
      block("pcs_certification_date", "PCS certification date missing", "/billing?claimId=claim-1&focus=pcs", "Open PCS panel"),
    ], ctx);
    const blockers = items.filter((i) => i.blocker);
    expect(blockers.map((i) => i.label)).toEqual(["ICD-10 code required", "PCS certification date missing"]);
    expect(blockers[0].fixPath).toBe("/pcr?tripId=trip-1&focus=icd10");
    expect(blockers[1].fixLabel).toBe("Open PCS panel");
    expect(items.some((i) => i.id === "member_id" || i.id === "origin_dest")).toBe(false);
  });
  it("ignores warnings and de-duplicates repeated blockers", () => {
    const items = reconcileDenialChecklist([], [
      block("member_id", "Missing member ID"), block("member_id", "Missing member ID"),
      { ...block("x", "just a warning"), severity: "warn" },
    ], ctx);
    expect(items).toHaveLength(1);
  });
  it("gives every blocker a fix link, falling back by where the field lives", () => {
    const [item] = reconcileDenialChecklist([], [block("member_id", "Missing member ID")], ctx);
    expect(item.fixPath).toBe("/patients?patientId=pat-1&focus=member_id");
    expect(denialFixPath("origin_type", ctx).fixPath).toBe("/trips?tripId=trip-1&focus=origin_type");
    expect(denialFixPath("hcpcs_codes", ctx).fixPath).toBe("/billing?claimId=claim-1&focus=hcpcs_codes");
  });
});

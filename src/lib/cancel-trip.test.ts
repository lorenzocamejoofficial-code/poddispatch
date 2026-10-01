import { describe, it, expect } from "vitest";
import { nextPcrStatusOnCancel, classifyClaimsForCancel } from "./cancel-trip";

describe("nextPcrStatusOnCancel", () => {
  it("forces documentation when a PCR was started", () => {
    expect(nextPcrStatusOnCancel("in_progress")).toBe("cancelled_with_pcr");
    expect(nextPcrStatusOnCancel("submitted")).toBe("cancelled_with_pcr");
  });
  it("never downgrades documented states", () => {
    expect(nextPcrStatusOnCancel("cancelled_with_pcr")).toBe("cancelled_with_pcr");
    expect(nextPcrStatusOnCancel("cancelled_documented")).toBe("cancelled_documented");
  });
  it("leaves unstarted PCRs alone", () => {
    expect(nextPcrStatusOnCancel(null)).toBe("not_started");
    expect(nextPcrStatusOnCancel("not_started")).toBe("not_started");
  });
});

describe("classifyClaimsForCancel", () => {
  it("voids only unsent claims and flags sent ones", () => {
    const claims = ["ready_to_bill","needs_review","needs_correction","pending","blocked_payer_mapping",
      "submitted","paid","denied","forwarded","reversal","voided"].map((status, i) => ({ id: String(i), status }));
    const { toVoid, toFlag } = classifyClaimsForCancel(claims);
    expect(toVoid.map(c => c.status)).toEqual(["ready_to_bill","needs_review","needs_correction","pending","blocked_payer_mapping"]);
    expect(toFlag.map(c => c.status)).toEqual(["submitted","paid","denied","forwarded","reversal"]);
  });
  it("sends unknown statuses to review, never silent void", () => {
    expect(classifyClaimsForCancel([{ status: "mystery" }]).toFlag).toHaveLength(1);
  });
});

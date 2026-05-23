import { describe, it, expect } from "vitest";
import { classifyDenial } from "./classify-denial";

describe("classifyDenial", () => {
  // ---- Denied branch ----
  it("CO-45 on a denied claim → not recoverable, Mark closed", () => {
    const v = classifyDenial({ status: "denied", denial_code: "CO-45" });
    expect(v.recoverable).toBe("no");
    expect(v.nextActionKind).toBe("mark_closed");
    expect(v.nextAction).toBe("Mark closed");
  });

  it("CO-29 (timely filing) → not recoverable, Mark closed", () => {
    const v = classifyDenial({ status: "denied", denial_code: "CO-29" });
    // CO-29 in our table is appeal-able → recoverable yes
    expect(v.recoverable).toBe("yes");
    expect(v.nextActionKind).toBe("start_recovery");
  });

  it("CO-50 (medical necessity) → recoverable via appeal", () => {
    const v = classifyDenial({ status: "denied", denial_code: "CO-50" });
    expect(v.recoverable).toBe("yes");
    expect(v.nextActionKind).toBe("start_recovery");
  });

  it("CO-109 (wrong payer) → fix and resubmit via recovery", () => {
    // CO-109 means "wrong payer entirely" — biller has to correct the payer
    // on the claim, not bill a secondary. Recovery engine handles that.
    const v = classifyDenial({ status: "denied", denial_code: "CO-109" });
    expect(v.nextActionKind).toBe("start_recovery");
    expect(v.recoverable).toBe("yes");
  });

  it("CO-22 (covered by another payer) → bill_secondary when on file", () => {
    const v = classifyDenial({
      status: "denied",
      denial_code: "CO-22",
      has_secondary_on_file: true,
    });
    expect(v.nextActionKind).toBe("bill_secondary");
  });

  it("CO-22 + no secondary on file → check_for_secondary", () => {
    const v = classifyDenial({
      status: "denied",
      denial_code: "CO-22",
      has_secondary_on_file: false,
    });
    expect(v.nextActionKind).toBe("check_for_secondary");
  });

  it("PR-1 (deductible) on denial → bill_patient, not recoverable from payer", () => {
    const v = classifyDenial({ status: "denied", denial_code: "PR-1" });
    expect(v.recoverable).toBe("no");
    expect(v.nextActionKind).toBe("bill_patient");
  });

  it("unknown CARC on denial → maybe + Review", () => {
    const v = classifyDenial({ status: "denied", denial_code: "CO-9999" });
    expect(v.recoverable).toBe("maybe");
    expect(v.nextActionKind).toBe("review");
  });

  // ---- Partial-pay branch ----
  it("partial pay + CO-45 → not recoverable, Mark closed (contractual)", () => {
    const v = classifyDenial({
      status: "paid",
      is_partial_paid: true,
      denial_code: "CO-45",
    });
    expect(v.recoverable).toBe("no");
    expect(v.nextActionKind).toBe("mark_closed");
    expect(v.headline).toMatch(/Contractual/i);
  });

  it("partial pay + PR-2 (coinsurance) → bill_patient", () => {
    const v = classifyDenial({
      status: "paid",
      is_partial_paid: true,
      denial_code: "PR-2",
    });
    expect(v.nextActionKind).toBe("bill_patient");
  });

  it("partial pay + secondary on file (no CARC) → bill_secondary", () => {
    const v = classifyDenial({
      status: "paid",
      is_partial_paid: true,
      has_secondary_on_file: true,
      secondary_already_generated: false,
    });
    expect(v.nextActionKind).toBe("bill_secondary");
  });

  it("partial pay + secondary already generated → review (View secondary)", () => {
    const v = classifyDenial({
      status: "paid",
      is_partial_paid: true,
      has_secondary_on_file: true,
      secondary_already_generated: true,
    });
    expect(v.nextActionKind).toBe("review");
    expect(v.nextAction).toBe("View secondary");
  });

  it("partial pay + no secondary on file + no recognized CARC → maybe / review", () => {
    const v = classifyDenial({
      status: "paid",
      is_partial_paid: true,
      has_secondary_on_file: false,
    });
    expect(v.recoverable).toBe("maybe");
    expect(v.nextActionKind).toBe("review");
  });

  // ---- Submitted/aging branch ----
  it("submitted >30 days → call_payer", () => {
    const v = classifyDenial({ status: "submitted", days_outstanding: 45 });
    expect(v.nextActionKind).toBe("call_payer");
  });

  it("needs_correction → review", () => {
    const v = classifyDenial({ status: "needs_correction" });
    expect(v.nextActionKind).toBe("review");
  });

  it("submitted, fresh → none", () => {
    const v = classifyDenial({ status: "submitted", days_outstanding: 5 });
    expect(v.nextActionKind).toBe("none");
    expect(v.nextAction).toBe("");
  });

  // ---- rejection_codes fallback ----
  it("falls back to rejection_codes when denial_code unrecognized", () => {
    const v = classifyDenial({
      status: "denied",
      denial_code: "ZZZ-?",
      rejection_codes: ["CO-45"],
    });
    expect(v.carc?.code).toBe("CO-45");
    expect(v.nextActionKind).toBe("mark_closed");
  });
});
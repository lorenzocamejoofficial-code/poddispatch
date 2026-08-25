import { describe, it, expect } from "vitest";
import { evaluateUnderpayment } from "@/lib/underpayment";

describe("evaluateUnderpayment", () => {
  it("does not flag a claim paid to the allowed amount", () => {
    const r = evaluateUnderpayment({
      total_charge: 900,
      allowed_amount: 450,
      amount_paid: 450,
      patient_responsibility_amount: 0,
    });
    expect(r.isShort).toBe(false);
    expect(r.benchmarkSource).toBe("allowed");
  });

  it("does not flag when patient responsibility explains the gap", () => {
    const r = evaluateUnderpayment({
      allowed_amount: 450,
      amount_paid: 360,
      patient_responsibility_amount: 90,
    });
    expect(r.isShort).toBe(false);
    expect(r.expectedFromPayer).toBe(360);
  });

  it("flags a real shortfall against the allowed amount", () => {
    const r = evaluateUnderpayment({
      allowed_amount: 450,
      amount_paid: 300,
      patient_responsibility_amount: 0,
    });
    expect(r.isShort).toBe(true);
    expect(r.shortfall).toBe(150);
    expect(Math.round(r.shortfallPct * 100)).toBe(33);
  });

  it("ignores rounding noise under both tolerances", () => {
    const r = evaluateUnderpayment({
      allowed_amount: 450,
      amount_paid: 449.5,
    });
    expect(r.isShort).toBe(false);
  });

  it("ignores a sub-2% variance even when over a dollar", () => {
    const r = evaluateUnderpayment({ allowed_amount: 450, amount_paid: 445 });
    expect(r.shortfall).toBe(5);
    expect(r.isShort).toBe(false);
  });

  it("always flags a paid claim with $0 received", () => {
    const r = evaluateUnderpayment({ allowed_amount: 450, amount_paid: 0 });
    expect(r.isShort).toBe(true);
    expect(r.shortfallPct).toBe(1);
    expect(r.reason).toMatch(/\$0 was received/);
  });

  it("falls back to expected_revenue when no allowed amount posted", () => {
    const r = evaluateUnderpayment({
      total_charge: 900,
      expected_revenue: 400,
      amount_paid: 250,
    });
    expect(r.benchmarkSource).toBe("expected");
    expect(r.isShort).toBe(true);
    expect(r.shortfall).toBe(150);
  });

  it("never uses billed charges as a benchmark", () => {
    const r = evaluateUnderpayment({ total_charge: 900, amount_paid: 400 });
    expect(r.benchmarkSource).toBe("none");
    expect(r.isShort).toBe(false);
  });

  it("does not subtract an unverified write-off from the expected amount", () => {
    const r = evaluateUnderpayment({
      expected_revenue: 400,
      amount_paid: 250,
      write_off_amount: 150,
    });
    expect(r.isShort).toBe(true);
    expect(r.shortfall).toBe(150);
  });
});

import { describe, it, expect } from "vitest";
import { normalizePayerClass, isSelfPayClass, selectRateForPayerClass, PAYER_CLASSES } from "./payer-class";

const SELF_PAY = ["self pay", "Self Pay", "self-pay", "SELF-PAY", "selfpay", "self", "cash", "Cash",
  "cash payment", "patient", "patient pay", "private_pay", "private pay", "Private Pay", "self_pay", " self  pay "];
const COMMERCIAL = ["private_insurance", "private insurance", "insurance", "private", "commercial", "Commercial"];
const FACILITY = ["facility_contract", "facility contract", "contract", "facility"];

const RATES = [
  { payer_type: "medicare", base_rate: 293.5, mileage_rate: 9.33 },
  { payer_type: "medicaid", base_rate: 200, mileage_rate: 6 },
  { payer_type: "private", base_rate: 300, mileage_rate: 9 },
  { payer_type: "self_pay", base_rate: 275, mileage_rate: 8 },
  { payer_type: "default", base_rate: 225, mileage_rate: 7 },
];

describe("payer vocabulary hardening", () => {
  it.each(SELF_PAY)("self-pay spelling %j is self_pay, never null", (v) => {
    expect(normalizePayerClass(v)).toBe("self_pay");
    expect(isSelfPayClass(v)).toBe(true);
  });
  it.each(COMMERCIAL)("%j is commercial", (v) => expect(normalizePayerClass(v)).toBe("commercial"));
  it.each(FACILITY)("%j is facility", (v) => expect(normalizePayerClass(v)).toBe("facility"));
  it("self-pay blocks even when payer_class is blank but legacy text says self-pay", () => {
    expect(isSelfPayClass(null, "cash payment", null)).toBe(true);
    expect(isSelfPayClass(null, null, "Self Pay")).toBe(true);
    expect(isSelfPayClass("medicare", "medicare", "Medicare")).toBe(false);
  });
});

describe("rate selection by payer_class", () => {
  it("commercial prices at the commercial/private rate, not default", () => {
    const { rate, flag } = selectRateForPayerClass(RATES, "commercial");
    expect(rate?.base_rate).toBe(300);
    expect(flag).toBeNull();
  });
  it("each class picks its own row", () => {
    expect(selectRateForPayerClass(RATES, "medicare").rate?.base_rate).toBe(293.5);
    expect(selectRateForPayerClass(RATES, "medicaid").rate?.base_rate).toBe(200);
    expect(selectRateForPayerClass(RATES, "self_pay").rate?.base_rate).toBe(275);
  });
  it("missing rate row is flagged, never defaulted", () => {
    const { rate, flag } = selectRateForPayerClass(RATES, "facility");
    expect(rate).toBeNull();
    expect(flag).toBe("missing_rate");
    const noPrivate = RATES.filter((r) => r.payer_type !== "private");
    expect(selectRateForPayerClass(noPrivate, "commercial")).toEqual({ rate: null, flag: "missing_rate" });
  });
  it("no payer uses default but is flagged", () => {
    expect(selectRateForPayerClass(RATES, null)).toEqual({ rate: RATES[4], flag: "no_payer" });
  });
  it("covers all five classes", () => expect(PAYER_CLASSES.length).toBe(5));
});

import { describe, it, expect } from "vitest";
import {
  normalizeTransportKind,
  resolveTransportKind,
  isLegacyPrivatePayTransport,
  isLegacyEmergencyValue,
  TRANSPORT_KINDS,
} from "./transport-vocabulary";
import { normalizePayerClass, PAYER_CLASSES } from "./payer-class";

describe("transport vocabulary", () => {
  it("has six kinds, no emergency or private_pay", () => {
    expect(TRANSPORT_KINDS).toEqual(["dialysis", "ift", "discharge", "outpatient", "wound_care", "psych"]);
  });

  // Every value found in live data (patients, trip_records, scheduling_legs) + enum values.
  it.each([
    ["dialysis", "dialysis"], ["nemt_dialysis", "dialysis"],
    ["ift", "ift"], ["ift_general", "ift"],
    ["discharge", "discharge"], ["ift_discharge", "discharge"],
    ["outpatient", "outpatient"], ["outpatient_specialty", "outpatient"],
    ["wound_care", "wound_care"], ["woundcare", "wound_care"], ["ift_wound_care", "wound_care"],
    ["psych_transport", "psych"], [" PSYCH_TRANSPORT ", "psych"],
  ])("maps %s -> %s", (input, out) => {
    expect(normalizeTransportKind(input)).toBe(out);
  });

  it.each(["private_pay", "emergency", "complex", "adhoc", "hospital", "", null, undefined, "garbage"])(
    "returns null for non-transport value %s (never defaults to dialysis)",
    (v) => expect(normalizeTransportKind(v as any)).toBeNull(),
  );

  it("flags legacy private_pay and emergency values", () => {
    expect(isLegacyPrivatePayTransport("private_pay")).toBe(true);
    expect(isLegacyPrivatePayTransport("dialysis")).toBe(false);
    expect(isLegacyEmergencyValue("emergency")).toBe(true);
    expect(isLegacyEmergencyValue("ift")).toBe(false);
  });

  it("resolves with precedence trip_type > pcr_type > patient", () => {
    expect(resolveTransportKind({ trip_type: "discharge", pcr_type: "ift_general" })).toBe("discharge");
    expect(resolveTransportKind({ trip_type: "private_pay", pcr_type: "nemt_dialysis" })).toBe("dialysis");
    expect(resolveTransportKind({ pcr_type: "emergency", patient_transport_type: "wound_care" })).toBe("wound_care");
    expect(resolveTransportKind({ trip_type: "private_pay" })).toBeNull();
  });
});

describe("payer class", () => {
  it("has five classes with commercial and facility split", () => {
    expect(PAYER_CLASSES).toEqual(["medicare", "medicaid", "commercial", "facility", "self_pay"]);
  });

  it.each([
    ["medicare", "medicare"], ["Medicare Part B", "medicare"], ["medicaid", "medicaid"],
    ["commercial", "commercial"], ["private", "commercial"], ["insurance", "commercial"],
    ["facility", "facility"], ["self_pay", "self_pay"], ["cash", "self_pay"], ["private_pay", "self_pay"],
  ])("maps %s -> %s", (input, out) => expect(normalizePayerClass(input)).toBe(out));

  it.each(["", null, undefined, "default", "other"])("returns null for %s", (v) =>
    expect(normalizePayerClass(v as any)).toBeNull(),
  );
});

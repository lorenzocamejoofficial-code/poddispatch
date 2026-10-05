/**
 * Stage 4 (finish): ePCR required sections read transport_kind.
 * The 17 changed trips are asserted at their NEW correct section type —
 * the old "ift_general -> dialysis" result is intentionally not preserved.
 */
import { describe, it, expect } from "vitest";
import snapshot from "@/test/fixtures/classification-snapshot.json";
import { sectionRulesTransportType } from "./clinical-transport";
import { usePCRSectionRules } from "@/hooks/usePCRSectionRules";
import { resolveTransportKind } from "./transport-vocabulary";

const sectionType = (t: any) => usePCRSectionRules(sectionRulesTransportType(t)).type;
const legacyType = (t: any) => usePCRSectionRules(t.pcr_type || t.trip_type).type;

// Expected section type per (trip_type, pcr_type) on live data.
const EXPECTED: Record<string, string> = {
  "dialysis|": "dialysis",
  "dialysis|dialysis": "dialysis",
  "dialysis|nemt_dialysis": "dialysis",
  "wound_care|ift_wound_care": "wound_care",
  "ift|ift_general": "ift",                          // was dialysis
  "outpatient|ift_general": "outpatient_specialty",  // was dialysis
  "psych_transport|ift_general": "psych_transport",  // was dialysis
  "discharge|ift_discharge": "discharge",            // was ift
};

describe("required sections — every live trip", () => {
  const trips = snapshot.trips as any[];
  it.each(trips.map((t) => [t.id, t] as const))("trip %s gets its expected sections", (_id, t) => {
    const key = `${t.trip_type}|${t.pcr_type ?? ""}`;
    expect(EXPECTED[key], `no expectation for ${key}`).toBeDefined();
    expect(sectionType(t)).toBe(EXPECTED[key]);
  });
  it("no non-dialysis trip gets dialysis sections", () => {
    for (const t of trips) if (t.transport_kind !== "dialysis") expect(sectionType(t)).not.toBe("dialysis");
  });
  it("exactly 17 trips change vs the old reader", () => {
    expect(trips.filter((t) => sectionType(t) !== legacyType(t)).length).toBe(17);
  });
});

describe("emergency upgrade forces emergency sections", () => {
  it.each(["dialysis", "ift", "discharge", "outpatient", "wound_care", "psych_transport", null])(
    "upgraded %s trip -> emergency", (tt) => {
      const t = { trip_type: tt, pcr_type: "emergency", is_emergency_pcr: true, transport_kind: resolveTransportKind({ trip_type: tt }) };
      expect(sectionType(t)).toBe("emergency");
      const r = usePCRSectionRules(sectionRulesTransportType(t));
      for (const s of ["airway", "procedures", "medications", "iv_access"] as const) expect(r.getRule(s).state).toBe("required");
    });
  it("flag alone or pcr_type alone still forces emergency", () => {
    expect(sectionType({ trip_type: "dialysis", transport_kind: "dialysis", is_emergency_pcr: true, pcr_type: "nemt_dialysis" })).toBe("emergency");
    expect(sectionType({ trip_type: "ift", transport_kind: "ift", pcr_type: "complex" })).toBe("emergency");
  });
});

describe("non-canonical trip types stay on the legacy fallback", () => {
  const TRIP_TYPES = [null, "", "hospital", "private_pay"];
  const PCR_TYPES = [null, "", "dialysis", "nemt_dialysis", "ift_general", "ift_discharge", "ift_wound_care", "outpatient_specialty", "private_pay"];
  const PATIENT = [null, "dialysis", "ift", "wound_care"];
  for (const tt of TRIP_TYPES) for (const pt of PCR_TYPES) for (const pa of PATIENT) {
    const t = { trip_type: tt, pcr_type: pt, transport_kind: resolveTransportKind({ trip_type: tt, pcr_type: pt, patient_transport_type: pa }) };
    it(`${tt}|${pt}|${pa}: unchanged`, () => expect(sectionType(t)).toBe(legacyType(t)));
  }
});

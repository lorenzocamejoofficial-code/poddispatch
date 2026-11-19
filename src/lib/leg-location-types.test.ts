import { describe, it, expect } from "vitest";
import { deriveRecurringLegTypes, resolveTripLocationType } from "@/lib/leg-location-types";

const fac = new Map([["Sunrise Dialysis", "dialysis"], ["Grady Memorial", "hospital"], ["Oak SNF", "snf"]]);
const legs = (transportType: string, dropoffFacility: string, patientLocationType: string | null = null) =>
  deriveRecurringLegTypes({ transportType, patientLocationType, pickupAddress: "12 Elm St, Atlanta, GA 30301", dropoffFacility, facilityTypeMap: fac });

describe("deriveRecurringLegTypes", () => {
  it("dialysis run to a registered dialysis facility gets a dialysis destination and swaps on the B-leg", () => {
    const r = legs("dialysis", "Sunrise Dialysis", "Residence");
    expect(r).toEqual({ aOrigin: "Residence", aDestination: "Dialysis Center", bOrigin: "Dialysis Center", bDestination: "Residence" });
  });
  it("dialysis run to an unmatched site still resolves to a dialysis facility", () => {
    expect(legs("dialysis", "Unknown Clinic").aDestination).toBe("Dialysis Facility");
  });
  it("IFT to a hospital resolves to hospital, never dialysis", () => {
    expect(legs("ift", "Grady Memorial").aDestination).toBe("Hospital Inpatient");
  });
  it.each(["wound_care", "outpatient", "ift"])("%s to an unmatched site is left blank, never Dialysis Facility", (t) => {
    const r = legs(t, "Peachtree Wound Center");
    expect(r.aDestination).toBeNull();
    expect(r.bOrigin).toBeNull();
  });
  it("non-dialysis run whose name merely contains 'dialysis' is left blank", () => {
    expect(legs("wound_care", "Old Dialysis Building Clinic").aDestination).toBeNull();
  });
  it("a street address destination is never typed as Home for the facility end", () => {
    expect(legs("outpatient", "500 Peachtree St").aDestination).toBeNull();
  });
  it("origin falls back to the pickup address when the chart has no location type", () => {
    expect(legs("dialysis", "Sunrise Dialysis").aOrigin).toBe("Home");
  });
});

describe("resolveTripLocationType", () => {
  it("drops the legacy hard-coded Dialysis Facility on a non-dialysis trip", () => {
    expect(resolveTripLocationType("Dialysis Facility", "Peachtree Wound Center", "wound_care", fac)).toBeNull();
    expect(resolveTripLocationType("Dialysis Facility", "Grady Memorial", "ift", fac)).toBe("Hospital Inpatient");
  });
  it("keeps a stored value on a dialysis trip and any non-dialysis stored value", () => {
    expect(resolveTripLocationType("Dialysis Facility", "x", "dialysis", fac)).toBe("Dialysis Facility");
    expect(resolveTripLocationType("Physician/Doctor Office", "x", "outpatient", fac)).toBe("Physician/Doctor Office");
  });
  it("keeps dialysis for a non-dialysis trip that really ends at a registered dialysis facility", () => {
    expect(resolveTripLocationType("Dialysis Facility", "Sunrise Dialysis", "ift", fac)).toBe("Dialysis Facility");
  });
});

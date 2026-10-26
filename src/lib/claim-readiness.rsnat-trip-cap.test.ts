import { describe, it, expect } from "vitest";
import { evaluateRsnatTripCap } from "@/lib/claim-readiness";

describe("evaluateRsnatTripCap", () => {
  it("is ok with more than four trips remaining", () => {
    expect(evaluateRsnatTripCap({ authorizedRoundTrips: 40, usedRoundTrips: 35 }))
      .toMatchObject({ status: "ok", authorized: 40, used: 35, remaining: 5 });
  });
  it("warns at exactly four trips remaining", () => {
    expect(evaluateRsnatTripCap({ authorizedRoundTrips: 40, usedRoundTrips: 36 }))
      .toMatchObject({ status: "approaching", remaining: 4 });
  });
  it("blocks at the authorized cap", () => {
    expect(evaluateRsnatTripCap({ authorizedRoundTrips: 40, usedRoundTrips: 40 }))
      .toMatchObject({ status: "exceeded", remaining: 0 });
  });
  it("defaults null authorization to 40", () => {
    expect(evaluateRsnatTripCap({ authorizedRoundTrips: null, usedRoundTrips: 39 }))
      .toMatchObject({ status: "approaching", authorized: 40, remaining: 1 });
  });
  it("honors a MAC authorization for only 20 round trips", () => {
    expect(evaluateRsnatTripCap({ authorizedRoundTrips: 20, usedRoundTrips: 20 }))
      .toMatchObject({ status: "exceeded", authorized: 20, remaining: 0 });
  });
  it("keeps negative remaining above the cap", () => {
    expect(evaluateRsnatTripCap({ usedRoundTrips: 41 }))
      .toMatchObject({ status: "exceeded", remaining: -1 });
  });
});
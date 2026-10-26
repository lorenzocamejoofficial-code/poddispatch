import { describe, it, expect } from "vitest";
import { trialExpiredView } from "./trial-expired-view";

describe("trialExpiredView", () => {
  it("owners and creators get the payment option", () => {
    expect(trialExpiredView({ isOwnerOrCreator: true })).toBe("pay");
    expect(trialExpiredView({ isOwnerOrCreator: false, isSystemCreator: true })).toBe("pay");
  });
  it("managers, dispatchers, billers and crew are told to contact the owner", () => {
    expect(trialExpiredView({ isOwnerOrCreator: false })).toBe("contact_owner");
  });
});

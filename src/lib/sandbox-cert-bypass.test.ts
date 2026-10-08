import { describe, it, expect } from "vitest";
import { isSandboxCertBypass } from "./sandbox-cert-bypass";

describe("sandbox cert bypass", () => {
  it("never bypasses in a real company, even with 'test' in the email", () => {
    expect(isSandboxCertBypass(false, "test.medic@test.com")).toBe(false);
  });
  it("blocks a non-test email inside a sim company", () => {
    expect(isSandboxCertBypass(true, "jane@acme.com")).toBe(false);
    expect(isSandboxCertBypass(true, null)).toBe(false);
  });
  it("bypasses a test email inside a sim company (case-insensitive)", () => {
    expect(isSandboxCertBypass(true, "Crew.TEST1@acme.com")).toBe(true);
  });
});

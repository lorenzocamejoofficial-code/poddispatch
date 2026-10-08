import { describe, it, expect } from "vitest";
import { isSandboxCertBypass } from "./sandbox-cert-bypass";

describe("sandbox cert bypass", () => {
  it("never bypasses in a real company, whatever the employee's email", () => {
    expect(isSandboxCertBypass(false)).toBe(false);
  });
  it("bypasses an uncertified employee in a sandbox company", () => {
    expect(isSandboxCertBypass(true)).toBe(true);
  });
});

/**
 * SANDBOX-ONLY crew-cert bypass. Mirrors public.sandbox_cert_bypass (SQL),
 * which is the real enforcement inside the crews cert-gate trigger.
 * Bypasses whenever the company is a sim/test tenant (creator_test_tenant or
 * is_sandbox). In a real company this always returns false.
 */
export function isSandboxCertBypass(isSimCompany: boolean): boolean {
  return isSimCompany;
}

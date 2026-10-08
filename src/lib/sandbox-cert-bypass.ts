/**
 * SANDBOX-ONLY crew-cert bypass. Mirrors public.sandbox_cert_bypass (SQL),
 * which is the real enforcement inside the crews cert-gate trigger.
 * Both must hold: the company is a sim/test tenant (creator_test_tenant or
 * is_sandbox) AND the employee email contains "test" (case-insensitive).
 * In a real company this always returns false, whatever the email.
 */
export function isSandboxCertBypass(isSimCompany: boolean, email: string | null | undefined): boolean {
  if (!isSimCompany) return false;
  return (email ?? "").toLowerCase().includes("test");
}

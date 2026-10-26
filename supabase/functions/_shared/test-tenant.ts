// A company may be physically purged only when it is flagged as a test or
// sandbox tenant. Real companies are archive-only. The SQL function
// public.purge_test_company enforces the same rule independently.
export function isPurgeableTestTenant(
  c: { is_sandbox?: boolean | null; creator_test_tenant?: boolean | null } | null | undefined,
): boolean {
  return !!c && (c.is_sandbox === true || c.creator_test_tenant === true);
}

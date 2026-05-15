import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the IDs of "real" customer companies — excludes:
 *   - creator_test_tenant (Lorenzo Test, etc.)
 *   - is_sandbox (LOADTEST + simulation sandboxes)
 *   - deleted_at IS NOT NULL (soft-archived)
 *
 * MUST be used by every creator-side aggregate query so test/sandbox/archived
 * tenants never bleed into platform metrics, health dashboards, billing
 * reconciliation, support views, etc.
 */
export async function fetchRealCompanyIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("id")
    .eq("creator_test_tenant", false)
    .eq("is_sandbox", false)
    .is("deleted_at", null);
  if (error) {
    console.error("fetchRealCompanyIds failed:", error);
    return [];
  }
  return (data ?? []).map((c) => c.id);
}
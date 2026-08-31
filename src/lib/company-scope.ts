import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves the caller's ACTIVE tenant id (honors company switching and
 * creator simulation, since get_my_company_id() prefers active_company_id).
 *
 * Why this exists: system creators have cross-tenant SELECT policies on a few
 * operational tables (e.g. `trucks`) so platform-wide counts work. Any
 * tenant-facing screen must therefore scope its own queries by company_id —
 * relying on RLS alone leaks other tenants' rows into the creator's view.
 */
let cached: { id: string | null; at: number } | null = null;
const TTL_MS = 30_000;

export async function getActiveCompanyId(): Promise<string | null> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.id;
  const { data } = await supabase.rpc("get_my_company_id");
  cached = { id: (data as string | null) ?? null, at: Date.now() };
  return cached.id;
}

export function clearActiveCompanyIdCache() {
  cached = null;
}

/** Sentinel used when no tenant resolves — guarantees zero rows instead of all rows. */
export const NO_COMPANY = "00000000-0000-0000-0000-000000000000";

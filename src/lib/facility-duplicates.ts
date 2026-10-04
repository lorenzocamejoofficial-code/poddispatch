import { supabase } from "@/integrations/supabase/client";

/**
 * Returns true when a facility with the same name (trimmed, case-insensitive)
 * already exists in the given company. Dropoff matching is by facility name,
 * so duplicates silently break patient/facility linkage — every interactive
 * create path must check this before inserting.
 *
 * Compares in JS rather than SQL ilike so names containing % or _ cannot
 * over-match. `excludeId` lets an edit rename check ignore the row itself.
 */
export async function facilityNameExists(
  companyId: string | null | undefined,
  name: string,
  excludeId?: string,
): Promise<boolean> {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed || !companyId) return false;
  const { data, error } = await supabase
    .from("facilities" as any)
    .select("id, name")
    .eq("company_id", companyId);
  if (error) {
    // Fail open on read errors — the insert error path still protects the user.
    console.error("[facilities] duplicate-name check failed:", error.message);
    return false;
  }
  return ((data ?? []) as any[]).some(
    (f) => f.id !== excludeId && String(f.name).trim().toLowerCase() === trimmed,
  );
}

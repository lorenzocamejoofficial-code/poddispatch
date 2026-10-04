import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the display name of an existing facility in the given company whose
 * name matches (trimmed, case-insensitive), or null when none exists. The
 * address is irrelevant: dispatchers pick dropoffs by name in the dropdown,
 * so an exact-name duplicate can send a run to the wrong address and is
 * always blocked.
 *
 * Compares in JS rather than SQL ilike so names containing % or _ cannot
 * over-match. `excludeId` lets an edit rename check ignore the row itself.
 * Fails open (null) on read errors so a transient failure can't block saves.
 */
export async function findFacilityNameDuplicate(
  companyId: string | null | undefined,
  name: string,
  excludeId?: string,
): Promise<string | null> {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed || !companyId) return null;
  const { data, error } = await supabase
    .from("facilities" as any)
    .select("id, name")
    .eq("company_id", companyId);
  if (error) {
    // Fail open on read errors — the insert error path still protects the user.
    console.error("[facilities] duplicate-name check failed:", error.message);
    return null;
  }
  const match = ((data ?? []) as any[]).find(
    (f) => f.id !== excludeId && String(f.name).trim().toLowerCase() === trimmed,
  );
  return match ? String(match.name) : null;
}

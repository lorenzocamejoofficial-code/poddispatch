import { supabase } from "@/integrations/supabase/client";

export interface FacilityDuplicate {
  /** Display name of the existing facility that matched. */
  name: string;
  /** True only when both addresses are non-empty and match (trimmed, case-insensitive). */
  sameAddress: boolean;
}

/**
 * Finds an existing facility in the given company with the same name
 * (trimmed, case-insensitive), and reports whether it also shares the
 * given address. Patients link to facilities by facility_id (a real FK),
 * so a duplicate name is a warning, not a block — two genuinely different
 * facilities can share a name.
 *
 * Compares in JS rather than SQL ilike so names containing % or _ cannot
 * over-match. `excludeId` lets an edit rename check ignore the row itself.
 * Fails open (null) on read errors so a transient failure can't block saves.
 */
export async function findFacilityDuplicate(
  companyId: string | null | undefined,
  name: string,
  address?: string | null,
  excludeId?: string,
): Promise<FacilityDuplicate | null> {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed || !companyId) return null;
  const { data, error } = await supabase
    .from("facilities" as any)
    .select("id, name, address")
    .eq("company_id", companyId);
  if (error) {
    // Fail open on read errors — the insert error path still protects the user.
    console.error("[facilities] duplicate-name check failed:", error.message);
    return null;
  }
  const match = ((data ?? []) as any[]).find(
    (f) => f.id !== excludeId && String(f.name).trim().toLowerCase() === trimmed,
  );
  if (!match) return null;
  const newAddr = (address ?? "").trim().toLowerCase();
  const existingAddr = String(match.address ?? "").trim().toLowerCase();
  return {
    name: String(match.name),
    sameAddress: !!newAddr && !!existingAddr && newAddr === existingAddr,
  };
}

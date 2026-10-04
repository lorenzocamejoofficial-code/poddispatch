import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the matching patient's display name when a patient with the same
 * first+last name AND same date of birth already exists in the company,
 * otherwise null.
 *
 * This is a WARN-only check, never a block: two real people can share a name
 * and birthday, so callers must surface a warning and still allow the save.
 *
 * Compares in JS rather than SQL ilike so names containing % or _ cannot
 * over-match. `excludeId` lets an edit check ignore the row itself.
 * Fails open on read errors — a transient read failure must not block saves.
 */
export async function findPatientDuplicate(
  companyId: string | null | undefined,
  firstName: string,
  lastName: string,
  dob: string | null | undefined,
  excludeId?: string,
): Promise<string | null> {
  const normFirst = firstName.trim().toLowerCase();
  const normLast = lastName.trim().toLowerCase();
  if (!companyId || !normFirst || !normLast || !dob) return null;

  const { data, error } = await supabase
    .from("patients")
    .select("id, first_name, last_name, dob")
    .eq("company_id", companyId)
    .eq("dob", dob);
  if (error) {
    console.error("[patients] duplicate check failed:", error.message);
    return null;
  }
  for (const p of (data ?? []) as any[]) {
    if (p.id === excludeId) continue;
    if (
      String(p.first_name ?? "").trim().toLowerCase() === normFirst &&
      String(p.last_name ?? "").trim().toLowerCase() === normLast
    ) {
      return `${p.first_name} ${p.last_name}`;
    }
  }
  return null;
}

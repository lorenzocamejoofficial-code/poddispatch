import { supabase } from "@/integrations/supabase/client";

export interface TruckDuplicate {
  /** Existing truck name that collided (trimmed, case-insensitive match). */
  nameConflict?: string;
  /** Existing vehicle_id / unit number that collided. */
  unitConflict?: string;
}

/**
 * Checks whether another truck in the same company already uses the given
 * name or unit number (both trimmed, case-insensitive). Truck names and unit
 * numbers are how dispatchers identify vehicles on the board, so duplicates
 * are blocked outright — unlike patients, two trucks are never legitimately
 * the "same" vehicle.
 *
 * Compares in JS rather than SQL ilike so values containing % or _ cannot
 * over-match. `excludeId` lets an edit check ignore the row itself.
 * Fails open on read errors — the insert error path still protects the user.
 */
export async function findTruckDuplicate(
  companyId: string | null | undefined,
  name: string,
  vehicleId: string,
  excludeId?: string,
): Promise<TruckDuplicate> {
  const result: TruckDuplicate = {};
  const normName = name.trim().toLowerCase();
  const normUnit = vehicleId.trim().toLowerCase();
  if (!companyId || (!normName && !normUnit)) return result;

  const { data, error } = await supabase
    .from("trucks")
    .select("id, name, vehicle_id")
    .eq("company_id", companyId);
  if (error) {
    console.error("[trucks] duplicate check failed:", error.message);
    return result;
  }
  for (const t of (data ?? []) as any[]) {
    if (t.id === excludeId) continue;
    if (normName && String(t.name ?? "").trim().toLowerCase() === normName) {
      result.nameConflict = t.name;
    }
    const existingUnit = String(t.vehicle_id ?? "").trim().toLowerCase();
    if (normUnit && existingUnit && existingUnit === normUnit) {
      result.unitConflict = t.vehicle_id;
    }
  }
  return result;
}

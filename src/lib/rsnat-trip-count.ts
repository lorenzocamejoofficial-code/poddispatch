import { supabase } from "@/integrations/supabase/client";
import { getActiveCompanyId, NO_COMPANY } from "@/lib/company-scope";

/** Exact counts avoid the Data API row limit; dates include both endpoints. */
async function countTrips(
  patientId: string,
  periodStart: string,
  periodEnd: string,
  linkedOnly: boolean,
): Promise<number> {
  const companyId = (await getActiveCompanyId()) ?? NO_COMPANY;
  let query = supabase.from("trip_records")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("patient_id", patientId)
    .gte("run_date", periodStart)
    .lte("run_date", periodEnd);
  if (linkedOnly) query = query.not("leg_id", "is", null);
  const { count, error } = await query;
  if (error) throw error;
  if (count == null) throw new Error("RSNAT trip count unavailable");
  return count;
}

/** Preserve the backstop's one-way threshold, including unlinked trips. */
export async function countRsnatOneWayTrips(
  patientId: string, periodStart: string, periodEnd: string,
): Promise<number> {
  return countTrips(patientId, periodStart, periodEnd, false);
}

/** Historical approximation, not A/B pairing: floor(linked trips / 2).
 * Includes the current record and all statuses, exactly like the backstop.
 */
export async function countRsnatRoundTrips(
  patientId: string, periodStart: string, periodEnd: string,
): Promise<number> {
  return Math.floor(await countTrips(patientId, periodStart, periodEnd, true) / 2);
}
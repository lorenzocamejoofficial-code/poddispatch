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

/** Historical approximation, not A/B pairing: floor(linked trips / 2).
 * Includes the current record and all statuses, exactly like the backstop.
 */
export async function countRsnatRoundTrips(
  patientId: string, periodStart: string, periodEnd: string,
): Promise<number> {
  return Math.floor(await countTrips(patientId, periodStart, periodEnd, true) / 2);
}

/** Distinct run_date values (YYYY-MM-DD, sorted) for the patient in the
 * inclusive window, scoped to the active company. Deduped in JS.
 */
export async function getRsnatServiceDates(
  patientId: string, periodStart: string, periodEnd: string,
): Promise<string[]> {
  const companyId = (await getActiveCompanyId()) ?? NO_COMPANY;
  const { data, error } = await supabase.from("trip_records")
    .select("run_date")
    .eq("company_id", companyId)
    .eq("patient_id", patientId)
    .gte("run_date", periodStart)
    .lte("run_date", periodEnd);
  if (error) throw error;
  const dates = new Set<string>();
  for (const r of (data ?? []) as { run_date: string | null }[]) {
    if (r.run_date) dates.add(String(r.run_date).slice(0, 10));
  }
  return [...dates].sort();
}

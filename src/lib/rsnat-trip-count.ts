import { supabase } from "@/integrations/supabase/client";
import { getActiveCompanyId, NO_COMPANY } from "@/lib/company-scope";

/** Trip statuses that were never furnished, so they never consume the authorization. */
export const NOT_FURNISHED = ["cancelled", "no_show"] as const;

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
  // CMS: the MAC affirms up to 40 round trips (80 one-way transports) per 60-day
  // period, and only furnished/billed transports consume it — never-run trips don't.
  if (linkedOnly) query = query.not("leg_id", "is", null).not("status", "in", `(${NOT_FURNISHED.join(",")})`);
  const { count, error } = await query;
  if (error) throw error;
  if (count == null) throw new Error("RSNAT trip count unavailable");
  return count;
}

/** Historical approximation, not A/B pairing: floor(linked trips / 2).
 * Includes the current record; excludes cancelled and no-show trips.
 */
export async function countRsnatRoundTrips(
  patientId: string, periodStart: string, periodEnd: string,
  /** Optional YYYY-MM-DD: ignore trips dated after it (pre-submit uses the trip's own date). */
  asOf?: string | null,
): Promise<number> {
  const end = asOf && asOf < periodEnd ? asOf : periodEnd;
  if (end < periodStart) return 0;
  return Math.floor(await countTrips(patientId, periodStart, end, true) / 2);
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

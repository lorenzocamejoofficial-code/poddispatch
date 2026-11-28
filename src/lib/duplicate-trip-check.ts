import { supabase } from "@/integrations/supabase/client";
import { getActiveCompanyId, NO_COMPANY } from "./company-scope";
import { patientTripWindow, windowsOverlap, formatWindowMinute, recordedWindowMinute } from "./patient-trip-window";

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingTrips: { id: string; pickup_time: string | null; end_time?: string; status: string }[];
}
export interface TripOverlapOptions {
  endTime?: string | null; durationMinutes?: number | null;
  excludeId?: string; excludeLegId?: string;
}
/** Patient coherence, not a truck gap: only overlapping occupied transport windows block. */
export async function checkDuplicateTrip(patientId: string, runDate: string, pickupTime: string | null, options: TripOverlapOptions = {}): Promise<DuplicateCheckResult> {
  const companyId = (await getActiveCompanyId()) ?? NO_COMPANY;
  const date = new Date(`${runDate}T12:00:00Z`);
  const dates = [-1, 0, 1].map(n => { const d = new Date(date); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); });
  const [trips, legs, patient, settings] = await Promise.all([
    supabase.from("trip_records").select("id, leg_id, run_date, scheduled_pickup_time, scheduled_dropoff_time, at_scene_time, dropped_at, status")
      .eq("company_id", companyId).eq("patient_id", patientId).in("run_date", dates),
    supabase.from("scheduling_legs").select("id, run_date, pickup_time, estimated_duration_minutes")
      .eq("company_id", companyId).eq("patient_id", patientId).in("run_date", dates),
    supabase.from("patients").select("run_duration_minutes").eq("company_id", companyId).eq("id", patientId).maybeSingle(),
    supabase.from("company_settings").select("load_time_minutes, unload_time_minutes").eq("company_id", companyId).maybeSingle(),
  ]);
  if (trips.error || legs.error || patient.error || settings.error) throw new Error("Could not check patient trip overlaps. Try again before saving.");
  const load = settings.data?.load_time_minutes ?? 10, unload = settings.data?.unload_time_minutes ?? 10;
  const duration = options.durationMinutes ?? patient.data?.run_duration_minutes ?? 30;
  const target = patientTripWindow(pickupTime, options.endTime ?? null, duration, load, unload);
  if (!target) return { isDuplicate: false, existingTrips: [] }; // Unknown windows cannot establish an overlap.
  const legIds = (legs.data ?? []).map(l => l.id);
  const [exceptions, slots] = legIds.length ? await Promise.all([
    supabase.from("leg_exceptions").select("scheduling_leg_id, run_date, pickup_time, leg:scheduling_legs!inner(company_id)").eq("leg.company_id", companyId).in("scheduling_leg_id", legIds).in("run_date", dates),
    supabase.from("truck_run_slots").select("leg_id, run_date, status").eq("company_id", companyId).in("leg_id", legIds).in("run_date", dates),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  if (exceptions.error || slots.error) throw new Error("Could not check patient trip overlaps. Try again before saving.");
  const ignored = new Set(["cancelled", "pending_cancellation", "no_show"]);
  const existingTrips: DuplicateCheckResult["existingTrips"] = [];
  function check(id: string, date: string, pickup: string | null, end: string | null, minutes: number, status: string, recordedStart?: string | null, recordedEnd?: string | null) {
    const planned = patientTripWindow(pickup, end, minutes, load, unload);
    const start = recordedWindowMinute(recordedStart, date) ?? planned?.start;
    if (start == null) return;
    const finish = recordedWindowMinute(recordedEnd, date) ?? (end ? planned?.end : start + load + minutes + unload);
    if (finish == null) return;
    const w = { start, end: finish };
    const offset = dates.indexOf(date) * 1440 - 1440;
    if (windowsOverlap(target, { start: w.start + offset, end: w.end + offset })) existingTrips.push({ id, pickup_time: formatWindowMinute(w.start), end_time: formatWindowMinute(w.end), status });
  }
  for (const t of trips.data ?? []) {
    if (t.id === options.excludeId || t.leg_id === options.excludeLegId || ignored.has(t.status)) continue;
    const linked = (legs.data ?? []).find(l => l.id === t.leg_id);
    const ex = (exceptions.data ?? []).find(e => e.scheduling_leg_id === t.leg_id && e.run_date === t.run_date);
    check(t.id, t.run_date, ex?.pickup_time ?? t.scheduled_pickup_time, t.scheduled_dropoff_time, linked?.estimated_duration_minutes ?? patient.data?.run_duration_minutes ?? 30, t.status, t.at_scene_time, t.dropped_at);
  }
  for (const l of legs.data ?? []) {
    if (l.id === options.excludeLegId || (trips.data ?? []).some(t => t.leg_id === l.id && t.run_date === l.run_date)) continue;
    if ((slots.data ?? []).some(s => s.leg_id === l.id && s.run_date === l.run_date && ignored.has(s.status))) continue;
    const ex = (exceptions.data ?? []).find(e => e.scheduling_leg_id === l.id && e.run_date === l.run_date);
    check(l.id, l.run_date ?? runDate, ex?.pickup_time ?? l.pickup_time, null, l.estimated_duration_minutes ?? patient.data?.run_duration_minutes ?? 30, "scheduled");
  }
  return { isDuplicate: existingTrips.length > 0, existingTrips };
}
export function patientOverlapMessage(patient: string, result: DuplicateCheckResult): string {
  const trip = result.existingTrips[0];
  return trip ? `${patient} already has a trip from ${trip.pickup_time?.slice(0, 5) ?? "unknown"}–${trip.end_time ?? "unknown"} that overlaps this one.` : "";
}

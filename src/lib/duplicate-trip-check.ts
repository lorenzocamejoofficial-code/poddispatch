import { supabase } from "@/integrations/supabase/client";

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingTrips: { id: string; pickup_time: string | null; status: string }[];
}

/**
 * Check if a trip already exists for the same patient on the same date
 * with a pickup time within 30 minutes of the given time.
 */
export async function checkDuplicateTrip(
  patientId: string,
  runDate: string,
  pickupTime: string | null,
): Promise<DuplicateCheckResult> {
  const { data: existing } = await supabase
    .from("trip_records")
    .select("id, scheduled_pickup_time, status")
    .eq("patient_id", patientId)
    .eq("run_date", runDate)
    .not("status", "eq", "cancelled");

  if (!existing?.length) return { isDuplicate: false, existingTrips: [] };

  if (!pickupTime) {
    // Same patient, same date, any time
    return {
      isDuplicate: true,
      existingTrips: existing.map((t: any) => ({
        id: t.id,
        pickup_time: t.scheduled_pickup_time,
        status: t.status,
      })),
    };
  }

  // Parse pickup time and check within 30 minutes
  const toMinutes = (t: string) => {
    const parts = t.split(":");
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  };
  const targetMin = toMinutes(pickupTime);

  const nearby = existing.filter((t: any) => {
    if (!t.scheduled_pickup_time) return true; // no time = potential dup
    const existingMin = toMinutes(t.scheduled_pickup_time);
    return Math.abs(targetMin - existingMin) <= 30;
  });

  return {
    isDuplicate: nearby.length > 0,
    existingTrips: nearby.map((t: any) => ({
      id: t.id,
      pickup_time: t.scheduled_pickup_time,
      status: t.status,
    })),
  };
}

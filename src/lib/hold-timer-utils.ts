import { supabase } from "@/integrations/supabase/client";

/**
 * After a hold timer is resolved, calculate elapsed minutes and
 * accumulate them into the corresponding trip_record's wait_time_minutes.
 * Fire-and-forget — never throws.
 */
export async function accumulateWaitMinutes(timerId: string): Promise<void> {
  try {
    // Fetch the resolved timer to get started_at, resolved_at, trip_id
    const { data: timer } = await supabase
      .from("hold_timers")
      .select("trip_id, started_at, resolved_at")
      .eq("id", timerId)
      .maybeSingle();

    if (!timer?.trip_id || !timer.started_at || !timer.resolved_at) return;

    const elapsedMs = new Date(timer.resolved_at).getTime() - new Date(timer.started_at).getTime();
    const elapsedMinutes = Math.max(0, Math.round(elapsedMs / 60000));
    if (elapsedMinutes === 0) return;

    // Read current wait_time_minutes so we can accumulate
    const { data: trip } = await supabase
      .from("trip_records")
      .select("wait_time_minutes")
      .eq("id", timer.trip_id)
      .maybeSingle();

    const currentMinutes = Number(trip?.wait_time_minutes ?? 0);

    await supabase
      .from("trip_records")
      .update({ wait_time_minutes: currentMinutes + elapsedMinutes } as any)
      .eq("id", timer.trip_id);
  } catch (e) {
    console.error("Failed to accumulate wait minutes:", e);
  }
}

/**
 * Batch version: accumulate wait minutes for multiple resolved timers.
 */
export async function accumulateWaitMinutesBatch(timerIds: string[]): Promise<void> {
  for (const id of timerIds) {
    await accumulateWaitMinutes(id);
  }
}

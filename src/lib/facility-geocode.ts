// Facility-only coordinate lookup (lazy, never blocking).
// HIPAA: this module accepts FACILITY IDs only. There is deliberately no
// "geocode any address" entry point — patient/residential addresses must
// never be sent to Census or any non-BAA third party (see AGENTS.md).
import { supabase } from "@/integrations/supabase/client";

export type LatLng = { lat: number; lng: number };
type Invoker = (facilityIds: string[]) => Promise<Record<string, LatLng | null>>;

const defaultInvoker: Invoker = async (facility_ids) => {
  const { data, error } = await supabase.functions.invoke("geocode-facilities", { body: { facility_ids } });
  if (error) throw error;
  return (data?.results ?? {}) as Record<string, LatLng | null>;
};

let invoker: Invoker = defaultInvoker;
const known = new Map<string, LatLng | null>();
const inflight = new Set<string>();
const pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
const BATCH = 50;

/** Fetch coordinates for facilities (chunks of 50). Never throws. */
export async function primeFacilityCoords(facilityIds: string[]): Promise<void> {
  const ids = [...new Set(facilityIds.filter((id) => id && !known.has(id) && !inflight.has(id)))];
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    chunk.forEach((id) => inflight.add(id));
    try {
      const res = await invoker(chunk);
      for (const id of chunk) known.set(id, res[id] ?? null);
    } catch {
      console.warn("Facility geocode unavailable; using time-only feasibility");
    } finally {
      chunk.forEach((id) => inflight.delete(id));
    }
  }
}

/** Synchronous read. On a miss returns null and schedules a background fetch. */
export function getFacilityCoords(facilityId: string | null | undefined): LatLng | null {
  if (!facilityId) return null;
  if (known.has(facilityId)) return known.get(facilityId) ?? null;
  if (!inflight.has(facilityId)) {
    pending.add(facilityId);
    if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        const ids = [...pending];
        pending.clear();
        void primeFacilityCoords(ids);
      }, 50);
    }
  }
  return null;
}

/** Test-only hooks. */
export const __testing = {
  setInvoker(fn: Invoker | null) { invoker = fn ?? defaultInvoker; },
  reset() { known.clear(); inflight.clear(); pending.clear(); if (timer) clearTimeout(timer); timer = null; },
};

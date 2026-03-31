/**
 * Detects scheduling conflicts where two runs on the same truck
 * are scheduled less than MIN_GAP_MINUTES apart.
 */

export const MIN_GAP_MINUTES = 45;

function timeToMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const parts = t.split(":");
  if (parts.length < 2) return null;
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

export interface TimeConflict {
  legId1: string;
  legId2: string;
  name1: string;
  name2: string;
  time1: string;
  time2: string;
  gapMinutes: number;
}

/**
 * Given a list of legs on a truck, return pairs that are < 45min apart.
 */
export function detectTimeConflicts(
  legs: { id: string; patient_name: string; pickup_time: string | null }[]
): TimeConflict[] {
  const conflicts: TimeConflict[] = [];
  const withTime = legs
    .map(l => ({ ...l, mins: timeToMinutes(l.pickup_time) }))
    .filter(l => l.mins !== null)
    .sort((a, b) => a.mins! - b.mins!);

  for (let i = 0; i < withTime.length; i++) {
    for (let j = i + 1; j < withTime.length; j++) {
      const gap = Math.abs(withTime[j].mins! - withTime[i].mins!);
      if (gap < MIN_GAP_MINUTES) {
        conflicts.push({
          legId1: withTime[i].id,
          legId2: withTime[j].id,
          name1: withTime[i].patient_name,
          name2: withTime[j].patient_name,
          time1: withTime[i].pickup_time!,
          time2: withTime[j].pickup_time!,
          gapMinutes: gap,
        });
      }
    }
  }
  return conflicts;
}

/** Availability is per assignment date, not a permanent exclusion. */
export interface PoolCrew {
  id: string;
  active_date: string;
  member1_id: string | null;
  member2_id: string | null;
  member3_id: string | null;
}

export function availableCrewOptions<T extends { id: string }>(
  options: T[], crews: PoolCrew[], date: string, editingCrewId?: string,
  selectedElsewhere: string[] = [],
): T[] {
  const used = new Set(selectedElsewhere.filter(id => id && id !== "none"));
  for (const crew of crews) {
    if (crew.active_date !== date || crew.id === editingCrewId) continue;
    for (const id of [crew.member1_id, crew.member2_id, crew.member3_id]) {
      if (id) used.add(id);
    }
  }
  return options.filter(option => !used.has(option.id));
}
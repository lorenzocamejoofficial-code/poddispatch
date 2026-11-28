/** Synthetic identity allocation is independent of transport mix and seed run ID. */
export function personKey(p: { first_name?: string; last_name?: string; dob?: string | null }): string {
  return [p.first_name?.trim().toLowerCase(), p.last_name?.trim().toLowerCase(), p.dob ?? ""].join("|");
}
export function seedPeople(templates: Record<string, any>[], count: number, names: string[]) {
  const unique = [...new Map(templates.map(p => [personKey(p), p])).values()];
  if (!unique.length) return [];
  return Array.from({ length: count }, (_, i) => {
    const template = unique[i % unique.length];
    const extra = i >= unique.length;
    const [first, ...last] = names[i % names.length].split(" ");
    return {
      template,
      first_name: extra ? first : template.first_name,
      last_name: extra ? `${last.join(" ")} Demo` : `${template.last_name} Demo`,
      // Distinct extra people remain distinct even after the name list cycles.
      dob: extra ? new Date(Date.UTC(1940, 0, i + 1)).toISOString().slice(0, 10) : template.dob,
    };
  });
}

/** Keep multiple seeded transports for one person sequential, independently of truck pressure. */
export function seedPickupMinute(base: number, patientId: string, nextByPatient: Map<string, number>): number {
  const pickup = Math.max(base, nextByPatient.get(patientId) ?? 0);
  nextByPatient.set(patientId, pickup + 90);
  return pickup;
}

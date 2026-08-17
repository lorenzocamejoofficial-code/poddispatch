/**
 * Shared, display-only ordering for scheduling legs / truck run slots.
 *
 * Rules (in priority order):
 *  1. slot_order is the PRIMARY key — the dispatcher's deliberate sequence wins.
 *     Non-null slot_order sorts before null slot_order.
 *  2. Pair-aware tiebreak: an A leg and its paired B leg (same patient_id, same
 *     run date, differing leg_type) are treated as ONE unit positioned at the
 *     pair's minimum slot_order, and inside the pair leg_type ascends (A before B).
 *  3. Fallbacks: pickup_time ascending (nulls last), then leg_type ascending.
 *
 * NOTHING here writes to the database. slot_order is never mutated.
 */

export interface LegOrderFields {
  slotOrder: number | null | undefined;
  pickupTime: string | null | undefined;
  patientId: string | null | undefined;
  legType: string | null | undefined;
}

export function normalizeLegType(raw: string | null | undefined): "A" | "B" | null {
  if (raw === "a_leg" || raw === "A" || raw === "a") return "A";
  if (raw === "b_leg" || raw === "B" || raw === "b") return "B";
  return null;
}

function legTypeRank(raw: string | null | undefined): number {
  const t = normalizeLegType(raw);
  if (t === "A") return 0;
  if (t === "B") return 1;
  return 2;
}

const INF = Number.POSITIVE_INFINITY;

function slotVal(v: number | null | undefined): number {
  return v === null || v === undefined ? INF : v;
}

function timeVal(v: string | null | undefined): string {
  return v ? v : "\uffff"; // nulls last
}

/**
 * Sort any collection of leg-like items using the shared rules.
 * Returns a NEW array; the input is not mutated.
 */
export function sortLegsForDisplay<T>(items: T[], get: (item: T) => LegOrderFields): T[] {
  const fields = new Map<T, LegOrderFields>();
  for (const item of items) fields.set(item, get(item));

  // Build pair anchors: patient_id -> { slot, time } minimums across its A/B legs.
  const pairAnchor = new Map<string, { slot: number; time: string }>();
  for (const item of items) {
    const f = fields.get(item)!;
    if (!f.patientId) continue; // one-off legs have no pair
    if (normalizeLegType(f.legType) === null) continue;
    const prev = pairAnchor.get(f.patientId);
    const slot = slotVal(f.slotOrder);
    const time = timeVal(f.pickupTime);
    if (!prev) {
      pairAnchor.set(f.patientId, { slot, time });
    } else {
      pairAnchor.set(f.patientId, {
        slot: Math.min(prev.slot, slot),
        time: time < prev.time ? time : prev.time,
      });
    }
  }

  const anchorOf = (f: LegOrderFields) => {
    if (f.patientId) {
      const a = pairAnchor.get(f.patientId);
      if (a) return a;
    }
    return { slot: slotVal(f.slotOrder), time: timeVal(f.pickupTime) };
  };

  return [...items].sort((a, b) => {
    const fa = fields.get(a)!;
    const fb = fields.get(b)!;
    const aa = anchorOf(fa);
    const ab = anchorOf(fb);

    if (aa.slot !== ab.slot) return aa.slot - ab.slot;
    if (aa.time !== ab.time) return aa.time < ab.time ? -1 : 1;

    // Same pair (or same anchor): A before B.
    const ra = legTypeRank(fa.legType);
    const rb = legTypeRank(fb.legType);
    if (ra !== rb) return ra - rb;

    const sa = slotVal(fa.slotOrder);
    const sb = slotVal(fb.slotOrder);
    if (sa !== sb) return sa - sb;

    const ta = timeVal(fa.pickupTime);
    const tb = timeVal(fb.pickupTime);
    if (ta !== tb) return ta < tb ? -1 : 1;

    return 0;
  });
}

/** Convenience for rows shaped like scheduling_legs. */
export function sortSchedulingLegs<T extends {
  slot_order?: number | null;
  pickup_time?: string | null;
  patient_id?: string | null;
  leg_type?: string | null;
}>(legs: T[]): T[] {
  return sortLegsForDisplay(legs, (l) => ({
    slotOrder: l.slot_order,
    pickupTime: l.pickup_time,
    patientId: l.patient_id,
    legType: l.leg_type,
  }));
}

/** Convenience for truck_run_slots rows carrying an embedded `leg`. */
export function sortTruckRunSlots<T extends {
  slot_order?: number | null;
  leg?: { pickup_time?: string | null; patient_id?: string | null; leg_type?: string | null } | null;
}>(slots: T[]): T[] {
  return sortLegsForDisplay(slots, (s) => ({
    slotOrder: s.slot_order,
    pickupTime: s.leg?.pickup_time,
    patientId: s.leg?.patient_id,
    legType: s.leg?.leg_type,
  }));
}

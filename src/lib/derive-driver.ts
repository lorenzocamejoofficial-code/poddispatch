/**
 * Driver derivation — display only.
 *
 * The driver is never chosen at scheduling. It is derived in the field from
 * who is NOT charting the PCR:
 *
 *  1. If the third member's role is explicitly "driver", they are the driver.
 *  2. Otherwise the primary member who is NOT the attending medic drives.
 *  3. If no attending medic has been chosen yet (PCR not started), the driver
 *     is "not yet determined".
 *
 * Nothing here writes to the database and nothing here is read by billing.
 */
import type { Member3Role } from "./crew-roles";

export interface CrewRosterMember {
  id: string | null;
  name: string | null;
}

export interface CrewRoster {
  member1: CrewRosterMember | null;
  member2: CrewRosterMember | null;
  member3: CrewRosterMember | null;
  member3Role: Member3Role | string | null;
}

export interface DerivedDriver {
  id: string | null;
  name: string | null;
  /** How the driver was determined. */
  source: "member3_role" | "not_attending_medic" | "unknown";
  label: string;
}

const UNKNOWN: DerivedDriver = {
  id: null,
  name: null,
  source: "unknown",
  label: "Not yet determined",
};

export function deriveDriver(
  roster: CrewRoster | null | undefined,
  attendingMedicId: string | null | undefined,
): DerivedDriver {
  if (!roster) return UNKNOWN;

  // 1. Explicit admin assignment wins.
  if (roster.member3Role === "driver" && roster.member3?.id) {
    return {
      id: roster.member3.id,
      name: roster.member3.name ?? null,
      source: "member3_role",
      label: roster.member3.name ?? "Assigned driver",
    };
  }

  const primaries = [roster.member1, roster.member2].filter(
    (m): m is CrewRosterMember & { id: string } => !!m?.id,
  );

  if (!attendingMedicId) return UNKNOWN;

  // 2 & 3. The primary who is not charting drives.
  const others = primaries.filter((m) => m.id !== attendingMedicId);
  if (others.length === 1) {
    return {
      id: others[0].id,
      name: others[0].name ?? null,
      source: "not_attending_medic",
      label: others[0].name ?? "Crew member",
    };
  }

  return UNKNOWN;
}

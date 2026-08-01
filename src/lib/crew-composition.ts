/**
 * Crew composition rules — driver / attendant designation, the minimum-crew
 * rule, and derived unit capability.
 *
 * BILLING NOTE: derived unit capability is display + dispatch only. Nothing in
 * this module is read by claim generation or pricing; the billed level of
 * service stays derived from medical necessity on the trip record.
 */
import type { CertLevel } from "./cert-levels";

export type CrewRole = "driver" | "attendant";

export interface CrewMemberInput {
  id: string;
  full_name: string;
  cert_level: CertLevel | null;
}

export interface CrewCompositionResult {
  valid: boolean;
  /** Reasons the crew fails the minimum-staffing rule. */
  errors: string[];
  /** Non-blocking notes (e.g. EMR is driver-only). */
  notes: string[];
  /** Role assigned to each member id. */
  roles: Record<string, CrewRole>;
  /** Highest service level the CREW can staff. */
  crewCapability: "NONE" | "BLS" | "ALS";
}

/** EMR is driver-only — never counts as the patient-care attendant. */
export function isDriverOnly(level: CertLevel | null | undefined): boolean {
  return level === "EMR";
}

/** Service level a single certification supports as the attendant. */
export function attendantCapability(level: CertLevel | null | undefined): "NONE" | "BLS" | "ALS" {
  if (level === "EMT-P") return "ALS";
  if (level === "EMT-A" || level === "EMT-B") return "BLS";
  return "NONE";
}

/**
 * A valid crew = one designated driver + at least one non-EMR attendant.
 * Two EMRs is invalid (nobody can attend the patient).
 */
export function evaluateCrewComposition(
  members: CrewMemberInput[],
  driverId: string | null,
): CrewCompositionResult {
  const errors: string[] = [];
  const notes: string[] = [];
  const roles: Record<string, CrewRole> = {};
  const present = members.filter((m) => !!m?.id);

  if (present.length < 2) {
    errors.push("A truck needs at least two crew members — one driver and one attendant.");
  }

  const driver = present.find((m) => m.id === driverId) ?? null;
  if (present.length >= 1 && !driver) {
    errors.push("Designate which crew member is the driver.");
  }

  for (const m of present) {
    roles[m.id] = m.id === driver?.id ? "driver" : "attendant";
    if (isDriverOnly(m.cert_level) && roles[m.id] === "attendant") {
      notes.push(`${m.full_name} is EMR — driver only.`);
    }
  }

  const attendants = present.filter((m) => m.id !== driver?.id);
  const qualifiedAttendants = attendants.filter((m) => !isDriverOnly(m.cert_level) && attendantCapability(m.cert_level) !== "NONE");

  if (present.length >= 2 && qualifiedAttendants.length === 0) {
    if (attendants.every((m) => isDriverOnly(m.cert_level)) && attendants.length > 0) {
      errors.push("EMR is driver-only — this crew has no certified attendant. Two EMRs is not a valid crew.");
    } else {
      errors.push("This crew has no certified patient-care attendant (EMT-B or higher).");
    }
  }

  const crewCapability = qualifiedAttendants.some((m) => attendantCapability(m.cert_level) === "ALS")
    ? "ALS"
    : qualifiedAttendants.length > 0
      ? "BLS"
      : "NONE";

  return { valid: errors.length === 0, errors, notes, roles, crewCapability };
}

/**
 * Derived unit capability = min(crew capability, truck service level).
 * Display + dispatch only — never used for billing.
 */
export function deriveUnitCapability(
  crewCapability: "NONE" | "BLS" | "ALS",
  truckServiceLevel: "BLS" | "ALS" | null | undefined,
): "NONE" | "BLS" | "ALS" {
  if (crewCapability === "NONE") return "NONE";
  const truck = truckServiceLevel === "ALS" ? "ALS" : "BLS";
  if (crewCapability === "ALS" && truck === "ALS") return "ALS";
  return "BLS";
}

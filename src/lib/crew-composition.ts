/**
 * Crew composition rules — the minimum-crew rule and derived unit capability.
 *
 * The driver is NOT chosen here. It is derived in the field from the PCR
 * author (see src/lib/derive-driver.ts). Crew validity depends only on the
 * two PRIMARY members having a genuinely certified attendant between them.
 *
 * The optional third member (whatever their role — Second Medic, Lift Assist,
 * Driver, Trainee/Observer) is deliberately EXCLUDED from validity and from
 * crew capability, so a trainee can never satisfy "certified attendant" and
 * can never upgrade a BLS crew to ALS.
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
  /** Highest service level the PRIMARY crew can staff. */
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
 * A valid crew = two primary members, at least one of whom is a certified
 * attendant (EMT-B or higher). Two EMRs is invalid — nobody can attend the
 * patient. No driver designation is required.
 *
 * @param primaryMembers member1 + member2 only. Do NOT pass the third member.
 */
export function evaluateCrewComposition(
  primaryMembers: CrewMemberInput[],
): CrewCompositionResult {
  const errors: string[] = [];
  const notes: string[] = [];
  const present = primaryMembers.filter((m) => !!m?.id);

  if (present.length < 2) {
    errors.push("A truck needs at least two crew members — one to drive and one to attend the patient.");
  }

  for (const m of present) {
    if (isDriverOnly(m.cert_level)) {
      notes.push(`${m.full_name} is EMR — driver only, cannot attend the patient.`);
    }
  }

  const qualified = present.filter(
    (m) => !isDriverOnly(m.cert_level) && attendantCapability(m.cert_level) !== "NONE",
  );

  if (present.length >= 2 && qualified.length === 0) {
    if (present.every((m) => isDriverOnly(m.cert_level))) {
      errors.push("EMR is driver-only — this crew has no certified attendant. Two EMRs is not a valid crew.");
    } else {
      errors.push("This crew has no certified patient-care attendant (EMT-B or higher).");
    }
  }

  const crewCapability = qualified.some((m) => attendantCapability(m.cert_level) === "ALS")
    ? "ALS"
    : qualified.length > 0
      ? "BLS"
      : "NONE";

  return { valid: errors.length === 0, errors, notes, crewCapability };
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

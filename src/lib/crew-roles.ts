/**
 * Roles for the optional third crew member.
 *
 * The third seat is never part of the minimum-crew rule and never counts as
 * the certified attendant — see src/lib/crew-composition.ts. Only a
 * `second_medic` may be offered as the attending medic on a PCR.
 */
export const MEMBER3_ROLES = ["second_medic", "lift_assist", "driver", "trainee"] as const;

export type Member3Role = (typeof MEMBER3_ROLES)[number];

export const MEMBER3_ROLE_LABELS: Record<Member3Role, string> = {
  second_medic: "Second Medic",
  lift_assist: "Lift Assist",
  driver: "Driver",
  trainee: "Trainee/Observer",
};

/** Certifications the third seat needs for a given role (mirrors crew_assignable_for_role). */
export const MEMBER3_ROLE_CERTS: Record<Member3Role, string[]> = {
  second_medic: ["medic_number", "cpr", "drivers_license"],
  driver: ["cpr", "drivers_license"],
  lift_assist: ["cpr"],
  trainee: [],
};

export const CERT_LABELS: Record<string, string> = {
  medic_number: "Medic #",
  cpr: "CPR",
  drivers_license: "Driver's License",
};

export function member3RoleLabel(role: string | null | undefined): string | null {
  if (!role) return null;
  return MEMBER3_ROLE_LABELS[role as Member3Role] ?? role;
}

/** Only a Second Medic third member can ever be the attending (billable) clinician. */
export function canThirdMemberAttend(role: string | null | undefined): boolean {
  return role === "second_medic";
}

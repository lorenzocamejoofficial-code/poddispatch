/**
 * Transport vocabulary — Axis 1 of the two-axis trip classification.
 * ------------------------------------------------------------------
 * Transport kind = what the trip clinically is. It drives clinical intake
 * fields and ePCR required sections. Who pays is a separate axis
 * (src/lib/payer-class.ts).
 *
 * Owner decisions:
 *  - One "outpatient" value (no specialty flavor).
 *  - Emergency is NOT a transport kind — it stays the upgrade flag
 *    (trip_records.is_emergency_pcr / pcr_type='emergency').
 *  - "private_pay" is a payer, never a transport kind.
 *
 * Stage 0: this module is not wired into any behavior yet.
 * Unknown / ambiguous values return null — never a silent "dialysis" default.
 */

export const TRANSPORT_KINDS = [
  "dialysis",
  "ift",
  "discharge",
  "outpatient",
  "wound_care",
  "psych",
] as const;
export type TransportKind = (typeof TRANSPORT_KINDS)[number];

export const TRANSPORT_KIND_LABELS: Record<TransportKind, string> = {
  dialysis: "Dialysis",
  ift: "IFT (Inter-facility)",
  discharge: "Hospital Discharge",
  outpatient: "Outpatient / Doctor Visit",
  wound_care: "Wound Care",
  psych: "Psych / Behavioral",
};

/** Every legacy spelling seen in patients.transport_type, trip_records.trip_type,
 *  trip_records.pcr_type and scheduling_legs.trip_type. */
const ALIASES: Record<string, TransportKind> = {
  dialysis: "dialysis",
  nemt_dialysis: "dialysis",
  ift: "ift",
  ift_general: "ift",
  discharge: "discharge",
  ift_discharge: "discharge",
  outpatient: "outpatient",
  outpatient_specialty: "outpatient",
  wound_care: "wound_care",
  woundcare: "wound_care",
  ift_wound_care: "wound_care",
  psych: "psych",
  psych_transport: "psych",
  behavioral: "psych",
};

/** Legacy values that are NOT a transport kind and must be resolved elsewhere. */
const NOT_A_TRANSPORT_KIND = new Set(["private_pay", "emergency", "complex", "adhoc", "hospital", "other", ""]);

export function normalizeTransportKind(value: string | null | undefined): TransportKind | null {
  const raw = String(value ?? "").toLowerCase().trim();
  if (NOT_A_TRANSPORT_KIND.has(raw)) return null;
  return ALIASES[raw] ?? null;
}

/** True when a legacy transport value actually meant "patient pays". */
export function isLegacyPrivatePayTransport(value: string | null | undefined): boolean {
  return String(value ?? "").toLowerCase().trim() === "private_pay";
}

/** True when a legacy type value actually meant the emergency upgrade. */
export function isLegacyEmergencyValue(value: string | null | undefined): boolean {
  const raw = String(value ?? "").toLowerCase().trim();
  return raw === "emergency" || raw === "complex";
}

/**
 * Resolve a trip's transport kind from its legacy fields, in precedence order:
 * trip_type, then pcr_type, then the patient's transport_type.
 * Returns null when nothing maps (for human review — never guessed).
 */
export function resolveTransportKind(src: {
  trip_type?: string | null;
  pcr_type?: string | null;
  patient_transport_type?: string | null;
}): TransportKind | null {
  return (
    normalizeTransportKind(src.trip_type) ??
    normalizeTransportKind(src.pcr_type) ??
    normalizeTransportKind(src.patient_transport_type)
  );
}

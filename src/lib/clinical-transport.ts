/**
 * Clinical transport reader — Stage 4 of the two-axis classification.
 * -------------------------------------------------------------------
 * Clinical behavior (ePCR cards, required fields, narrative rules) reads the
 * trip's `transport_kind` through this one function instead of the legacy
 * trip_type / pcr_type strings.
 *
 * It returns a legacy-shaped type string so the existing rule tables
 * (pcr-field-requirements, pcr-dropdowns, card templates) keep producing the
 * exact same output.
 *
 * Fallback: when transport_kind is empty, or the trip's trip_type is not a
 * clean transport kind (null, "hospital", "private_pay", "emergency"...), the
 * caller's previous legacy expression is returned unchanged. That keeps the
 * emergency / private-pay / unknown paths byte-identical until later stages
 * retire them.
 */
import { normalizeTransportKind, type TransportKind } from "./transport-vocabulary";

const KIND_TO_LEGACY: Record<TransportKind, string> = {
  dialysis: "dialysis",
  ift: "ift",
  discharge: "discharge",
  outpatient: "outpatient",
  wound_care: "wound_care",
  psych: "psych_transport",
};

export function clinicalTransportType(
  trip: { transport_kind?: string | null; trip_type?: string | null } | null | undefined,
  legacy: string | null | undefined,
): string | null | undefined {
  const kind = normalizeTransportKind(trip?.transport_kind);
  if (kind && normalizeTransportKind(trip?.trip_type) === kind) return KIND_TO_LEGACY[kind];
  return legacy;
}

/**
 * Input for the ePCR required-sections rules (usePCRSectionRules).
 * 1. Emergency upgrade always wins (pcr_type 'emergency'/'complex' or is_emergency_pcr).
 * 2. Otherwise the trip's transport_kind (when trip_type is a clean kind) — this
 *    fixes IFT/outpatient/psych trips whose pcr_type 'ift_general' used to fall
 *    through to dialysis sections, and gives discharge trips discharge sections.
 * 3. Otherwise the legacy expression (pcr_type || trip_type), unchanged.
 */
export function sectionRulesTransportType(
  trip: { transport_kind?: string | null; trip_type?: string | null; pcr_type?: string | null; is_emergency_pcr?: boolean | null } | null | undefined,
): string | null | undefined {
  const pcr = String(trip?.pcr_type ?? "").toLowerCase().trim();
  if (trip?.is_emergency_pcr || pcr === "emergency" || pcr === "complex") return "emergency";
  return clinicalTransportType(trip, trip?.pcr_type || trip?.trip_type);
}

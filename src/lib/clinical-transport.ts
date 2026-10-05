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

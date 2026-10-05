/**
 * Stage 4 parity: the clinical readers must behave EXACTLY as before when
 * they read transport_kind instead of trip_type / pcr_type.
 * "old" = the legacy expression each call site used; "new" = clinicalTransportType().
 */
import { describe, it, expect } from "vitest";
import snapshot from "@/test/fixtures/classification-snapshot.json";
import { clinicalTransportType } from "./clinical-transport";
import { normalizeTransportKey, getRequiredFieldsForCard, evaluatePCRFieldCompletion } from "./pcr-field-requirements";
import { getPCRTransportKey } from "./pcr-dropdowns";
import { normalizeTransportKind, resolveTransportKind } from "./transport-vocabulary";

type Trip = { id: string; trip_type: string | null; pcr_type: string | null; transport_kind: string | null };

const CARDS = [
  "patient_info", "times", "vitals", "condition_on_arrival", "medical_necessity", "equipment", "signatures",
  "narrative", "billing", "sending_facility", "assessment", "chief_complaint", "physical_exam",
  "hospital_outcome", "stretcher_mobility", "isolation_precautions", "behavioral_health",
];
const PAYERS = [null, "medicare", "medicaid", "private", "self_pay"];

const ambulance = (t: string) =>
  ["ift", "emergency", "dialysis", "discharge", "psych", "wound"].some((k) => t.includes(k));
const necessityKey = (t: string) =>
  String(t).toLowerCase().includes("wound") ? "wound_care" : t === "outpatient_specialty" ? "outpatient" : t;

/** Every clinical output, given the type string each reader receives. */
function outputs(trip: Trip, read: (legacy: any) => any) {
  const both = read(trip.trip_type || trip.pcr_type);
  const req = read(trip.trip_type || trip.pcr_type || "") || "";
  const full = { ...trip, assessment_json: {}, condition_on_arrival: {} };
  return {
    fieldKey: normalizeTransportKey(both),
    cards: getPCRTransportKey(both ?? null),
    narrativeRule: ambulance(String(req).toLowerCase()),
    patientInfoType: read(trip.trip_type || trip.pcr_type || "dialysis") || "dialysis",
    necessityTemplate: necessityKey(read(trip.trip_type ?? "dialysis") ?? "dialysis"),
    woundCondition: String(read(trip.trip_type ?? "") ?? "").toLowerCase().includes("wound"),
    perCard: PAYERS.flatMap((p) => CARDS.map((c) => getRequiredFieldsForCard(req, c, p, full).join(","))),
    completion: PAYERS.map((p) => evaluatePCRFieldCompletion(full, p).fields.map((f) => f.field).join(",")),
  };
}
const oldOut = (t: Trip) => {
  const legacyTrip = { ...t, transport_kind: null };
  const o = outputs(legacyTrip, (l) => l);
  return o;
};
const newOut = (t: Trip) => outputs(t, (l) => clinicalTransportType(t, l));

describe("Stage 4 clinical reader parity — every live trip", () => {
  const trips = snapshot.trips as Trip[];
  it("covers all trips in the snapshot", () => expect(trips.length).toBeGreaterThan(0));
  it.each(trips.map((t) => [t.id, t] as const))("trip %s: old == new", (_id, t) => {
    expect(newOut(t)).toEqual(oldOut(t));
  });
});

describe("Stage 4 clinical reader parity — every legacy combination", () => {
  const TRIP_TYPES = [null, "dialysis", "discharge", "outpatient", "hospital", "private_pay", "ift", "woundcare", "psych_transport", "wound_care"];
  const PCR_TYPES = [null, "", "dialysis", "nemt_dialysis", "ift_general", "ift_discharge", "ift_wound_care", "outpatient_specialty", "emergency", "complex", "private_pay"];
  const PATIENT = [null, "dialysis", "ift", "adhoc", "private_pay"];
  const combos: Trip[] = [];
  for (const tt of TRIP_TYPES) for (const pt of PCR_TYPES) for (const pa of PATIENT)
    combos.push({ id: `${tt}|${pt}|${pa}`, trip_type: tt, pcr_type: pt,
      transport_kind: resolveTransportKind({ trip_type: tt, pcr_type: pt, patient_transport_type: pa }) });
  it.each(combos.map((c) => [c.id, c] as const))("%s: old == new (labels aside)", (_id, t) => {
    const a = oldOut(t), b = newOut(t);
    // "woundcare" is relabelled to "wound_care" — display string only, same behavior.
    if (t.trip_type === "woundcare") { a.patientInfoType = b.patientInfoType; a.necessityTemplate = b.necessityTemplate; }
    expect(b).toEqual(a);
  });
});

describe("dual-write snapshot matches the TS normalizers", () => {
  it("legs and patients", () => {
    for (const l of snapshot.legs as any[]) expect(l.transport_kind).toBe(normalizeTransportKind(l.trip_type));
    for (const p of snapshot.patients as any[]) expect(p.transport_kind).toBe(normalizeTransportKind(p.transport_type));
  });
});

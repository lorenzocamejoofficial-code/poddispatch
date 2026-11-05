/**
 * Office-side "Create PCR": owner/manager documents a run directly. Creates a
 * matching one-off scheduling leg (+ crew row when none exists) and the
 * trip_records row through the shared buildTripInsert, so the PCR then follows
 * the exact same form, submit, claim and QA path as a crew-scheduled PCR.
 */
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/lib/audit-logger";
import { normalizeTransportKind, type TransportKind } from "@/lib/transport-vocabulary";
import {
  buildTripInsert, defaultOriginDestination, PATIENT_PCR_DEFAULTS_SELECT,
} from "@/lib/pcr-trip-insert";

export const MANUAL_PCR_MAX_DAYS_BACK = 7;

/** Transport kind → legacy trip_type enum value written to legs/trips. */
export function legacyTripTypeForKind(kind: TransportKind): string {
  return kind === "psych" ? "psych_transport" : kind;
}

export interface ManualPcrSetup {
  patientId: string;
  transportKind: TransportKind | "";
  runDate: string; // YYYY-MM-DD
  pickupTime: string; // HH:MM
  legType: "A" | "B";
  truckId: string;
  existingCrewId: string | null;
  member1Id: string;
  member2Id: string;
  pickupLocation: string;
  destinationLocation: string;
  serviceLevel: "BLS" | "ALS";
}

export type ManualPcrErrors = Partial<Record<keyof ManualPcrSetup | "icd10", string>>;

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}

/** Pure validation of the setup step. `today` is YYYY-MM-DD local. */
export function validateManualPcrSetup(
  s: ManualPcrSetup,
  ctx: { today: string; patientIcd10: string[] | null | undefined; truckOutOfService: boolean },
): ManualPcrErrors {
  const e: ManualPcrErrors = {};
  if (!s.patientId) e.patientId = "Select a patient";
  if (!s.transportKind) e.transportKind = "Select a transport type";
  if (!s.runDate) e.runDate = "Run date is required";
  else {
    const diff = daysBetween(s.runDate, ctx.today);
    if (diff < 0) e.runDate = "Run date can't be in the future";
    else if (diff > MANUAL_PCR_MAX_DAYS_BACK) e.runDate = `Run date can be at most ${MANUAL_PCR_MAX_DAYS_BACK} days back`;
  }
  if (!s.pickupTime) e.pickupTime = "Pickup time is required";
  if (!s.truckId) e.truckId = "Select a truck";
  else if (ctx.truckOutOfService) e.truckId = "This truck is out of service on that date";
  if (!s.existingCrewId) {
    if (!s.member1Id) e.member1Id = "Select crew member 1";
    if (!s.member2Id) e.member2Id = "Select crew member 2";
    if (s.member1Id && s.member1Id === s.member2Id) e.member2Id = "Pick two different crew members";
  }
  if (!s.pickupLocation.trim()) e.pickupLocation = "Pickup location is required";
  if (!s.destinationLocation.trim()) e.destinationLocation = "Destination is required";
  if (s.transportKind === "dialysis" && (!ctx.patientIcd10 || ctx.patientIcd10.length === 0)) {
    e.icd10 = "Dialysis runs need a diagnosis code on the patient. Add an ICD-10 code to the patient first.";
  }
  return e;
}

export async function isTruckOutOfService(truckId: string, runDate: string): Promise<boolean> {
  const { data } = await supabase
    .from("truck_availability")
    .select("status")
    .eq("truck_id", truckId)
    .lte("start_date", runDate)
    .gte("end_date", runDate);
  return (data ?? []).some((r: any) => r.status && r.status !== "available");
}

export async function createManualPcr(s: ManualPcrSetup, companyId: string): Promise<string> {
  const kind = normalizeTransportKind(s.transportKind);
  if (!kind) throw new Error("Invalid transport type");
  const tripType = legacyTripTypeForKind(kind);

  // 1. Crew: reuse the truck's crew for that date, else assign atomically.
  let crewId = s.existingCrewId;
  if (!crewId) {
    const { data: res, error } = await supabase.rpc("safe_assign_crew", {
      p_truck_id: s.truckId, p_active_date: s.runDate,
      p_member1_id: s.member1Id, p_member2_id: s.member2Id,
      p_member3_id: null, p_member3_role: null,
    } as any);
    if (error) throw new Error(`Crew assignment failed: ${error.message}`);
    if (!(res as any)?.ok) throw new Error((res as any)?.error ?? "Crew assignment conflict");
    const { data: crew } = await supabase
      .from("crews").select("id")
      .eq("truck_id", s.truckId).eq("active_date", s.runDate).eq("company_id", companyId)
      .maybeSingle();
    if (!crew?.id) throw new Error("Crew was assigned but could not be read back");
    crewId = crew.id;
  }

  // 2. Matching one-off leg so scheduling, feasibility and claim lookups see it.
  const od = defaultOriginDestination(tripType, s.legType);
  const { data: leg, error: legErr } = await supabase.from("scheduling_legs").insert({
    patient_id: s.patientId, leg_type: s.legType as any,
    pickup_time: s.pickupTime, pickup_location: s.pickupLocation.trim(),
    destination_location: s.destinationLocation.trim(),
    trip_type: tripType as any, run_date: s.runDate, company_id: companyId,
    origin_type: od.origin_type, destination_type: od.destination_type,
    service_level: s.serviceLevel, is_unscheduled: true,
    notes: "Created from office Create PCR",
  } as any).select("id").single();
  if (legErr || !leg) throw new Error(`Couldn't create the run: ${legErr?.message ?? "unknown error"}`);

  // 3. Trip row through the shared helper.
  const { data: pd } = await supabase.from("patients").select(PATIENT_PCR_DEFAULTS_SELECT).eq("id", s.patientId).maybeSingle();
  const insert = buildTripInsert({
    leg_id: leg.id, truck_id: s.truckId, crew_id: crewId, company_id: companyId,
    patient_id: s.patientId, run_date: s.runDate,
    pickup_location: s.pickupLocation.trim(), destination_location: s.destinationLocation.trim(),
    scheduled_pickup_time: s.pickupTime, trip_type: tripType,
    origin_type: od.origin_type, destination_type: od.destination_type,
    service_level: s.serviceLevel, is_unscheduled: true,
  }, pd as any);
  const { data: trip, error: tripErr } = await supabase.from("trip_records").insert(insert as any).select("id").single();
  if (tripErr || !trip) {
    await supabase.from("scheduling_legs").delete().eq("id", leg.id);
    throw new Error(`Couldn't create the PCR: ${tripErr?.message ?? "unknown error"}`);
  }

  logAuditEvent({
    action: "manual_pcr_created", tableName: "trip_records", recordId: trip.id,
    notes: `Manual PCR created from office (truck inspection gate not applied). Leg ${leg.id}, crew ${crewId}.`,
  });
  return trip.id;
}

/**
 * Shared trip_records insert assembly for a new PCR. Used by the crew run
 * picker (PCRPage createTripForRun) and the office "Create PCR" flow so both
 * paths produce identical rows and stay indistinguishable downstream.
 */
import { normalizeTransportKey } from "@/lib/pcr-field-requirements";

export interface PatientPcrDefaults {
  icd10_codes?: string[] | null;
  default_chief_complaint?: string | null;
  default_primary_impression?: string | null;
  default_medical_necessity_reason?: string | null;
  default_bed_confined?: boolean | null;
  default_cannot_transfer?: boolean | null;
  default_requires_monitoring?: boolean | null;
  default_oxygen_transport?: boolean | null;
  default_bh_authorization_type?: string | null;
  default_bh_authorizing_facility?: string | null;
  default_bh_authorizing_physician_name?: string | null;
  default_bh_authorizing_physician_npi?: string | null;
  default_wound_type?: string | null;
  default_wound_location?: string | null;
  default_wound_stage?: string | null;
}

export const PATIENT_PCR_DEFAULTS_SELECT =
  "icd10_codes, default_chief_complaint, default_primary_impression, default_medical_necessity_reason, default_bed_confined, default_cannot_transfer, default_requires_monitoring, default_oxygen_transport, default_bh_authorization_type, default_bh_authorizing_facility, default_bh_authorizing_physician_name, default_bh_authorizing_physician_npi, default_wound_type, default_wound_location, default_wound_stage, transport_type";

export interface TripInsertBase {
  leg_id: string | null;
  truck_id: string | null;
  crew_id: string | null;
  company_id: string;
  patient_id: string | null;
  run_date: string;
  pickup_location: string | null;
  destination_location: string | null;
  scheduled_pickup_time: string | null;
  trip_type: string | null;
  origin_type: string | null;
  destination_type: string | null;
  service_level: string | null;
  is_unscheduled: boolean;
}

/** Builds the trip_records insert: base fields + patient defaults. trip_type is
 *  canonical; pcr_type is a deprecated mirror. */
export function buildTripInsert(base: TripInsertBase, pd: PatientPcrDefaults | null): Record<string, any> {
  const insertData: Record<string, any> = {
    ...base,
    status: "scheduled",
    pcr_type: base.trip_type, // DEPRECATED — mirror of trip_type
    pcr_status: "not_started",
  };
  if (!pd) return insertData;
  const key = normalizeTransportKey(base.trip_type);
  if (pd.icd10_codes && pd.icd10_codes.length > 0) insertData.icd10_codes = pd.icd10_codes;
  if (pd.default_chief_complaint) insertData.chief_complaint = pd.default_chief_complaint;
  if (pd.default_primary_impression) insertData.primary_impression = pd.default_primary_impression;
  if (pd.default_medical_necessity_reason) insertData.medical_necessity_reason = pd.default_medical_necessity_reason;
  if (pd.default_bed_confined) insertData.bed_confined = true;
  if (pd.default_cannot_transfer) insertData.cannot_transfer_safely = true;
  if (pd.default_requires_monitoring) insertData.requires_monitoring = true;
  if (pd.default_oxygen_transport) insertData.oxygen_during_transport = true;
  if (key === "psych_transport") {
    if (pd.default_bh_authorization_type) insertData.bh_authorization_type = pd.default_bh_authorization_type;
    if (pd.default_bh_authorizing_facility) insertData.bh_authorizing_facility = pd.default_bh_authorizing_facility;
    if (pd.default_bh_authorizing_physician_name) insertData.bh_authorizing_physician_name = pd.default_bh_authorizing_physician_name;
    if (pd.default_bh_authorizing_physician_npi) insertData.bh_authorizing_physician_npi = pd.default_bh_authorizing_physician_npi;
  }
  if (key === "wound_care" || key === "outpatient" || key === "outpatient_specialty") {
    if (pd.default_wound_type) insertData.wound_type = pd.default_wound_type;
    if (pd.default_wound_location) insertData.wound_location = pd.default_wound_location;
    if (key === "wound_care" && pd.default_wound_stage) insertData.wound_stage = pd.default_wound_stage;
  }
  return insertData;
}

/** Default origin/destination location types from transport + direction. */
export function defaultOriginDestination(tripType: string, legType: string) {
  if (legType === "B") {
    const origin = tripType === "dialysis" ? "Dialysis Facility" : tripType === "ift" ? "Hospital" : "Healthcare Facility";
    return { origin_type: origin, destination_type: "Residence" };
  }
  const destination = tripType === "dialysis" ? "Dialysis Facility" : tripType === "ift" ? "Hospital" : "Healthcare Facility";
  return { origin_type: "Residence", destination_type: destination };
}

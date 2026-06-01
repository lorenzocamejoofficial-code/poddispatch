/**
 * Verify rules 2 & 4 fire by replaying the exact queue-claims fetch shape
 * against the seeded claims. Uses postgres directly (not Supabase JS) so we
 * don't need a service-role key. The SELECTs match queue-claims-for-submission.ts
 * line-for-line; the readiness call is the real one from src/lib/claim-readiness.ts.
 */
import { Client } from "pg";
import { evaluateClaimReadiness } from "/dev-server/src/lib/claim-readiness.ts";

const COMPANY_ID = "f53311c3-a40e-4b2b-b4c2-5aec852f7789";
const CLAIM_IDS = [
  "44444444-4444-4444-4444-444444444441", // Rule 4 fixture
  "44444444-4444-4444-4444-444444444442", // Rule 2 fixture
];

const c = new Client({ connectionString: process.env.SUPABASE_DB_URL });
await c.connect();

// Mirror queue-claims-for-submission.ts: claims, patients (with the NEW fields),
// trips, facilities.
const { rows: claims } = await c.query(
  `SELECT * FROM claim_records WHERE id = ANY($1::uuid[]) AND company_id = $2`,
  [CLAIM_IDS, COMPANY_ID],
);
const patientIds = [...new Set(claims.map((x: any) => x.patient_id).filter(Boolean))];
const tripIds = [...new Set(claims.map((x: any) => x.trip_id).filter(Boolean))];

const { rows: patients } = await c.query(
  `SELECT id, first_name, last_name, dob, sex, weight_lbs, member_id, primary_payer,
          pickup_address, pcs_on_file, pcs_physician_npi, pcs_physician_name, facility_id,
          prior_auth_utn, prior_auth_period_end, standing_order, recurrence_days
   FROM patients WHERE id = ANY($1::uuid[])`,
  [patientIds],
);
const { rows: trips } = await c.query(
  `SELECT id, loaded_miles, bed_confined, requires_monitoring, stretcher_placement,
          oxygen_during_transport, weight_lbs, pickup_location, destination_location
   FROM trip_records WHERE id = ANY($1::uuid[])`,
  [tripIds],
);
const facIds = [...new Set(patients.map((p: any) => p.facility_id).filter(Boolean))];
const { rows: facs } = facIds.length
  ? await c.query(`SELECT id, name, address, facility_type, dialysis_subtype FROM facilities WHERE id = ANY($1::uuid[])`, [facIds])
  : { rows: [] as any[] };

const patMap: Record<string, any> = Object.fromEntries(patients.map((p: any) => [p.id, p]));
const tripMap: Record<string, any> = Object.fromEntries(trips.map((t: any) => [t.id, t]));
const facById: Record<string, any> = Object.fromEntries(facs.map((f: any) => [f.id, f]));

for (const claim of claims) {
  const pat = patMap[claim.patient_id] || {};
  const trip = tripMap[claim.trip_id] || {};
  const standingFac = pat.facility_id ? facById[pat.facility_id] : null;
  const destMeta = standingFac
    ? { facility_type: standingFac.facility_type, dialysis_subtype: standingFac.dialysis_subtype ?? null }
    : null;

  // Build the ClaimForEDI subset the queue passes to evaluateClaimReadiness.
  const ec: any = {
    claim_id: claim.id,
    patient_name: `${pat.last_name || "UNKNOWN"}, ${pat.first_name || "UNKNOWN"}`,
    patient_dob: (pat.dob instanceof Date ? pat.dob.toISOString().slice(0,10) : pat.dob) || "1900-01-01",
    patient_sex: pat.sex,
    patient_address: pat.pickup_address || "",
    patient_city: "Atlanta", patient_state: "GA", patient_zip: "30301",
    member_id: pat.member_id || claim.member_id,
    payer_name: claim.payer_name,
    payer_id: "TEST",
    payer_type: claim.payer_type,
    claim_filing_indicator: "MB",
    run_date: claim.run_date instanceof Date ? claim.run_date.toISOString().slice(0,10) : claim.run_date,
    hcpcs_codes: claim.hcpcs_codes || [],
    hcpcs_modifiers: claim.hcpcs_modifiers || [],
    total_charge: Number(claim.total_charge || 0),
    base_charge: Number(claim.base_charge || 0),
    mileage_charge: Number(claim.mileage_charge || 0),
    loaded_miles: trip.loaded_miles || 0,
    origin_type: claim.origin_type,
    destination_type: claim.destination_type,
    origin_zip: claim.origin_zip,
    icd10_codes: claim.icd10_codes || [],
    diagnosis_codes: [],
    destination_facility_meta: destMeta,
    stretcher_placement: trip.stretcher_placement ?? claim.stretcher_placement ?? null,
    bed_confined: !!trip.bed_confined,
    requires_monitoring: !!trip.requires_monitoring,
    oxygen_required: !!trip.oxygen_during_transport,
    weight_lbs: trip.weight_lbs ?? pat.weight_lbs ?? null,
    pickup_facility_name: null, dropoff_facility_name: null,
    pcs_on_file: !!pat.pcs_on_file,
    pcs_certification_date: claim.pcs_certification_date
      ? (claim.pcs_certification_date instanceof Date ? claim.pcs_certification_date.toISOString().slice(0,10) : claim.pcs_certification_date)
      : null,
  };

  const issues = evaluateClaimReadiness({
    claim: { ...ec, id: claim.id, trip_id: claim.trip_id, patient_id: claim.patient_id },
    billingState: "GA",
    patient: {
      prior_auth_utn: pat.prior_auth_utn ?? null,
      prior_auth_period_end: pat.prior_auth_period_end instanceof Date
        ? pat.prior_auth_period_end.toISOString().slice(0,10)
        : (pat.prior_auth_period_end ?? null),
      standing_order: pat.standing_order ?? null,
      recurrence_days: pat.recurrence_days ?? null,
    },
    transport: { destination_facility_type: destMeta?.facility_type ?? null },
  }).filter((i) => i.severity === "block");

  console.log(`\n=== Claim ${claim.id} (${claim.payer_name} / ${claim.payer_type}) ===`);
  console.log(`  Fixture          : ${claim.id.endsWith("441") ? "Rule 4 — stretcher + 1 ICD" : "Rule 2 — Medicare → dialysis, no prior auth"}`);
  console.log(`  Field sources    :`);
  console.log(`    stretcher_placement = ${JSON.stringify(ec.stretcher_placement)}  [trip_records.stretcher_placement]`);
  console.log(`    icd10_codes         = ${JSON.stringify(ec.icd10_codes)}  [claim_records.icd10_codes]`);
  console.log(`    pcs_on_file         = ${ec.pcs_on_file}  [patients.pcs_on_file]`);
  console.log(`    pcs_certification_date = ${JSON.stringify(ec.pcs_certification_date)}  [claim_records.pcs_certification_date]`);
  console.log(`    payer_type          = ${JSON.stringify(ec.payer_type)}  [claim_records.payer_type]`);
  console.log(`    destination_facility_type = ${JSON.stringify(destMeta?.facility_type ?? null)}  [facilities.facility_type via patients.facility_id]`);
  console.log(`    patient.prior_auth_utn      = ${JSON.stringify(pat.prior_auth_utn)}  [patients.prior_auth_utn]`);
  console.log(`    patient.standing_order      = ${JSON.stringify(pat.standing_order)}  [patients.standing_order]`);
  console.log(`    patient.recurrence_days     = ${JSON.stringify(pat.recurrence_days)}  [patients.recurrence_days]`);
  console.log(`  Block issues emitted (${issues.length}):`);
  for (const i of issues) {
    console.log(`    • [${i.stage}/${i.field}] ${i.message}  → ${i.fixPath ?? "(no fix path)"}`);
  }
}

await c.end();

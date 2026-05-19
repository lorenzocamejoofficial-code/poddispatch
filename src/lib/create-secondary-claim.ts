/**
 * createSecondaryClaim
 * --------------------
 * Spawns a secondary claim_records row from an existing PAID primary claim,
 * populating it with the patient's secondary insurance info and linking it
 * back via original_claim_id. The 837P generator picks up that link and
 * emits Loop 2320/2330 (COB) using the primary's claim_payments adjudication.
 *
 * The DB unique index (claim_records_primary_trip_uidx) allows multiple rows
 * per trip as long as only one has original_claim_id IS NULL, so secondaries
 * legitimately share the trip_id with the primary.
 */
import { supabase } from "@/integrations/supabase/client";

export interface CreateSecondaryClaimResult {
  ok: boolean;
  secondaryClaimId?: string;
  error?: string;
}

export async function createSecondaryClaim(
  primaryClaimId: string,
): Promise<CreateSecondaryClaimResult> {
  if (!primaryClaimId) return { ok: false, error: "primary claim id missing" };

  const { data: prim, error: primErr } = await supabase
    .from("claim_records" as any)
    .select("*")
    .eq("id", primaryClaimId)
    .maybeSingle();
  if (primErr || !prim) return { ok: false, error: primErr?.message || "primary claim not found" };
  const p = prim as any;

  if (p.status !== "paid" && p.status !== "denied") {
    return { ok: false, error: `primary must be paid or denied (currently ${p.status})` };
  }
  if (p.secondary_claim_generated && p.secondary_claim_id) {
    return { ok: true, secondaryClaimId: p.secondary_claim_id };
  }
  if (!p.patient_id) {
    return { ok: false, error: "primary claim is missing patient_id (one-off — no secondary lookup possible)" };
  }

  const { data: pat } = await supabase
    .from("patients")
    .select("id, secondary_payer, secondary_payer_id, secondary_member_id")
    .eq("id", p.patient_id)
    .maybeSingle();
  const patient = pat as any;
  if (!patient?.secondary_payer || !patient?.secondary_member_id) {
    return { ok: false, error: "patient has no secondary payer / member id on file" };
  }

  const secPayerType = String(patient.secondary_payer || "").toLowerCase();
  const secPayerName =
    secPayerType === "medicare" ? "MEDICARE" :
    secPayerType === "medicaid" ? "MEDICAID" :
    String(patient.secondary_payer);

  // Clone clinical / transport fields; reset adjudication + control fields.
  const insertRow = {
    company_id: p.company_id,
    trip_id: p.trip_id,
    patient_id: p.patient_id,
    original_claim_id: p.id,
    run_date: p.run_date,
    payer_type: secPayerType,
    payer_name: secPayerName,
    member_id: patient.secondary_member_id,
    total_charge: p.total_charge,
    base_charge: p.base_charge,
    mileage_charge: p.mileage_charge,
    extras_charge: p.extras_charge,
    hcpcs_codes: p.hcpcs_codes,
    hcpcs_modifiers: p.hcpcs_modifiers,
    hcpcs_manually_set: p.hcpcs_manually_set,
    icd10_codes: p.icd10_codes,
    origin_address: p.origin_address,
    origin_city: p.origin_city,
    origin_state: p.origin_state,
    origin_zip: p.origin_zip,
    origin_type: p.origin_type,
    destination_address: p.destination_address,
    destination_city: p.destination_city,
    destination_state: p.destination_state,
    destination_zip: p.destination_zip,
    destination_type: p.destination_type,
    chief_complaint: p.chief_complaint,
    primary_impression: p.primary_impression,
    pcs_physician_name: p.pcs_physician_name,
    pcs_physician_npi: p.pcs_physician_npi,
    pcs_certification_date: p.pcs_certification_date,
    pcs_diagnosis: p.pcs_diagnosis,
    auth_number: p.auth_number,
    is_simulated: p.is_simulated,
    status: "ready_to_bill" as const,
    resubmission_count: 0,
  };

  const { data: ins, error: insErr } = await supabase
    .from("claim_records" as any)
    .insert(insertRow as any)
    .select("id")
    .single();
  if (insErr || !ins) return { ok: false, error: insErr?.message || "insert failed" };

  const newId = (ins as any).id as string;

  await supabase
    .from("claim_records" as any)
    .update({ secondary_claim_generated: true, secondary_claim_id: newId } as any)
    .eq("id", primaryClaimId);

  return { ok: true, secondaryClaimId: newId };
}

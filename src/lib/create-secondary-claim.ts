/**
 * createDownstreamClaim
 * ---------------------
 * Spawns a downstream (secondary or tertiary) claim_records row from an
 * existing PAID upstream claim, populating it with the patient's next-level
 * insurance info and linking it back via original_claim_id. The 837P
 * generator picks up that link and emits Loop 2320/2330 (COB) using the
 * upstream claim_payments adjudication.
 *
 * Symmetry:
 *   primary  --paid--> secondary  (uses patient.secondary_*)
 *   secondary --paid--> tertiary  (uses patient.tertiary_*)
 *
 * The DB unique index (claim_records_primary_trip_uidx) only restricts rows
 * where original_claim_id IS NULL, so multiple downstreams legitimately
 * share the trip_id with the primary.
 */
import { supabase } from "@/integrations/supabase/client";

export interface CreateDownstreamClaimResult {
  ok: boolean;
  newClaimId?: string;
  error?: string;
}

/** @deprecated kept for back-compat with existing call sites — use newClaimId */
export interface CreateSecondaryClaimResult extends CreateDownstreamClaimResult {
  secondaryClaimId?: string;
}

type TargetLevel = "secondary" | "tertiary";

export async function createDownstreamClaim(
  upstreamClaimId: string,
  targetLevel: TargetLevel = "secondary",
): Promise<CreateDownstreamClaimResult> {
  if (!upstreamClaimId) return { ok: false, error: "upstream claim id missing" };

  const { data: up, error: upErr } = await supabase
    .from("claim_records" as any)
    .select("*")
    .eq("id", upstreamClaimId)
    .maybeSingle();
  if (upErr || !up) return { ok: false, error: upErr?.message || "upstream claim not found" };
  const p = up as any;

  if (p.status !== "paid" && p.status !== "denied") {
    return { ok: false, error: `upstream must be paid or denied (currently ${p.status})` };
  }

  // Idempotency: pick the chain pointer for the target level
  const generatedFlag = targetLevel === "secondary" ? "secondary_claim_generated" : "tertiary_claim_generated";
  const idPointer    = targetLevel === "secondary" ? "secondary_claim_id"        : "tertiary_claim_id";
  if (p[generatedFlag] && p[idPointer]) {
    return { ok: true, newClaimId: p[idPointer] };
  }
  if (!p.patient_id) {
    return { ok: false, error: `upstream claim is missing patient_id (one-off, no ${targetLevel} lookup possible)` };
  }

  // Downstream claim charges = unpaid balance left on the upstream. We scale
  // base/mileage/extras proportionally so SV1 line charges still sum to CLM02.
  const upTotal = Number(p.total_charge) || 0;
  const patResp = Number(p.patient_responsibility_amount) || 0;
  if (patResp <= 0) {
    return { ok: false, error: `upstream has no patient_responsibility_amount, nothing left for ${targetLevel} to bill` };
  }
  const ratio = upTotal > 0 ? patResp / upTotal : 0;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  let nBase = round2((Number(p.base_charge) || 0) * ratio);
  let nMileage = round2((Number(p.mileage_charge) || 0) * ratio);
  let nExtras = round2((Number(p.extras_charge) || 0) * ratio);
  const drift = round2(patResp - (nBase + nMileage + nExtras));
  if (drift !== 0) nBase = round2(nBase + drift);

  // Pick the right patient payer slot for the target level
  const patientCols =
    targetLevel === "secondary"
      ? "id, secondary_payer, secondary_payer_id, secondary_member_id"
      : "id, tertiary_payer, tertiary_payer_id, tertiary_member_id";
  const { data: pat } = await supabase
    .from("patients")
    .select(patientCols)
    .eq("id", p.patient_id)
    .maybeSingle();
  const patient = pat as any;
  const payerField   = `${targetLevel}_payer`;
  const memberField  = `${targetLevel}_member_id`;
  if (!patient?.[payerField] || !patient?.[memberField]) {
    return { ok: false, error: `patient has no ${targetLevel} payer / member id on file` };
  }

  const newPayerType = String(patient[payerField] || "").toLowerCase();
  const newPayerName =
    newPayerType === "medicare" ? "MEDICARE" :
    newPayerType === "medicaid" ? "MEDICAID" :
    String(patient[payerField]);

  const insertRow = {
    company_id: p.company_id,
    trip_id: p.trip_id,
    patient_id: p.patient_id,
    original_claim_id: p.id,
    run_date: p.run_date,
    payer_type: newPayerType,
    payer_name: newPayerName,
    member_id: patient[memberField],
    total_charge: patResp,
    base_charge: nBase,
    mileage_charge: nMileage,
    extras_charge: nExtras,
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
    .update({ [generatedFlag]: true, [idPointer]: newId } as any)
    .eq("id", upstreamClaimId);

  return { ok: true, newClaimId: newId };
}

/** Spawn a secondary claim from a paid primary. Back-compat wrapper. */
export async function createSecondaryClaim(
  primaryClaimId: string,
): Promise<CreateSecondaryClaimResult> {
  const r = await createDownstreamClaim(primaryClaimId, "secondary");
  return { ...r, secondaryClaimId: r.newClaimId };
}

/** Spawn a tertiary claim from a paid secondary. */
export async function createTertiaryClaim(
  secondaryClaimId: string,
): Promise<CreateDownstreamClaimResult> {
  return createDownstreamClaim(secondaryClaimId, "tertiary");
}

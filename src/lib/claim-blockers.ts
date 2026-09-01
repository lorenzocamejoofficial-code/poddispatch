/**
 * Single source of truth for "what is concretely wrong with this claim".
 *
 * The Billing & Claims card and the Denial Recovery Engine were computing
 * (or, in the engine's case, faking) two different answers for the same
 * claim. Both now call `detectClaimBlockers` so the biller sees one story:
 * the same blocker text, the same deep-link, the same done-state.
 *
 * NOTE: this only wraps the existing `evaluateClaimReadiness` rules. It adds
 * no new validation and touches nothing in the 837P/EDI path.
 */
import { evaluateClaimReadiness, type ReadinessIssue } from "@/lib/claim-readiness";
import { supabase } from "@/integrations/supabase/client";

/** Build the exact ReadinessInputs shape the claim card uses. */
export function buildReadinessInputs(claim: any) {
  return {
    claim: {
      ...(claim as any),
      id: claim.id,
      trip_id: claim.trip_id,
      patient_id: claim.patient_id,
      patient_address:
        claim.patient_address ??
        claim.patient?.pickup_address ??
        claim.leg?.oneoff_pickup_address ??
        claim.origin_address ??
        null,
      is_oneoff: !!claim.leg?.is_oneoff,
      hospice_unrelated_to_terminal: claim.hospice_unrelated_to_terminal ?? false,
    },
    patient: {
      prior_auth_utn: claim.patient_prior_auth_utn ?? null,
      prior_auth_period_start: claim.patient_prior_auth_period_start ?? null,
      prior_auth_period_end: claim.patient_prior_auth_period_end ?? null,
      standing_order: claim.patient_standing_order ?? null,
      recurrence_days: claim.patient_recurrence_days ?? null,
      hospice_enrolled: claim.patient_hospice_enrolled ?? null,
      hospice_election_date: claim.patient_hospice_election_date ?? null,
      terminal_illness_icd: claim.patient_terminal_illness_icd ?? null,
      pcs_on_file: claim.pcs_on_file ?? null,
      pcs_signed_date: claim.patient_pcs_signed_date ?? null,
      pcs_expiration_date: claim.patient_pcs_expiration_date ?? null,
    },

  };
}

/** Hard blockers only — soft warnings stay out of the biller queue. */
export function detectClaimBlockers(claim: any): ReadinessIssue[] {
  if (!claim) return [];
  return evaluateClaimReadiness(buildReadinessInputs(claim)).filter(
    (i) => i.severity === "block",
  );
}

/**
 * Re-read a single claim (plus the patient/trip context the card enriches it
 * with) straight from the database and re-run blocker detection.
 *
 * Used by the Denial Recovery Engine so that fixing a field in the patient
 * chart / trip / PCS panel and coming back clears the blocker here — no stale
 * cached row. RLS does the tenant scoping; no company filter is added client
 * side beyond what the policies already enforce.
 */
export async function fetchClaimBlockerSnapshot(
  claimId: string,
): Promise<{ claim: any | null; blockers: ReadinessIssue[]; ok: boolean }> {
  const { data: claimRow, error: claimErr } = await supabase
    .from("claim_records" as any)
    .select("*")
    .eq("id", claimId)
    .maybeSingle();

  // An empty blocker list is the signal for "clean" — so a read we could not
  // complete (RLS denial, network blip, row gone) must NOT look clean.
  if (claimErr || !claimRow) return { claim: null, blockers: [], ok: false };
  const c: any = claimRow;


  const [{ data: pat }, { data: trip }] = await Promise.all([
    c.patient_id
      ? supabase
          .from("patients")
          .select(
            "id, first_name, last_name, dob, sex, primary_payer, member_id, pickup_address, pcs_on_file, pcs_signed_date, pcs_expiration_date, prior_auth_utn, prior_auth_period_start, prior_auth_period_end, standing_order, recurrence_days, hospice_enrolled, hospice_election_date, terminal_illness_icd",
          )

          .eq("id", c.patient_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    c.trip_id
      ? supabase
          .from("trip_records" as any)
          .select(
            "id, loaded_miles, signature_obtained, pcs_attached, origin_type, destination_type, loaded_at, dropped_at, trip_type, patient_mobility, stretcher_placement, odometer_at_destination, leg:scheduling_legs!trip_records_leg_id_fkey(is_oneoff, oneoff_name, oneoff_pickup_address)",
          )
          .eq("id", c.trip_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const p: any = pat;
  const t: any = trip;

  const enriched = {
    ...c,
    patient_name:
      p ? `${p.first_name} ${p.last_name}` : (t?.leg?.is_oneoff ? t.leg.oneoff_name : null) ?? "Unknown",
    patient_dob: c.patient_dob ?? p?.dob ?? null,
    patient_sex: c.patient_sex ?? p?.sex ?? null,
    patient_address: p?.pickup_address ?? t?.leg?.oneoff_pickup_address ?? null,
    member_id: c.member_id ?? p?.member_id ?? null,
    payer_name: c.payer_name ?? p?.primary_payer ?? c.payer_type ?? null,
    origin_type: c.origin_type ?? t?.origin_type ?? null,
    destination_type: c.destination_type ?? t?.destination_type ?? null,
    stretcher_placement: c.stretcher_placement ?? t?.stretcher_placement ?? null,
    patient_mobility: c.patient_mobility ?? t?.patient_mobility ?? null,
    trip_type: t?.trip_type ?? c.payer_type ?? null,
    leg: t?.leg ?? null,
    pcs_on_file: c.pcs_on_file ?? !!p?.pcs_on_file,
    patient_prior_auth_utn: p?.prior_auth_utn ?? null,
    patient_prior_auth_period_start: p?.prior_auth_period_start ?? null,
    patient_prior_auth_period_end: p?.prior_auth_period_end ?? null,
    patient_pcs_signed_date: p?.pcs_signed_date ?? null,
    patient_pcs_expiration_date: p?.pcs_expiration_date ?? null,

    patient_standing_order: p?.standing_order ?? null,
    patient_recurrence_days: p?.recurrence_days ?? null,
    patient_hospice_enrolled: p?.hospice_enrolled ?? false,
    patient_hospice_election_date: p?.hospice_election_date ?? null,
    patient_terminal_illness_icd: p?.terminal_illness_icd ?? null,
  };

  return { claim: enriched, blockers: detectClaimBlockers(enriched) };
}

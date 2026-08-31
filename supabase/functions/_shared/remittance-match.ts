// GENERATED FILE — DO NOT EDIT.
// Source of truth: src/lib/remittance-match.ts — regenerate with scripts/sync-billing-to-edge.sh
/**
 * Shared 835 → claim matching.
 *
 * ONE implementation used by BOTH remittance ingestion paths:
 *   - manual upload  (src/pages/RemittanceImport.tsx)
 *   - automated pull (supabase/functions/retrieve-remittance-officeally)
 *
 * The edge function consumes a generated copy under
 * supabase/functions/_shared/ produced by scripts/sync-billing-to-edge.sh.
 * Edit THIS file only.
 *
 * Precedence ladder (first hit wins):
 *   1. payer_claim_control_number equality (CLP07) — set on a prior remittance
 *   2. CLP01 patient control number → claim id prefix
 *   3. member id + date of service, with charge-amount tiebreak on multiples
 */

import { parsePatientControlNumber } from "./edi-835-parser.ts";

export interface MatchCandidateClaim {
  id: string;
  patient_id?: string | null;
  member_id?: string | null;
  run_date?: string | null;
  total_charge?: number | null;
  payer_claim_control_number?: string | null;
}

export interface MatchableRemittance {
  patient_control_number: string;
  payer_claim_control_number: string;
  patient_member_id: string;
  date_of_service: string;
  charged_amount: number;
}

export interface RemittanceMatchResult {
  matchedClaimId: string | null;
  matchedPatientId: string | null;
  matchedBy: "payer_control_number" | "patient_control_number" | "member_and_dos" | null;
  errors: string[];
}

export function matchRemittanceClaim(
  rem: MatchableRemittance,
  claims: MatchCandidateClaim[],
): RemittanceMatchResult {
  const errors: string[] = [];
  let matchedClaimId: string | null = null;
  let matchedPatientId: string | null = null;
  let matchedBy: RemittanceMatchResult["matchedBy"] = null;

  // 1. Payer claim control number (CLP07)
  const pccn = (rem.payer_claim_control_number || "").trim();
  if (pccn) {
    const hit = claims.find(
      (c) => (c.payer_claim_control_number || "").trim() === pccn,
    );
    if (hit) {
      matchedClaimId = hit.id;
      matchedPatientId = hit.patient_id ?? null;
      matchedBy = "payer_control_number";
    }
  }

  // 2. CLP01 patient control number → claim id prefix
  if (!matchedClaimId) {
    const pcn = parsePatientControlNumber(rem.patient_control_number);
    if (pcn) {
      const candidate = claims.find((c) => {
        const cId = (c.id || "").replace(/-/g, "").slice(0, 8).toLowerCase();
        return cId === pcn.idPrefix;
      });
      if (candidate) {
        matchedClaimId = candidate.id;
        matchedPatientId = candidate.patient_id ?? null;
        matchedBy = "patient_control_number";
      }
    }
  }

  // 3. Member id + date of service
  if (!matchedClaimId) {
    const remMemberId = rem.patient_member_id?.trim().toUpperCase();
    const remDate = rem.date_of_service;
    if (remMemberId && remDate) {
      const cand = claims.filter(
        (c) =>
          (c.member_id || "").trim().toUpperCase() === remMemberId &&
          c.run_date === remDate,
      );
      if (cand.length === 1) {
        matchedClaimId = cand[0].id;
        matchedPatientId = cand[0].patient_id ?? null;
        matchedBy = "member_and_dos";
      } else if (cand.length > 1) {
        const exact = cand.find(
          (c) => Math.abs((c.total_charge || 0) - rem.charged_amount) < 0.01,
        );
        if (exact) {
          matchedClaimId = exact.id;
          matchedPatientId = exact.patient_id ?? null;
        } else {
          matchedClaimId = cand[0].id;
          matchedPatientId = cand[0].patient_id ?? null;
          errors.push("Multiple claims matched — used first");
        }
        matchedBy = "member_and_dos";
      }
    }
  }

  if (!matchedClaimId) errors.push("No matching claim found");

  return { matchedClaimId, matchedPatientId, matchedBy, errors };
}

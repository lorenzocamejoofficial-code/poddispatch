/**
 * Shared 835 → claim_payments row builder.
 *
 * ONE implementation used by BOTH remittance ingestion paths (manual upload
 * and the automated Office Ally pull) so the two can never drift. The edge
 * function consumes a generated copy under supabase/functions/_shared/
 * produced by scripts/sync-billing-to-edge.sh. Edit THIS file only.
 *
 * The row this builds is the ONLY thing either path writes for a matched
 * claim — public.recompute_claim_from_payments derives every claim_records
 * field (amount_paid, patient_responsibility_amount, write_off_amount,
 * allowed_amount, denial_code, denial_reason, denial_category, paid_at,
 * remittance_date, adjustment_codes, status) from the payment ledger.
 * Neither path may write claim_records.status directly.
 */

import {
  extractCO45WriteOff,
  getPrimaryDenialCode,
  mapToEventType,
  type ParsedRemittanceItem,
} from "./edi-835-parser";
import { getDenialTranslation } from "./denial-code-translations";
import { capPatientResponsibility, type PRCapResult } from "./payer-compliance";

export interface ClaimPaymentRow {
  claim_record_id: string;
  company_id: string;
  event_type: string;
  clp_status_code: string;
  amount: number;
  patient_responsibility: number;
  write_off: number;
  allowed_amount: number;
  denial_code: string | null;
  denial_reason: string | null;
  adjustment_codes: string[];
  cas_adjustments: unknown;
  payer_claim_control_number: string | null;
  remittance_file_id: string | null;
  payment_date: string | null;
  is_simulated: boolean;
}

export interface BuildPaymentRowContext {
  claimRecordId: string;
  companyId: string;
  remittanceFileId: string | null;
  primaryPayer: string | null;
  secondaryPayer: string | null;
  envelopePaymentDate?: string | null;
  isSimulated: boolean;
}

/** CLP status codes that represent a denial for denial_reason purposes. */
const DENIAL_STATUS_CODES = new Set(["4", "11", "23"]);

export function buildClaimPaymentRow(
  rem: ParsedRemittanceItem,
  ctx: BuildPaymentRowContext,
): { row: ClaimPaymentRow; prCap: PRCapResult } {
  const co45 = extractCO45WriteOff(rem.adjustment_groups);
  const primaryDenial = getPrimaryDenialCode(rem.adjustment_groups);
  const rawPrAmount = rem.adjustment_groups
    .filter((a) => a.group_code === "PR")
    .reduce((sum, a) => sum + a.amount, 0);
  const prCap = capPatientResponsibility(rawPrAmount, ctx.primaryPayer, ctx.secondaryPayer);
  const eventType = mapToEventType(rem.claim_status_code);
  const translation = primaryDenial ? getDenialTranslation(primaryDenial.code) : null;
  const denialReason =
    primaryDenial && (eventType === "adjustment" || DENIAL_STATUS_CODES.has(rem.claim_status_code))
      ? translation?.plain_english_explanation ?? primaryDenial.code
      : null;

  return {
    prCap,
    row: {
      claim_record_id: ctx.claimRecordId,
      company_id: ctx.companyId,
      event_type: eventType,
      clp_status_code: rem.claim_status_code,
      amount: rem.paid_amount, // already signed (negative for reversals)
      patient_responsibility: prCap.capped,
      write_off: co45,
      allowed_amount: rem.charged_amount - co45,
      denial_code: primaryDenial?.code ?? null,
      denial_reason: denialReason,
      adjustment_codes: rem.raw_denial_codes,
      cas_adjustments: rem.adjustment_groups,
      payer_claim_control_number: rem.payer_claim_control_number || null,
      remittance_file_id: ctx.remittanceFileId,
      payment_date: rem.payment_date || ctx.envelopePaymentDate || null,
      is_simulated: ctx.isSimulated,
    },
  };
}

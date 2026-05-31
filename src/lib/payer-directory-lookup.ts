/**
 * Payer Directory Lookup
 * ----------------------
 * Resolves a claim's payer to a real Office Ally payer ID for use in
 * 837P Loop 2010BB NM109 (and Loop 2330B for secondary).
 *
 * Resolution order, per company:
 *   1. Exact match on `oa_payer_id` (case-insensitive) — caller already knows the ID.
 *   2. Case-insensitive match on `payer_name`.
 *   3. Match on `payer_type` (medicare / medicaid / commercial / facility / other)
 *      — only when exactly one directory row exists for that type in the company.
 *
 * If no row resolves OR the matched row has no `oa_payer_id`, returns
 * { ok: false, reason: ... }. Callers MUST treat that as a hard block
 * (blocked_payer_mapping) and never silently fall back to a payer-name string.
 */

import { supabase } from "@/integrations/supabase/client";

export type PayerDirectoryRow = {
  id: string;
  company_id: string;
  payer_name: string;
  payer_type: string | null;
  oa_payer_id: string | null;
  claim_filing_indicator: string | null;
};

export type PayerResolution =
  | {
      ok: true;
      directory_id: string;
      oa_payer_id: string;
      payer_name: string;
      payer_type: string | null;
      /** X12 SBR09 claim filing indicator from payer_directory.
       *  MUST be projected onto ClaimForEDI.claim_filing_indicator and
       *  ClaimCobInfo.claim_filing_indicator by every caller — the generator
       *  rejects emissions that don't carry it. */
      claim_filing_indicator: string;
      match_strategy: "oa_payer_id" | "payer_name" | "payer_type_unique";
    }
  | {
      ok: false;
      reason:
        | "no_directory_match"
        | "directory_row_missing_oa_payer_id"
        | "missing_claim_filing_indicator"
        | "ambiguous_payer_type"
        | "missing_inputs";
      detail?: string;
    };

export interface ResolveInput {
  company_id: string;
  payer_name?: string | null;
  payer_type?: string | null;
  /** If already known (e.g. from prior resolution), short-circuits the lookup. */
  oa_payer_id?: string | null;
}

/**
 * Resolve a payer for a single claim. Read-only — never mutates the directory.
 */
export async function resolvePayerForClaim(input: ResolveInput): Promise<PayerResolution> {
  const { company_id } = input;
  const payerName = (input.payer_name ?? "").trim();
  const payerType = (input.payer_type ?? "").trim().toLowerCase();
  const oaId = (input.oa_payer_id ?? "").trim();

  if (!company_id) {
    return { ok: false, reason: "missing_inputs", detail: "company_id is required" };
  }
  if (!payerName && !payerType && !oaId) {
    return {
      ok: false,
      reason: "missing_inputs",
      detail: "at least one of payer_name, payer_type, or oa_payer_id is required",
    };
  }

  // 1. Direct OA payer ID match.
  if (oaId) {
    const { data, error } = await supabase
      .from("payer_directory")
      .select("id, company_id, payer_name, payer_type, oa_payer_id, claim_filing_indicator")
      .eq("company_id", company_id)
      .ilike("oa_payer_id", oaId)
      .limit(1)
      .maybeSingle();
    if (!error && data && data.oa_payer_id) {
      if (!data.claim_filing_indicator) {
        return {
          ok: false,
          reason: "missing_claim_filing_indicator",
          detail: `Directory row "${data.payer_name}" missing X12 SBR09 code (claim_filing_indicator)`,
        };
      }
      return {
        ok: true,
        directory_id: data.id,
        oa_payer_id: data.oa_payer_id,
        payer_name: data.payer_name,
        payer_type: data.payer_type,
        claim_filing_indicator: data.claim_filing_indicator,
        match_strategy: "oa_payer_id",
      };
    }
  }

  // 2. Payer name match (case-insensitive exact).
  if (payerName) {
    const { data, error } = await supabase
      .from("payer_directory")
      .select("id, company_id, payer_name, payer_type, oa_payer_id, claim_filing_indicator")
      .eq("company_id", company_id)
      .ilike("payer_name", payerName)
      .limit(1)
      .maybeSingle();
    if (!error && data) {
      if (!data.oa_payer_id) {
        return {
          ok: false,
          reason: "directory_row_missing_oa_payer_id",
          detail: `Directory row "${data.payer_name}" has no oa_payer_id configured`,
        };
      }
      if (!data.claim_filing_indicator) {
        return {
          ok: false,
          reason: "missing_claim_filing_indicator",
          detail: `Directory row "${data.payer_name}" missing X12 SBR09 code (claim_filing_indicator)`,
        };
      }
      return {
        ok: true,
        directory_id: data.id,
        oa_payer_id: data.oa_payer_id,
        payer_name: data.payer_name,
        payer_type: data.payer_type,
        claim_filing_indicator: data.claim_filing_indicator,
        match_strategy: "payer_name",
      };
    }
  }

  // 3. Payer type match — ONLY when exactly one row exists for that type.
  //    Prevents accidental mis-routing when a company has multiple commercial payers.
  if (payerType) {
    const { data, error } = await supabase
      .from("payer_directory")
      .select("id, company_id, payer_name, payer_type, oa_payer_id, claim_filing_indicator")
      .eq("company_id", company_id)
      .eq("payer_type", payerType)
      .limit(2);
    if (!error && data && data.length === 1) {
      const row = data[0];
      if (!row.oa_payer_id) {
        return {
          ok: false,
          reason: "directory_row_missing_oa_payer_id",
          detail: `Directory row "${row.payer_name}" has no oa_payer_id configured`,
        };
      }
      if (!row.claim_filing_indicator) {
        return {
          ok: false,
          reason: "missing_claim_filing_indicator",
          detail: `Directory row "${row.payer_name}" missing X12 SBR09 code (claim_filing_indicator)`,
        };
      }
      return {
        ok: true,
        directory_id: row.id,
        oa_payer_id: row.oa_payer_id,
        payer_name: row.payer_name,
        payer_type: row.payer_type,
        claim_filing_indicator: row.claim_filing_indicator,
        match_strategy: "payer_type_unique",
      };
    }
    if (!error && data && data.length > 1) {
      return {
        ok: false,
        reason: "ambiguous_payer_type",
        detail: `Multiple directory rows match payer_type="${payerType}", cannot disambiguate without payer_name`,
      };
    }
  }

  return {
    ok: false,
    reason: "no_directory_match",
    detail: `No payer_directory row found for company=${company_id} name="${payerName}" type="${payerType}" oa_id="${oaId}"`,
  };
}

/**
 * Provider-agnostic coverage checks (eligibility + coverage discovery).
 *
 * PHI: inputs and results are patient coverage data. Never log them, never put
 * them in URLs. Callers store results in `coverage_checks` only; results are
 * NEVER auto-applied to billing — a person confirms each one in the UI.
 *
 * HOW TO SWITCH A COMPANY TO OFFICE ALLY (exactly 3 steps):
 *   1. Implement the adapter mapping in `OfficeAllyProvider` below: build the
 *      270 request / discovery request from `CoverageCheckInput`, and map the
 *      271 + discovery responses into `EligibilityResult` / `DiscoveryResult`.
 *   2. Add the Office Ally credentials as build secrets (e.g.
 *      OFFICE_ALLY_ELIGIBILITY_USERNAME / OFFICE_ALLY_ELIGIBILITY_PASSWORD and
 *      the endpoint URL) and read them with Deno.env inside the adapter.
 *   3. Flip the flag: set `company_settings.coverage_provider = 'office_ally'`
 *      for that company.
 */

export type CoverageSource = "stub" | "office_ally";
export type CobOrder = "primary" | "secondary" | "unknown";
export type Confidence = "high" | "medium" | "low" | null;

export interface CoverageCheckInput {
  patient_id: string;
  first_name: string | null;
  last_name: string | null;
  dob: string | null;
  primary_payer: string | null;
  member_id: string | null;
}

interface BaseResult {
  source: CoverageSource;
  payer_name: string | null;
  payer_member_id: string | null;
  group_number: string | null;
  payer_id: string | null;
  plan_name: string | null;
  coverage_start: string | null;
  coverage_end: string | null;
  implied_cob_order: CobOrder;
  confidence: Confidence;
  raw_response: Record<string, unknown> | null;
}
export interface EligibilityResult extends BaseResult {
  check_type: "eligibility";
  status: "active" | "inactive" | "unknown";
}
export interface DiscoveryResult extends BaseResult {
  check_type: "discovery";
  status: "coverage_found" | "none";
}

export interface CoverageProvider {
  readonly source: CoverageSource;
  checkEligibility(patient: CoverageCheckInput): Promise<EligibilityResult>;
  discoverCoverage(patient: CoverageCheckInput): Promise<DiscoveryResult>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(source: CoverageSource) {
    super(`Coverage provider '${source}' is not configured`);
    this.name = "ProviderNotConfiguredError";
  }
}

/** Stable small hash of the patient id (not PHI) for deterministic samples. */
function seed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

const SAMPLE_NOTE = "SAMPLE result from the stub provider — not a real payer response.";

/** Deterministic, clearly-labeled SAMPLE results. Makes no network calls. */
export class StubProvider implements CoverageProvider {
  readonly source = "stub" as const;

  async checkEligibility(patient: CoverageCheckInput): Promise<EligibilityResult> {
    const hasPayer = !!(patient.primary_payer && patient.member_id);
    return {
      check_type: "eligibility",
      source: "stub",
      status: hasPayer ? "active" : "unknown",
      payer_name: hasPayer ? `SAMPLE — ${patient.primary_payer}` : null,
      payer_member_id: null,
      group_number: hasPayer ? "SAMPLE-GROUP-001" : null,
      payer_id: hasPayer ? "SAMPLE-PAYER-001" : null,
      plan_name: hasPayer ? "SAMPLE Plan" : null,
      coverage_start: hasPayer ? "2026-01-01" : null,
      coverage_end: hasPayer ? "2026-12-31" : null,
      implied_cob_order: hasPayer ? "primary" : "unknown",
      confidence: hasPayer ? "high" : "low",
      raw_response: { sample: true, note: SAMPLE_NOTE },
    };
  }

  async discoverCoverage(patient: CoverageCheckInput): Promise<DiscoveryResult> {
    const n = seed(patient.patient_id) % 100000;
    return {
      check_type: "discovery",
      source: "stub",
      status: "coverage_found",
      payer_name: "SAMPLE Blue Cross Blue Shield of Georgia",
      payer_member_id: `SAMPLE${String(n).padStart(5, "0")}`,
      group_number: "SAMPLE-GROUP-002",
      payer_id: "SAMPLE-PAYER-002",
      plan_name: "SAMPLE Medicare Supplement Plan G",
      coverage_start: "2026-01-01",
      coverage_end: null,
      implied_cob_order: "secondary",
      confidence: "medium",
      raw_response: { sample: true, note: SAMPLE_NOTE },
    };
  }
}

/**
 * Office Ally seam. Implements the same interface but is intentionally NOT
 * wired to any endpoint. TODO(office-ally): see step 1–2 in the header.
 * Credentials go in build secrets; 270/271 + discovery mapping goes here.
 */
export class OfficeAllyProvider implements CoverageProvider {
  readonly source = "office_ally" as const;
  checkEligibility(_patient: CoverageCheckInput): Promise<EligibilityResult> {
    // TODO(office-ally): send 270, map 271 → EligibilityResult.
    return Promise.reject(new ProviderNotConfiguredError("office_ally"));
  }
  discoverCoverage(_patient: CoverageCheckInput): Promise<DiscoveryResult> {
    // TODO(office-ally): send discovery request, map response → DiscoveryResult.
    return Promise.reject(new ProviderNotConfiguredError("office_ally"));
  }
}

/** Per-company flag → provider. Anything unknown falls back to the stub. */
export function selectCoverageProvider(flag: string | null | undefined): CoverageProvider {
  return flag === "office_ally" ? new OfficeAllyProvider() : new StubProvider();
}

/** Shape of the coverage_checks row written for a result. */
export function toCoverageCheckRow(
  companyId: string,
  patientId: string,
  r: EligibilityResult | DiscoveryResult,
  checkedAt: string,
) {
  return {
    company_id: companyId,
    patient_id: patientId,
    check_type: r.check_type,
    source: r.source,
    status: r.status,
    payer_name: r.payer_name,
    payer_member_id: r.payer_member_id,
    group_number: r.group_number,
    payer_id: r.payer_id,
    plan_name: r.plan_name,
    coverage_start: r.coverage_start,
    coverage_end: r.coverage_end,
    implied_cob_order: r.implied_cob_order,
    confidence: r.confidence,
    raw_response: r.raw_response,
    checked_at: checkedAt,
    reviewed: false,
  };
}

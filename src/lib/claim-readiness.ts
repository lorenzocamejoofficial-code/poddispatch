/**
 * Single source of truth for claim readiness.
 *
 * Replaces / consolidates ad-hoc validation that previously lived in:
 *   - src/pages/Scheduling.tsx handleCreate()
 *   - src/lib/pcr-field-requirements.ts getRequiredFieldsForCard()
 *   - src/lib/edi-837p-generator.ts validateClaimForEDI()
 *
 * The existing exports stay; they now delegate to evaluateClaimReadiness so
 * behavior at the export gate is unchanged.
 */
import { parseAddressString, timelyFilingDays, type ClaimForEDI } from "./edi-837p-generator";
import type { PayerResolution } from "./payer-directory-lookup";
import { locationTypeCode } from "./ambulance-modifier";

export type ReadinessStage = "scheduling" | "pcr" | "biller" | "export";
export type ReadinessSeverity = "block" | "warn";

export interface ReadinessIssue {
  field: string;
  severity: ReadinessSeverity;
  stage: ReadinessStage;
  message: string;
  fixPath?: string;
  fixLabel?: string;
}

export interface ReadinessInputs {
  claim: Partial<ClaimForEDI> & {
    id?: string;
    patient_id?: string | null;
    trip_id?: string | null;
    patient_pickup_address?: string | null;
    /** True when the trip's pickup address comes from the scheduling leg
     *  (one-off run) rather than a patient record. Drives ZIP fix routing. */
    is_oneoff?: boolean | null;
    /** Biller confirmation that this hospice patient's transport is
     *  unrelated to the terminal illness — clears the Medicare-vs-hospice
     *  block (Rule 3a). */
    hospice_unrelated_to_terminal?: boolean | null;
  };
  billingState?: string | null;
  /**
   * Result of resolvePayerForClaim() for this claim, computed upstream by the
   * queue layer (see queue-claims-for-submission.ts). When present, drives the
   * payer-directory readiness gate — a failed resolution becomes a hard block
   * BEFORE EDI generation. evaluateClaimReadiness stays synchronous; the async
   * resolve happens in the queue path that already has to await Supabase.
   */
  payerResolution?: PayerResolution;
  /** Optional patient-record context for biller-stage pre-submission checks
   *  (RSNAT prior auth, future hospice rules). Additive — when omitted,
   *  patient-derived biller checks are skipped (no behavior change for
   *  callers that haven't migrated). */
  patient?: {
    prior_auth_utn?: string | null;
    prior_auth_period_end?: string | null;
    standing_order?: boolean | null;
    recurrence_days?: number[] | null;
    hospice_enrolled?: boolean | null;
    hospice_election_date?: string | null;
    terminal_illness_icd?: string | null;
  } | null;
  /** Optional transport / scheduling context for biller-stage checks.
   *  destination_facility_type is the resolved facilities.facility_type
   *  (e.g. "dialysis") for the destination of this run. */
  transport?: {
    destination_facility_type?: string | null;
    standing_order?: boolean | null;
    recurrence_days?: number[] | null;
  } | null;
}

/** True when a Medicare transport meets the RSNAT (Repetitive Scheduled
 *  Non-emergent) criteria that require prior authorization per CMS:
 *  Medicare payer AND (destination is a dialysis facility OR scheduled
 *  standing order OR recurring ≥3 times per week). The Medicare gate is
 *  required — non-Medicare standing orders never fire RSNAT. */
export function isRsnatTransport(
  claim: ReadinessInputs["claim"],
  patient?: ReadinessInputs["patient"],
  transport?: ReadinessInputs["transport"],
): boolean {
  const payerType = String(claim.payer_type ?? "").toLowerCase();
  const payerName = String(claim.payer_name ?? "").toLowerCase();
  const isMedicare = payerType === "medicare" || payerName.includes("medicare");
  if (!isMedicare) return false;

  const destFacType =
    String(
      transport?.destination_facility_type ??
        claim.destination_facility_meta?.facility_type ??
        "",
    ).toLowerCase();
  const isDialysisDest = destFacType === "dialysis";

  const standingOrder =
    transport?.standing_order === true || patient?.standing_order === true;

  const recurrence =
    transport?.recurrence_days ?? patient?.recurrence_days ?? [];
  const recurringHeavy = Array.isArray(recurrence) && recurrence.length >= 3;

  return isDialysisDest || standingOrder || recurringHeavy;
}

function splitName(name: string): { last: string; first: string } {
  const trimmed = (name || "").trim();
  if (!trimmed) return { last: "UNKNOWN", first: "UNKNOWN" };
  if (trimmed.includes(",")) {
    const [last, first] = trimmed.split(",").map((s) => s.trim());
    return { last: last || "UNKNOWN", first: first || "UNKNOWN" };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { last: parts[0], first: "UNKNOWN" };
  return { last: parts[parts.length - 1], first: parts.slice(0, -1).join(" ") };
}

export function evaluateClaimReadiness(inputs: ReadinessInputs): ReadinessIssue[] {
  const { claim, billingState } = inputs;
  const issues: ReadinessIssue[] = [];
  // Patients page lives at /patients (no :id segment). We pass the id as a
  // query param so the page can auto-open the editor for the right record.
  const patientPath = claim.patient_id ? `/patients?patientId=${claim.patient_id}` : "/patients";
  const tripPath = claim.trip_id ? `/pcr?tripId=${claim.trip_id}` : null;
  const claimPath = claim.id ? `/billing?claimId=${claim.id}` : "/billing";

  // Build a patient fix URL that merges the patientId param with a focus key.
  const patientFix = (focus: string) =>
    claim.patient_id
      ? `/patients?patientId=${claim.patient_id}&focus=${focus}`
      : `/patients?focus=${focus}`;

  const push = (i: Omit<ReadinessIssue, "stage"> & { stage?: ReadinessStage }) =>
    issues.push({ stage: "export", ...i });

  // Member ID
  const mid = String(claim.member_id ?? "").trim();
  if (!mid || mid.toUpperCase() === "UNKNOWN") {
    push({
      field: "member_id", severity: "block",
      message: "Missing member ID",
      fixPath: patientFix("member_id"),
      fixLabel: "Fix in patient chart",
    });
  }

  // Service date
  if (!claim.run_date) {
    push({ field: "run_date", severity: "block", message: "Missing service date" });
  }

  // Total charge
  if (!claim.total_charge || claim.total_charge <= 0) {
    push({
      field: "total_charge", severity: "block",
      message: "Invalid charge amount",
      fixPath: `${claimPath}&focus=charges`,
      fixLabel: "Fix in claim",
    });
  }

  // HCPCS
  if (!claim.hcpcs_codes?.length) {
    push({
      field: "hcpcs_codes", severity: "block",
      message: "Missing HCPCS codes",
      fixPath: `${claimPath}&focus=hcpcs`,
      fixLabel: "Fix in claim",
    });
  }

  // Payer info — directory-backed. Upstream (queue layer) calls
  // resolvePayerForClaim() and forwards the result. A claim with no payer
  // identifiers at all is still a basic-data block; a claim whose payer is
  // not in the directory is a payer-mapping block. Either way we never let a
  // claim reach the generator without a real OA payer ID.
  if (!claim.payer_name && !claim.payer_id) {
    push({
      field: "payer_name", severity: "block",
      message: "Missing payer information",
      fixPath: patientFix("primary_payer"),
      fixLabel: "Fix in patient chart",
    });
  } else if (inputs.payerResolution && inputs.payerResolution.ok === false) {
    const r = inputs.payerResolution;
    push({
      field: "payer_name", severity: "block",
      message: `Payer not in directory: ${r.reason}${r.detail ? ` - ${r.detail}` : ""}`,
      fixPath: "/billing-settings?tab=payer-directory",
      fixLabel: "Open payer directory",
    });
  }

  // ICD-10
  const allDiag = [...(claim.icd10_codes || []), ...(claim.diagnosis_codes || [])].filter(Boolean);
  if (allDiag.length === 0) {
    push({
      field: "icd10_codes", severity: "block",
      message: "ICD-10 code required, enter code from PCR",
      fixPath: tripPath ? `${tripPath}&focus=icd10` : patientFix("icd10"),
      fixLabel: tripPath ? "Fix in PCR" : "Fix in patient chart",
    });
  }

  // Patient name
  const { last, first } = splitName(claim.patient_name || "");
  if (!claim.patient_name?.trim() || last === "UNKNOWN" || first === "UNKNOWN") {
    push({
      field: "patient_name", severity: "block",
      message: "Missing patient first or last name",
      fixPath: patientFix("name"),
      fixLabel: "Fix in patient chart",
    });
  }

  // DOB
  const dob = (claim.patient_dob || "").trim();
  if (!dob || dob === "1900-01-01" || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    push({
      field: "patient_dob", severity: "block",
      message: "Missing patient date of birth",
      fixPath: patientFix("dob"),
      fixLabel: "Fix in patient chart",
    });
  }

  // Sex
  const sex = (claim.patient_sex || "").toUpperCase();
  if (sex !== "M" && sex !== "F" && sex !== "MALE" && sex !== "FEMALE") {
    push({
      field: "patient_sex", severity: "block",
      message: "Missing patient sex",
      fixPath: patientFix("sex"),
      fixLabel: "Fix in patient chart",
    });
  }

  // Address
  const parsed = parseAddressString(claim.patient_address ?? claim.patient_pickup_address ?? "");
  const street = (claim.patient_address ?? "").trim() || parsed.street;
  const city = (claim.patient_city ?? "").trim() || parsed.city;
  const zip = (claim.patient_zip ?? "").trim() || parsed.zip;
  if (!street.trim() || !city.trim() || !zip.trim()) {
    push({
      field: "patient_address", severity: "block",
      message: "Patient address incomplete, update patient record before submitting.",
      fixPath: patientFix("address"),
      fixLabel: "Fix in patient chart",
    });
  }

  // Timely filing
  if (claim.run_date && /^\d{4}-\d{2}-\d{2}$/.test(claim.run_date)) {
    const limit = timelyFilingDays(claim.payer_type, billingState ?? null);
    const dos = new Date(claim.run_date + "T00:00:00");
    const deadline = new Date(dos.getTime() + limit * 24 * 60 * 60 * 1000);
    if (Date.now() > deadline.getTime()) {
      const daysOver = Math.floor((Date.now() - deadline.getTime()) / (1000 * 60 * 60 * 24));
      push({
        field: "timely_filing", severity: "block",
        message: `Timely filing deadline passed. DOS ${claim.run_date} is ${daysOver} days past the ${limit}-day limit for ${claim.payer_type ?? "payer"}.`,
      });
    }
  }

  // Origin/Destination type
  if (!claim.origin_type || !String(claim.origin_type).trim()) {
    push({
      field: "origin_type", severity: "block",
      message: "Missing origin type, required for ambulance origin/destination modifier.",
      fixPath: tripPath ? `${tripPath}&focus=origin_type` : undefined,
      fixLabel: tripPath ? "Fix in PCR" : undefined,
    });
  }
  if (!claim.destination_type || !String(claim.destination_type).trim()) {
    push({
      field: "destination_type", severity: "block",
      message: "Missing destination type, required for ambulance origin/destination modifier.",
      fixPath: tripPath ? `${tripPath}&focus=destination_type` : undefined,
      fixLabel: tripPath ? "Fix in PCR" : undefined,
    });
  }

  // Pickup ZIP
  const pickupZip = (claim.origin_zip ?? "").trim();
  if (!pickupZip || !/^\d{5}(?:-?\d{4})?$/.test(pickupZip)) {
    // Routing: recurring patient run → patient chart owns the pickup address.
    // One-off run (no patient_id, or scheduling leg is_oneoff) → PCR/trip edit.
    const isOneoff = !!claim.is_oneoff || !claim.patient_id;
    const zipFixPath = isOneoff
      ? (tripPath ? `${tripPath}&focus=origin_zip` : undefined)
      : patientFix("address");
    const zipFixLabel = isOneoff
      ? (tripPath ? "Fix in PCR" : undefined)
      : "Fix in patient chart";
    push({
      field: "origin_zip", severity: "block",
      message: "Missing or invalid pickup ZIP, required for Loop 2310E (Medicare GPCI lookup).",
      fixPath: zipFixPath,
      fixLabel: zipFixLabel,
    });
  }

  // ---- Biller-stage pre-submission checks (additive) ----------------------

  // Rule 5 — PCS certification date required when PCS is on file (or the
  // transport type requires PCS). Emergency transports never need PCS.
  const transportType = String(claim.payer_type ? "" : "").toLowerCase();
  // Note: claim.payer_type is the payer class; PCS requirement is driven by
  // claim.pcs_on_file (set by biller / patient record). We treat pcs_on_file
  // === true as the explicit assertion that PCS is required for this claim.
  if (claim.pcs_on_file === true) {
    const certDate = String(claim.pcs_certification_date ?? "").trim();
    if (!certDate) {
      issues.push({
        field: "pcs_certification_date",
        severity: "block",
        stage: "biller",
        message: "PCS certification date missing",
        fixPath: claim.id ? `/billing?claimId=${claim.id}&focus=pcs` : "/billing?focus=pcs",
        fixLabel: "Open PCS panel",
      });
    }
  }

  // Rule 4 — Stretcher claims need a secondary diagnosis supporting
  // bed-confinement. If stretcher_placement is set and not "ambulatory",
  // require at least 2 ICD-10 codes.
  const stretcher = String(claim.stretcher_placement ?? "").trim().toLowerCase();
  if (stretcher && stretcher !== "ambulatory" && stretcher !== "none") {
    const codes = [
      ...(claim.icd10_codes || []),
      ...(claim.diagnosis_codes || []),
    ].filter((c) => String(c ?? "").trim().length > 0);
    // De-dupe so a single code repeated across both arrays doesn't pass.
    const unique = Array.from(new Set(codes.map((c) => String(c).trim().toUpperCase())));
    if (unique.length < 2) {
      issues.push({
        field: "icd10_codes",
        severity: "block",
        stage: "biller",
        message: "Stretcher claim needs a secondary diagnosis supporting bed-confinement",
        fixPath: claim.trip_id ? `/pcr?tripId=${claim.trip_id}&focus=icd10` : undefined,
        fixLabel: claim.trip_id ? "Fix in PCR" : undefined,
      });
    }
  }

  // Rule 2 — RSNAT prior authorization required for Medicare repetitive
  // non-emergent transport (dialysis destination, standing order, or
  // ≥3x/week recurrence). UTN must be present and not expired vs run_date.
  if (isRsnatTransport(claim, inputs.patient, inputs.transport)) {
    const utn = String(inputs.patient?.prior_auth_utn ?? "").trim();
    const periodEnd = String(inputs.patient?.prior_auth_period_end ?? "").trim();
    const runDate = String(claim.run_date ?? "").trim();
    const expired =
      !!periodEnd &&
      /^\d{4}-\d{2}-\d{2}$/.test(periodEnd) &&
      !!runDate &&
      /^\d{4}-\d{2}-\d{2}$/.test(runDate) &&
      periodEnd < runDate;
    if (!utn || expired) {
      issues.push({
        field: "prior_auth_utn",
        severity: "block",
        stage: "biller",
        message: "Prior authorization (RSNAT) required for repetitive Medicare transport",
        fixPath: claim.patient_id
          ? `/patients?patientId=${claim.patient_id}&focus=prior_auth`
          : "/patients?focus=prior_auth",
        fixLabel: "Fix in patient chart",
      });
    }
  }

  // Rule 1 (backstop) — A leg whose type or facility says "dialysis" must
  // resolve to J (freestanding) or G (hospital-based) via the canonical
  // ambulance-modifier resolver. If the resolver yields "D" for a side
  // flagged as dialysis (subtype unknown / facility unmatched), block the
  // claim before EDI generation so a wrong modifier can't reach a payer.
  const sideIsDialysis = (
    type?: string | null,
    meta?: { facility_type?: string | null } | null | undefined,
  ): boolean => {
    if (meta?.facility_type && String(meta.facility_type).toLowerCase() === "dialysis") return true;
    const t = String(type ?? "").trim().toLowerCase();
    return !!t && t.includes("dialysis");
  };
  const resolveSide = (
    type?: string | null,
    meta?: { facility_type?: string | null; dialysis_subtype?: string | null } | null | undefined,
  ): string | null => {
    try { return locationTypeCode(type ?? null, meta ?? null); } catch { return null; }
  };
  const dialysisFixPath = claim.trip_id
    ? `/pcr?tripId=${claim.trip_id}&focus=facility`
    : (claim.id ? `/billing?claimId=${claim.id}&focus=facility` : undefined);
  if (sideIsDialysis(claim.origin_type, claim.origin_facility_meta)) {
    if (resolveSide(claim.origin_type, claim.origin_facility_meta) === "D") {
      issues.push({
        field: "origin_type",
        severity: "block",
        stage: "biller",
        message:
          "Dialysis leg didn't resolve to a dialysis modifier (J/G) — set or confirm the facility for this trip.",
        fixPath: dialysisFixPath,
        fixLabel: dialysisFixPath ? "Fix in trip" : undefined,
      });
    }
  }
  if (sideIsDialysis(claim.destination_type, claim.destination_facility_meta)) {
    if (resolveSide(claim.destination_type, claim.destination_facility_meta) === "D") {
      issues.push({
        field: "destination_type",
        severity: "block",
        stage: "biller",
        message:
          "Dialysis leg didn't resolve to a dialysis modifier (J/G) — set or confirm the facility for this trip.",
        fixPath: dialysisFixPath,
        fixLabel: dialysisFixPath ? "Fix in trip" : undefined,
      });
    }
  }

  return issues;
}

/** Convert structured issues back to flat strings for callers that haven't
 *  migrated yet (preserves existing validateClaimForEDI return-shape). */
export function readinessToErrorStrings(issues: ReadinessIssue[]): string[] {
  return issues.map((i) => i.message);
}

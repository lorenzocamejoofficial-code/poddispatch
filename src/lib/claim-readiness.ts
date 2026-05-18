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
  };
  billingState?: string | null;
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
  const claimPath = claim.id ? `/billing-claims?claimId=${claim.id}` : "/billing-claims";

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

  // Payer info
  if (!claim.payer_name && !claim.payer_id) {
    push({
      field: "payer_name", severity: "block",
      message: "Missing payer information",
      fixPath: patientFix("primary_payer"),
      fixLabel: "Fix in patient chart",
    });
  }

  // ICD-10
  const allDiag = [...(claim.icd10_codes || []), ...(claim.diagnosis_codes || [])].filter(Boolean);
  if (allDiag.length === 0) {
    push({
      field: "icd10_codes", severity: "block",
      message: "ICD-10 code required — enter code from PCR",
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
      message: "Patient address incomplete — update patient record before submitting.",
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
        message: `Timely filing deadline passed — DOS ${claim.run_date} is ${daysOver} days past the ${limit}-day limit for ${claim.payer_type ?? "payer"}.`,
      });
    }
  }

  // Origin/Destination type
  if (!claim.origin_type || !String(claim.origin_type).trim()) {
    push({
      field: "origin_type", severity: "block",
      message: "Missing origin type — required for ambulance origin/destination modifier.",
      fixPath: tripPath ? `${tripPath}&focus=origin_type` : undefined,
      fixLabel: tripPath ? "Fix in PCR" : undefined,
    });
  }
  if (!claim.destination_type || !String(claim.destination_type).trim()) {
    push({
      field: "destination_type", severity: "block",
      message: "Missing destination type — required for ambulance origin/destination modifier.",
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
      message: "Missing or invalid pickup ZIP — required for Loop 2310E (Medicare GPCI lookup).",
      fixPath: zipFixPath,
      fixLabel: zipFixLabel,
    });
  }

  return issues;
}

/** Convert structured issues back to flat strings for callers that haven't
 *  migrated yet (preserves existing validateClaimForEDI return-shape). */
export function readinessToErrorStrings(issues: ReadinessIssue[]): string[] {
  return issues.map((i) => i.message);
}

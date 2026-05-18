import { useState, useEffect } from "react";
import { CheckCircle, XCircle, ClipboardCheck, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { computeClaimScore, getScoreBgClass, type ClaimScoreResult } from "@/lib/claim-score";
import { BillerPcsPanel } from "@/components/billing/BillerPcsPanel";
import { normalizeTransportKey } from "@/lib/pcr-field-requirements";
import { getMissingPatientRequirements } from "@/lib/pcr-dropdowns";
import { isValidNpi, NPI_INVALID_MESSAGE } from "@/lib/npi-luhn";
import { queueClaimsForSubmission } from "@/lib/queue-claims-for-submission";

// Local helper mirroring pcr-field-requirements.hasValue — used by the
// Audit Fix 2 + 3 checks below to keep the billing gate aligned with the
// visual indicators.
function hasValue(v: any): boolean {
  if (v === null || v === undefined || v === "") return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}
interface ChecklistItem {
  label: string;
  passed: boolean;
  detail?: string;
  isWarning?: boolean; // soft warning — does not block submission
}

interface PreSubmitChecklistProps {
  tripId: string;
  patientId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: () => void;
}

export function PreSubmitChecklist({ tripId, patientId, open, onOpenChange, onSubmit }: PreSubmitChecklistProps) {
  const { activeCompanyId } = useAuth();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [claimScore, setClaimScore] = useState<ClaimScoreResult | null>(null);
  const [pcsApplicable, setPcsApplicable] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    (async () => {
      const [{ data: trip }, { data: patient }, { data: claimRow }, { data: payerDir }] = await Promise.all([
        supabase
          .from("trip_records" as any)
          .select("*, leg:scheduling_legs!trip_records_leg_id_fkey(is_oneoff, oneoff_member_id, oneoff_primary_payer, chair_time)")
          .eq("id", tripId)
          .maybeSingle(),
        patientId
          ? supabase.from("patients").select("*, pcs_signed_date, pcs_physician_npi").eq("id", patientId).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from("claim_records" as any)
          .select("has_emergency_event, emergency_billing_reviewed_at, hcpcs_codes, payer_type, member_id, icd10_codes, pcs_physician_name, pcs_physician_npi, pcs_certification_date, pcs_diagnosis")
          .eq("trip_id", tripId)
          .maybeSingle(),
        activeCompanyId
          ? supabase.from("payer_directory").select("payer_type, timely_filing_days").eq("company_id", activeCompanyId)
          : Promise.resolve({ data: [] }),
      ]);

      if (!trip) {
        setItems([]);
        setLoading(false);
        return;
      }

      const t = trip as any;
      const p = patient as any;
      const claim = claimRow as any;

      // Resolve payer rules from Compliance & QA (payer_billing_rules) first — single source of truth.
      const claimPayerType = String(claim?.payer_type ?? p?.primary_payer ?? "").toLowerCase().trim();
      const claimPayerName = String((claim as any)?.payer_name ?? "").trim();
      let payerRulesObj: {
        requires_pcs?: boolean | null;
        requires_signature?: boolean | null;
        requires_timestamps?: boolean | null;
        requires_miles?: boolean | null;
        requires_necessity_note?: boolean | null;
        requires_auth?: boolean | null;
      } | null = null;
      if (activeCompanyId && claimPayerType) {
        const { data: pr } = await supabase
          .from("payer_billing_rules")
          .select("requires_pcs, requires_signature, requires_timestamps, requires_miles, requires_necessity_note, requires_auth")
          .eq("company_id", activeCompanyId)
          .eq("payer_type", claimPayerType)
          .maybeSingle();
        if (pr) payerRulesObj = pr;
      }

      // EDI enrollment advisory — fuzzy match claim payer to payer_directory,
      // then look up customer_payer_enrollments. Soft warning only; submission
      // is never blocked. Pass 4F.
      let ediUnenrolledWarning: string | null = null;
      if (activeCompanyId && (claimPayerType || claimPayerName)) {
        let pdQuery = supabase
          .from("payer_directory")
          .select("id, payer_name")
          .eq("company_id", activeCompanyId)
          .limit(1);
        if (claimPayerType) pdQuery = pdQuery.eq("payer_type", claimPayerType);
        if (claimPayerName) pdQuery = pdQuery.ilike("payer_name", claimPayerName);
        const { data: pdMatch } = await pdQuery.maybeSingle();
        if (pdMatch?.id) {
          const { data: cpe } = await supabase
            .from("customer_payer_enrollments" as any)
            .select("edi_enrolled")
            .eq("company_id", activeCompanyId)
            .eq("payer_id", pdMatch.id)
            .maybeSingle();
          if (!cpe || (cpe as any).edi_enrolled !== true) {
            ediUnenrolledWarning = `EDI enrollment with ${pdMatch.payer_name} is not confirmed for this company. Submission will proceed but may be rejected by the clearinghouse. Confirm enrollment status in Billing → Payer Directory.`;
          }
        }
      }

      // Default to "required" if a column is null/missing — payer rules default-on for safety.
      const ruleOn = (v: boolean | null | undefined) => v !== false;
      const need = {
        pcs: ruleOn(payerRulesObj?.requires_pcs),
        signature: ruleOn(payerRulesObj?.requires_signature),
        timestamps: ruleOn(payerRulesObj?.requires_timestamps),
        miles: ruleOn(payerRulesObj?.requires_miles),
        necessity: ruleOn(payerRulesObj?.requires_necessity_note),
        auth: ruleOn(payerRulesObj?.requires_auth),
      };

      // Fix 7/8: trip_type is the canonical source of truth; pcr_type is a
      // backward-compat fallback only.
      const canonicalTripType = String(t.trip_type ?? t.pcr_type ?? "").toLowerCase();
      const isEmergency = canonicalTripType === "emergency";
      const isUnscheduled = !!t.is_unscheduled;
      // Private-pay invoices are NOT insurance claims. Vitals, mileage, odometers,
      // medical-necessity criteria, and PCS are all insurance-driven requirements
      // that don't apply to a cash invoice. Treat private_pay leniently.
      const isPrivatePay = canonicalTripType === "private_pay";

      // Patient-level PCS satisfies the check (and hides the biller panel) for any
      // run whose patient already has PCS on file and not expired. Most common on
      // dialysis but applies to any standing-PCS patient.
      const patientPcsValid = !!(p?.pcs_on_file && (!p?.pcs_expiration_date || new Date(p.pcs_expiration_date) >= new Date(t.run_date)));
      const pcsSkippable = isEmergency || isUnscheduled || isPrivatePay || !need.pcs || patientPcsValid;
      // Hide the biller PCS data-entry panel when PCS is already covered by the
      // patient record, when the payer doesn't require it, or for emergency/unscheduled runs.
      setPcsApplicable(need.pcs && !isEmergency && !isUnscheduled && !isPrivatePay && !patientPcsValid);

      // Biller-entered PCS satisfies the PCS check (overrides patient-record PCS)
      const billerPcsComplete = !!(claim?.pcs_physician_name && claim?.pcs_physician_npi && claim?.pcs_certification_date && claim?.pcs_diagnosis);

      // Fix 1: canonical column is `member_id` everywhere. Order of precedence:
      //   1. trip_records.member_id (set by createTripForRun for one-offs, or PCR edit)
      //   2. patients.member_id (joined for linked-patient runs)
      //   3. claim_records.member_id (already materialized by the trigger)
      //   4. scheduling_legs.oneoff_member_id (raw fallback for legacy data)
      const effectiveMemberId = (t.member_id && String(t.member_id).trim())
        || (p?.member_id && String(p.member_id).trim())
        || (claim?.member_id && String(claim.member_id).trim())
        || (t.leg?.oneoff_member_id && String(t.leg.oneoff_member_id).trim())
        || "";

      // ICD-10 — read from trip first, fall back to claim record. We do NOT
      // synthesize a diagnosis here. Auto-stamping N18.6 (ESRD) on dialysis runs
      // with no codes was federal fraud exposure and has been removed. If codes
      // are missing the checklist must fail so the biller resolves it on the PCR.
      const effectiveIcd10: string[] = (Array.isArray(t.icd10_codes) && t.icd10_codes.length > 0)
        ? t.icd10_codes
        : (Array.isArray(claim?.icd10_codes) ? claim.icd10_codes : []);

      // Medical necessity — booleans OR free-text reason from PCR
      const hasNecessity = !!(t.bed_confined || t.cannot_transfer_safely || t.requires_monitoring || t.oxygen_during_transport
        || (t.medical_necessity_reason && String(t.medical_necessity_reason).trim())
        || (t.necessity_notes && String(t.necessity_notes).trim()));

      const checks: ChecklistItem[] = [];

      // ──────────────────────────────────────────────────────────────────
      // Phase 3 — Patient-record required fields (runs BEFORE PCR-completion).
      // Source: 42 CFR 410.40 + RSNAT prior-auth model. The same evaluator
      // powers the red-border indicators on the patient form.
      // ──────────────────────────────────────────────────────────────────
      if (p) {
        // Project trip transport_type onto patient if patient doesn't have one
        // (covers one-off runs and edge cases where trip.trip_type is canonical).
        const projected = { ...p, transport_type: p.transport_type ?? normalizeTransportKey(t.trip_type ?? t.pcr_type) };
        const missing = getMissingPatientRequirements(projected);
        for (const m of missing) {
          checks.push({
            label: `Patient record missing: ${m.label}`,
            passed: false,
            detail: `Open the patient record and complete the "${m.label}" field before submitting this claim.`,
          });
        }
      }

      if (ediUnenrolledWarning) {
        checks.push({
          label: "EDI enrollment not confirmed",
          passed: false,
          isWarning: true,
          detail: ediUnenrolledWarning,
        });
      }

      // PCS — gated by payer rule
      if (need.pcs) {
        // 42 CFR 410.40(d) — non-emergency scheduled transport requires a
        // Physician Certification Statement DATED WITHIN 60 DAYS of the
        // service date. Compute against patient PCS or biller-entered PCS;
        // whichever provides the most recent signed date.
        const referenceSigned: string | null =
          (p as any)?.pcs_signed_date || (claim as any)?.pcs_certification_date || null;
        let pcsExpired60 = false;
        let pcsAgeDays: number | null = null;
        if (!pcsSkippable && referenceSigned && t.run_date) {
          const signed = new Date(referenceSigned + "T00:00:00");
          const run = new Date(t.run_date + "T00:00:00");
          pcsAgeDays = Math.floor((run.getTime() - signed.getTime()) / 86400000);
          pcsExpired60 = pcsAgeDays > 60;
        }
        const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US");
        const sixtyDayDetail = pcsExpired60 && referenceSigned && t.run_date
          ? `PCS signed ${fmt(referenceSigned)} is more than 60 days before trip date ${fmt(t.run_date)}. CMS requires PCS dated within 60 days of service per 42 CFR 410.40(d). Update PCS on file or get a new physician certification.`
          : undefined;
        checks.push({
          label: "PCS on file and not expired",
          passed: pcsSkippable
            ? !pcsExpired60
            : billerPcsComplete
              ? !pcsExpired60
              : false,
          detail: isEmergency
            ? "Not required for emergency transport"
            : isUnscheduled
            ? "Same-day unscheduled — PCS not required at submission"
            : pcsExpired60
              ? sixtyDayDetail
            : patientPcsValid
              ? (p?.pcs_expiration_date ? `On file — expires ${p.pcs_expiration_date}` : "On file, no expiration")
            : billerPcsComplete
              ? `Completed by biller — ${claim.pcs_physician_name}, NPI ${claim.pcs_physician_npi}`
              : "Not on file — use the PCS panel below to enter physician details, or upload a PCS form",
        });

        // NPI Luhn — only enforce when a PCS NPI has actually been entered.
        // Either patient.pcs_physician_npi or claim.pcs_physician_npi can
        // supply it; the EDI generator already rejects pcs_on_file=true with
        // a malformed NPI at 837P build time, so this gate makes the same
        // failure visible in the pre-submit checklist instead.
        const candidateNpi: string | null =
          (claim as any)?.pcs_physician_npi || (p as any)?.pcs_physician_npi || null;
        if (candidateNpi && !pcsSkippable) {
          const valid = isValidNpi(candidateNpi);
          checks.push({
            label: "PCS physician NPI passes Luhn checksum",
            passed: valid,
            detail: valid
              ? `NPI ${candidateNpi} — checksum valid`
              : `${NPI_INVALID_MESSAGE} (entered: ${candidateNpi})`,
          });
        }
      }

      // Medical necessity — gated by payer rule
      if (need.necessity && !isPrivatePay) {
        checks.push({
          label: "At least one medical necessity criterion checked",
          passed: hasNecessity,
          detail: hasNecessity ? undefined : "Open the PCR Medical Necessity card and check at least one criterion",
        });
      }

      // Timestamps — gated by payer rule
      if (need.timestamps) {
        checks.push({
          label: "All required timestamps present",
          passed: !!(t.dispatch_time && t.at_scene_time && t.left_scene_time && t.arrived_dropoff_at && t.in_service_time),
          detail: [
            !t.dispatch_time && "Dispatch",
            !t.at_scene_time && "At Scene",
            !t.left_scene_time && "Left Scene",
            !t.arrived_dropoff_at && "At Destination",
            !t.in_service_time && "In Service",
          ].filter(Boolean).join(", ") || undefined,
        });
      }

      // Crew signature — gated by payer rule
      if (need.signature) {
        checks.push({
          label: "Crew signature present",
          passed: !!(t.signatures_json && Array.isArray(t.signatures_json) && t.signatures_json.length > 0),
        });
      }

      // Loaded miles + odometers — gated by payer rule
      if (need.miles && !isPrivatePay) {
        // Auto-derive loaded_miles from odometer readings when missing — billers
        // shouldn't have to manually copy this if the crew documented odometers.
        const derivedMiles = (t.loaded_miles && Number(t.loaded_miles) > 0)
          ? Number(t.loaded_miles)
          : (t.odometer_at_scene != null && t.odometer_at_destination != null && t.odometer_at_destination > t.odometer_at_scene)
            ? Number(t.odometer_at_destination) - Number(t.odometer_at_scene)
            : 0;
        // Accept any positive mileage ≥ 0.1 — sub-mile transports (e.g.
        // hospital-to-hospital across the street) are real and the EDI
        // generator already supports fractional miles via toFixed(1).
        checks.push({
          label: "Loaded miles recorded",
          passed: derivedMiles >= 0.1,
          detail: derivedMiles >= 0.1
            ? `${derivedMiles.toFixed(1)} miles${(!t.loaded_miles || Number(t.loaded_miles) === 0) ? " (auto-derived from odometer)" : ""}`
            : "Loaded miles must be at least 0.1 — record odometer readings or enter mileage on the PCR.",
        });
        checks.push({
          label: "Odometer readings present",
          passed: !!(t.odometer_at_scene != null && t.odometer_at_destination != null),
        });
      }

      // Authorization — gated by payer rule
      // Bug fix (Phase 3 cleanup): RSNAT auth window lives on
      // patients.prior_auth_period_end, NOT the legacy patients.auth_expiration
      // column (which is for non-RSNAT other-payer auth). Reading the wrong
      // column caused valid RSNAT auths to be reported as expired.
      if (need.auth && p?.auth_required) {
        const hasAuth = !!(p?.prior_auth_utn && (!p?.prior_auth_period_end || new Date(p.prior_auth_period_end) >= new Date(t.run_date)));
        checks.push({
          label: "Prior authorization on file and not expired",
          passed: hasAuth,
          detail: hasAuth ? undefined : "Patient requires authorization — add a valid prior auth number on the patient record",
        });
      }

      // HCPCS, modifiers, ICD-10, member ID — always required for any payable claim
      checks.push({
        label: "HCPCS codes assigned",
        passed: !!(claim?.hcpcs_codes && Array.isArray(claim.hcpcs_codes) && claim.hcpcs_codes.length > 0),
        detail: claim?.hcpcs_codes?.length ? claim.hcpcs_codes.join(", ") : undefined,
      });
      checks.push({
        label: "Origin and destination modifiers present",
        passed: !!(t.origin_type && t.destination_type),
        detail: t.origin_type && t.destination_type ? `${t.origin_type} → ${t.destination_type}` : undefined,
      });
      checks.push({
        label: "ICD-10 diagnosis codes present",
        passed: effectiveIcd10.length > 0,
        detail: effectiveIcd10.length > 0 ? effectiveIcd10.join(", ") : "Diagnosis codes required — open the PCR and add at least one ICD-10 code in the Assessment section",
      });
      checks.push({
        label: "Member ID present",
        passed: effectiveMemberId !== "",
        detail: effectiveMemberId !== "" ? effectiveMemberId : "Member ID is missing — update the patient record (or one-off run details) before submitting",
      });

      // ──────────────────────────────────────────────────────────────────
      // Audit Fix 2 — align checklist with pcr-field-requirements.ts
      // These checks apply across all transport types (with type-aware gating
      // for level_of_consciousness) and were previously missing from the
      // billing gate even though the visual indicators required them.
      // ──────────────────────────────────────────────────────────────────
      const normalizedTypeForBaseChecks = normalizeTransportKey(t.trip_type ?? t.pcr_type);

      // Vitals — all transport types
      // Vitals — all transport types EXCEPT private_pay (cash invoices don't
      // need clinical vitals; this matches pcr-field-requirements.ts).
      if (!isPrivatePay) {
        const vitalsArr = Array.isArray(t.vitals_json) ? t.vitals_json : [];
        const hasSavedVitals = vitalsArr.some((v: any) => !!v?.timestamp && v?.saved !== false);
        checks.push({
          label: "Vitals set saved",
          passed: hasSavedVitals,
          detail: hasSavedVitals ? undefined : "No vitals recorded — complete the Vitals card before submitting.",
        });
      }

      // Level of consciousness — required for dialysis, outpatient, wound_care, discharge
      if (["dialysis", "outpatient", "wound_care", "discharge"].includes(normalizedTypeForBaseChecks)) {
        checks.push({
          label: "Level of consciousness documented",
          passed: hasValue(t.level_of_consciousness),
          detail: hasValue(t.level_of_consciousness)
            ? String(t.level_of_consciousness)
            : "Level of consciousness not documented — complete the Condition on Arrival card.",
        });
      }

      // Stretcher placement + patient mobility — required wherever stretcher_mobility is required
      // (dialysis, outpatient, outpatient_specialty, wound_care, ift, ift_discharge, discharge,
      // emergency, private_pay, psych_transport — i.e. all transport types in REQUIREMENTS)
      const stretcherTypes = [
        "dialysis","outpatient","outpatient_specialty","wound_care",
        "ift","ift_discharge","discharge","emergency","private_pay","psych_transport",
      ];
      if (stretcherTypes.includes(normalizedTypeForBaseChecks)) {
        const sp = hasValue(t.stretcher_placement);
        const pm = hasValue(t.patient_mobility);
        checks.push({
          label: "Stretcher and mobility documentation",
          passed: sp && pm,
          detail: sp && pm
            ? `${t.stretcher_placement} / ${t.patient_mobility}`
            : "Stretcher and mobility documentation incomplete.",
        });
      }

      // Narrative — required for every type that includes NARRATIVE_FIELDS in pcr-field-requirements
      // (dialysis, outpatient, outpatient_specialty, wound_care, ift, ift_discharge, discharge,
      // emergency, psych_transport — everything except private_pay).
      if (normalizedTypeForBaseChecks !== "private_pay") {
        checks.push({
          label: "Narrative documented",
          passed: hasValue(t.narrative),
          detail: hasValue(t.narrative)
            ? undefined
            : "Narrative not documented — complete the Narrative card before submitting.",
        });

        // Soft warning: thin narratives on Medicare/Medicaid claims are a
        // common audit trigger ("patient stable" one-liners). Does not block
        // submission — biller sees a yellow advisory.
        const narrativeLen = (t.narrative || "").trim().length;
        const isGovPayer = ["medicare", "medicaid"].includes(claimPayerType);
        if (isGovPayer && hasValue(t.narrative) && narrativeLen < 100) {
          checks.push({
            label: "Narrative depth (audit advisory)",
            passed: false,
            isWarning: true,
            detail: `Narrative is only ${narrativeLen} characters. Medicare/Medicaid auditors flag short narratives — consider adding specific medical necessity detail (mobility, condition, why ambulance was required).`,
          });
        }
      }

      // Patient address — must have street + city + ZIP. Blocks export and the
      // 837P generator so we never write "UNKNOWN" to N3/N4 segments.
      // One-off runs: address lives on the trip itself (pickup_location), with
      // leg.oneoff_pickup_address as a fallback. Regular runs use the patient record.
      const patientAddrRaw = String(
        (t.leg?.is_oneoff
          ? (t.pickup_location ?? t.leg?.oneoff_pickup_address)
          : p?.pickup_address) ?? ""
      ).trim();
      const hasZip = /\b\d{5}(?:-\d{4})?\b/.test(patientAddrRaw);
      const tokens = patientAddrRaw.split(/[,\s]+/).filter(Boolean);
      const hasStreet = /\d/.test(patientAddrRaw) && tokens.length >= 2;
      const hasCity = tokens.length >= 3;
      const addressComplete = !!patientAddrRaw && hasZip && hasStreet && hasCity;
      checks.push({
        label: "Patient address complete (street, city, ZIP)",
        passed: addressComplete,
        detail: addressComplete
          ? patientAddrRaw
          : "Patient address incomplete — update patient record before submitting.",
      });

      // Emergency billing decision check — only applies when claim has emergency event
      if (claim?.has_emergency_event) {
        checks.push({
          label: "Emergency billing decision required",
          passed: !!claim.emergency_billing_reviewed_at,
          detail: !claim.emergency_billing_reviewed_at
            ? "This claim involves an emergency event — open the claim detail to review and accept the billing recommendation before submitting"
            : undefined,
        });
      }

      // ──────────────────────────────────────────────────────────────────
      // Transport-type-specific validation (item 5)
      // Runs in addition to the always-on and payer-rule-gated checks above.
      // Fix 8: use the central normalizeTransportKey instead of an inline matcher.
      // ──────────────────────────────────────────────────────────────────
      const normalizedType = normalizeTransportKey(t.trip_type ?? t.pcr_type);

      const sf = t.sending_facility_json ?? {};
      const eq = t.equipment_used_json ?? {};

      if (normalizedType === "psych_transport") {
        const authType = String(t.bh_authorization_type ?? "").trim();
        const assessmentArr = Array.isArray(t.bh_behavioral_assessment) ? t.bh_behavioral_assessment : [];
        checks.push({
          label: "Transport authorization type recorded",
          passed: authType.length > 0,
          detail: authType.length > 0 ? authType : "Open the Behavioral Health card and record the transport authorization type.",
        });
        checks.push({
          label: "Behavioral assessment documented",
          passed: assessmentArr.length > 0,
          detail: assessmentArr.length > 0 ? `${assessmentArr.length} finding(s) recorded` : "Select at least one behavioral assessment finding.",
        });
        if (authType.toLowerCase().includes("involuntary")) {
          checks.push({
            label: "1013 form received (involuntary transport)",
            passed: t.bh_1013_received === true,
            detail: t.bh_1013_received === true ? undefined : "Confirm the 1013 form was received before submission.",
          });
          checks.push({
            label: "Authorizing facility recorded",
            passed: !!(t.bh_authorizing_facility && String(t.bh_authorizing_facility).trim()),
            detail: t.bh_authorizing_facility ? String(t.bh_authorizing_facility) : "Authorizing facility name is required for involuntary transport.",
          });
          // Audit Fix 3/7 — also require the authorizing physician name on
          // involuntary psych transports. Mirrors BEHAVIORAL_HEALTH_INVOLUNTARY_FIELDS
          // in pcr-field-requirements.ts.
          checks.push({
            label: "Authorizing physician name (involuntary transport)",
            passed: !!(t.bh_authorizing_physician_name && String(t.bh_authorizing_physician_name).trim()),
            detail: t.bh_authorizing_physician_name
              ? String(t.bh_authorizing_physician_name)
              : "Authorizing physician name required for involuntary transport.",
          });
        }
        if (t.restraints_applied === true) {
          checks.push({
            label: "Restraint type documented",
            passed: !!(eq.bh_restraint_type && String(eq.bh_restraint_type).trim()),
            detail: eq.bh_restraint_type ? String(eq.bh_restraint_type) : "Restraints applied — record restraint type in the equipment card.",
          });
        }
      }

      if (normalizedType === "wound_care") {
        // Fix 5: read wound fields ONLY from top-level columns. ConditionCard
        // writes them as top-level; legacy assessment_json/condition_on_arrival
        // fallbacks have been removed.
        const woundType = t.wound_type;
        const woundLoc = t.wound_location;
        checks.push({
          label: "Wound type recorded",
          passed: !!(woundType && String(woundType).trim()),
          detail: woundType ? String(woundType) : "Wound type is required for wound-care transport billing.",
        });
        checks.push({
          label: "Wound location recorded",
          passed: !!(woundLoc && String(woundLoc).trim()),
          detail: woundLoc ? String(woundLoc) : "Wound location is required for wound-care transport billing.",
        });
        checks.push({
          label: "Wound-care medical necessity criterion checked",
          passed: hasNecessity,
          detail: hasNecessity ? undefined : "Select at least one medical necessity criterion specific to wound-care transport.",
        });
      }

      if (normalizedType === "discharge") {
        checks.push({
          label: "Sending facility name recorded",
          passed: !!(sf.facility_name && String(sf.facility_name).trim()),
          detail: sf.facility_name ? String(sf.facility_name) : "Open the Sending Facility card and enter the facility name.",
        });
        checks.push({
          label: "Sending physician recorded",
          passed: !!(sf.physician_name && String(sf.physician_name).trim()),
          detail: sf.physician_name ? String(sf.physician_name) : "Sending physician name is required on a discharge PCR.",
        });
        // Fix 7: pcs_attached === false is a confirmed negative from the dispatcher.
        // It does NOT satisfy the PCS gate — the biller must complete the PCS panel
        // (or upload a form) for the claim to pass. Only treat as covered when true.
        const dischargePcsOk =
          pcsSkippable ||
          billerPcsComplete ||
          t.pcs_attached === true ||
          t.bh_1013_received === true;
        checks.push({
          label: "Discharge PCS / authorization on file",
          passed: dischargePcsOk,
          detail: dischargePcsOk
            ? undefined
            : t.pcs_attached === false
              ? "Dispatcher marked PCS as not obtained — biller must complete the PCS panel below before submission."
              : "Mark PCS as obtained on the Sending Facility card or attach a 1013 / patient-record PCS.",
        });
        checks.push({
          label: "Discharge reason recorded",
          passed: !!(sf.discharge_reason && String(sf.discharge_reason).trim()),
          detail: sf.discharge_reason ? String(sf.discharge_reason) : "Record the discharge reason on the Sending Facility card.",
        });
        // Fix 6: read disposition ONLY from the top-level column.
        const hasDisposition = !!(t.disposition && String(t.disposition).trim());
        checks.push({
          label: "Hospital disposition recorded",
          passed: hasDisposition,
          detail: hasDisposition ? String(t.disposition) : "Record the receiving disposition on the Hospital Outcome card.",
        });
      }

      if (normalizedType === "ift") {
        checks.push({
          label: "Sending facility name recorded",
          passed: !!(sf.facility_name && String(sf.facility_name).trim()),
          detail: sf.facility_name ? String(sf.facility_name) : "Sending facility name is required on an IFT PCR.",
        });
        checks.push({
          label: "Sending physician recorded",
          passed: !!(sf.physician_name && String(sf.physician_name).trim()),
          detail: sf.physician_name ? String(sf.physician_name) : "Sending physician name is required on an IFT PCR.",
        });
        // Fix 6: read disposition ONLY from the top-level column.
        const hasDisposition = !!(t.disposition && String(t.disposition).trim());
        checks.push({
          label: "Hospital disposition recorded",
          passed: hasDisposition,
          detail: hasDisposition ? String(t.disposition) : "Record the receiving disposition on the Hospital Outcome card.",
        });
        checks.push({
          label: "Chief complaint and primary impression",
          passed: !!(t.chief_complaint && t.primary_impression),
          detail: t.chief_complaint && t.primary_impression
            ? `${t.chief_complaint} → ${t.primary_impression}`
            : "Both chief complaint and primary impression are required on an IFT PCR.",
        });
      }

      if (normalizedType === "dialysis") {
        const chairTime = t.leg?.chair_time;
        checks.push({
          label: "Chair time recorded on the leg",
          passed: !!chairTime,
          detail: chairTime ? String(chairTime) : "Chair time is required on the dialysis leg before submitting.",
          isWarning: true,
        });
        const hasEsrd = effectiveIcd10.some(c => {
          const code = String(c).toUpperCase().replace(/\s/g, "");
          return code.startsWith("N18.6") || code.startsWith("Z99.2");
        });
        checks.push({
          label: "ESRD diagnosis code present (N18.6 or Z99.2)",
          passed: hasEsrd,
          detail: hasEsrd ? undefined : "Add N18.6 or Z99.2 to the ICD-10 codes on the Assessment card.",
        });
      }

      if (normalizedType === "emergency") {
        checks.push({
          label: "Chief complaint recorded",
          passed: !!(t.chief_complaint && String(t.chief_complaint).trim()),
          detail: t.chief_complaint ? String(t.chief_complaint) : "Chief complaint is required on an emergency PCR.",
        });
        checks.push({
          label: "Primary impression recorded",
          passed: !!(t.primary_impression && String(t.primary_impression).trim()),
          detail: t.primary_impression ? String(t.primary_impression) : "Primary impression is required on an emergency PCR.",
        });
        const hasVitalsSet = Array.isArray(t.vitals_json) && t.vitals_json.some((v: any) => v && (v.bp_systolic || v.pulse || v.respiration));
        checks.push({
          label: "At least one vital set documented",
          passed: hasVitalsSet,
          detail: hasVitalsSet ? undefined : "Record at least one vitals set on the Vitals card.",
        });
        checks.push({
          label: "Assessment ICD-10 codes present",
          passed: effectiveIcd10.length > 0,
          detail: effectiveIcd10.length > 0 ? effectiveIcd10.join(", ") : "Add at least one ICD-10 diagnosis code on the Assessment card.",
        });
      }

      // private_pay intentionally skips payer-specific checks; the always-on
      // timestamps + crew signature + miles checks above already cover it.

      // Timely filing deadline check
      if (t.run_date) {
        const filingMap: Record<string, number> = {};
        for (const pd of payerDir ?? []) {
          if (pd.payer_type) filingMap[pd.payer_type.toLowerCase()] = pd.timely_filing_days ?? 365;
        }
        const filingLimit = filingMap[claimPayerType] ?? 365;
        const dosDate = new Date(t.run_date);
        const deadlineDate = new Date(dosDate.getTime() + filingLimit * 24 * 60 * 60 * 1000);
        const daysRemaining = Math.floor((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

        if (daysRemaining < 0) {
          checks.push({
            label: "Timely filing deadline may have passed",
            passed: false,
            isWarning: true,
            detail: `Filing deadline was ${Math.abs(daysRemaining)} days ago based on payer rules (${filingLimit}-day limit). Verify before submitting.`,
          });
        } else if (daysRemaining <= 60) {
          checks.push({
            label: "Timely filing deadline approaching",
            passed: true,
            isWarning: true,
            detail: `${daysRemaining} days remaining based on payer rules (${filingLimit}-day limit)`,
          });
        }
      }

      // RSNAT historical backstop — fires ONLY when the patient-template
      // recurring flag is NOT set (so getFrequencyPayerRequirements above did
      // not already raise the UTN requirement). Per 42 CFR 410.40(d)(2),
      // RSNAT prior auth should be obtained BEFORE service via the patient
      // template; this backstop catches cases where trip history shows the
      // patient has effectively become RSNAT-eligible without the template
      // being updated.
      const schedDays = String(p?.schedule_days ?? "").trim();
      const recDays = Array.isArray(p?.recurrence_days) ? p?.recurrence_days : [];
      const templateMarksRecurring =
        schedDays === "MWF" || schedDays === "TTS" ||
        recDays.length >= 1 ||
        p?.standing_order === true;
      if (claimPayerType === "medicare" && patientId && t.run_date && !templateMarksRecurring) {
        const dosTime = new Date(t.run_date).getTime();
        const windowStart = new Date(dosTime - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const windowEnd = new Date(dosTime).toISOString().slice(0, 10);
        const { data: priorTrips } = await supabase
          .from("trip_records")
          .select("id, leg_id")
          .eq("patient_id", patientId)
          .gte("run_date", windowStart)
          .lte("run_date", windowEnd);
        const oneWayCount = (priorTrips ?? []).length;
        // Round-trip approximation: trips that share a leg_id pair as A/B legs
        const legIds = (priorTrips ?? []).map(r => r.leg_id).filter(Boolean) as string[];
        const roundTripCount = Math.floor(legIds.length / 2);
        if (oneWayCount >= 40 || roundTripCount >= 20) {
          checks.push({
            label: "RSNAT prior auth not on file — trip history indicates threshold reached",
            passed: false,
            isWarning: true,
            detail: `RSNAT prior auth not on file but trip history indicates this patient meets RSNAT thresholds (≥3 round trips in 10 days, or weekly for 3+ weeks) — ${oneWayCount} one-way / ~${roundTripCount} round trips in last 60 days. Update the patient template to indicate a recurring schedule, then obtain a UTN from the MAC.`,
          });
        }
      }


      // Compute claim score using the same PCS resolution paths as the checklist.
      const scorePatient = (patientPcsValid || billerPcsComplete || t.pcs_attached === true)
        ? {
            ...(p ?? {}),
            pcs_on_file: true,
            pcs_expiration_date: patientPcsValid ? p?.pcs_expiration_date ?? null : null,
          }
        : p;
      setClaimScore(computeClaimScore(t, scorePatient, payerRulesObj as any));

      setItems(checks);
      setLoading(false);
    })();
  }, [open, tripId, patientId, activeCompanyId, refreshTick]);

  const allPassed = items.length > 0 && items.every(i => i.passed || i.isWarning);
  const failedCount = items.filter(i => !i.passed && !i.isWarning).length;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Resolve claim_record for this trip, then push it through the
      // shared generator → claim_submission_queue → SFTP worker pipeline.
      // Same path Office Ally already accepted on OATEST — that's the
      // whole point of this single funnel.
      const { data: claim } = await supabase
        .from("claim_records" as any)
        .select("id, company_id")
        .eq("trip_id", tripId)
        .maybeSingle();
      if (!claim?.id || !claim?.company_id) {
        toast.error("No claim record found for this trip");
        setSubmitting(false);
        return;
      }
      const result = await queueClaimsForSubmission([claim.id], claim.company_id);
      if (!result.ok) {
        if (result.setupErrors.length) {
          toast.error(`Submission blocked — ${result.setupErrors[0]}`, { duration: 8000 });
        } else if (result.blocked.length) {
          toast.error(`Claim blocked by validation: ${result.blocked[0].issues[0]?.message ?? "see details"}`);
        } else {
          toast.error(result.error ?? "Failed to queue claim");
        }
        setSubmitting(false);
        return;
      }
      toast.success(`Claim queued for Office Ally (${result.filename})`);
      onOpenChange(false);
      onSubmit?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to submit claim");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Pre-Submit Checklist
          </DialogTitle>
          <DialogDescription>
            All items must pass before this claim can be submitted.
          </DialogDescription>
        </DialogHeader>

        {!loading && pcsApplicable && tripId && (
          <BillerPcsPanel
            tripId={tripId}
            patientId={patientId ?? null}
            onCompleted={() => setRefreshTick(t => t + 1)}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Running checks…</span>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Claim Score */}
            {claimScore && (
              <div className={`rounded-md border p-3 space-y-2 ${getScoreBgClass(claimScore.score)}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-bold ${claimScore.color}`}>
                    Claim Score: {claimScore.score}% — {claimScore.label}
                  </span>
                </div>
                {claimScore.deductions.length > 0 && (
                  <div className="space-y-1">
                    {claimScore.deductions.map((d, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <XCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">
                          <span className="font-medium text-destructive">−{d.points}</span> {d.reason}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              {items.map((item, i) => {
                const isWarn = item.isWarning && !item.passed;
                const isWarnPassed = item.isWarning && item.passed;
                const borderClass = isWarn
                  ? "border-amber-500/30 bg-amber-500/5"
                  : isWarnPassed
                    ? "border-amber-500/30 bg-amber-500/5"
                    : item.passed
                      ? "border-[hsl(var(--status-green))]/30 bg-[hsl(var(--status-green))]/5"
                      : "border-destructive/30 bg-destructive/5";
                return (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 rounded-md border p-2.5 ${borderClass}`}
                >
                  {isWarn ? (
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  ) : isWarnPassed ? (
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  ) : item.passed ? (
                    <CheckCircle className="h-4 w-4 text-[hsl(var(--status-green))] shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium ${isWarn ? "text-destructive" : isWarnPassed ? "text-amber-600" : item.passed ? "text-foreground" : "text-destructive"}`}>
                      {item.label}
                    </p>
                    {item.detail && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {!item.passed && !item.isWarning ? "Missing: " : ""}{item.detail}
                      </p>
                    )}
                  </div>
                </div>
                );
              })}
            </div>

            {allPassed ? (
              <Button className="w-full gap-2" onClick={handleSubmit} disabled={submitting}>
                <CheckCircle className="h-4 w-4" />
                {submitting ? "Submitting…" : "Submit Claim"}
              </Button>
            ) : (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-center">
                <p className="text-xs text-destructive font-medium">
                  {failedCount} item{failedCount > 1 ? "s" : ""} must be resolved before submitting
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * queueClaimsForSubmission
 * ------------------------
 * Single submit path for ambulance 837P. Takes a list of claim IDs that are
 * already `ready_to_bill` (or equivalent) on the Billing & Claims board,
 * builds an Office Ally–compliant 837P via the validated generator in
 * src/lib/edi-837p-generator.ts, and inserts a row into
 * `claim_submission_queue` so the Railway SFTP worker picks it up on its
 * next poll.
 *
 * This is the ONE path that every "Submit Claim" / "Submit Group" button
 * funnels through — the Pre-Submit Checklist single submit, the Billing &
 * Claims bulk submit, the EDI Export page, and the future auto-queue cron.
 * That guarantees every customer's claim looks like the OATEST file that
 * already passed Office Ally's scrubber.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  generateEDI837P,
  generateEDIFilename,
  validateProviderInfo,
  validateSubmitterInfo,
  parseAddressString,
  extractFacilityName,
  type ClaimForEDI,
  type ProviderInfo,
  type SubmitterInfo,
} from "@/lib/edi-837p-generator";
import { evaluateClaimReadiness, type ReadinessIssue } from "@/lib/claim-readiness";
import { logAuditEvent } from "@/lib/audit-logger";

export interface QueueResult {
  ok: boolean;
  queuedCount: number;
  filename: string | null;
  /** Provider/submitter setup errors that prevented anything from being queued. */
  setupErrors: string[];
  /** Per-claim readiness issues that blocked specific claims. Other claims still queued. */
  blocked: { claimId: string; issues: ReadinessIssue[] }[];
  error?: string;
}

export interface QueueOptions {
  /** Force OATEST envelope (ISA15=T). When omitted, reads vendor_clearinghouse_settings.test_mode. */
  testMode?: boolean;
}

const EMPTY: QueueResult = { ok: false, queuedCount: 0, filename: null, setupErrors: [], blocked: [] };

export async function queueClaimsForSubmission(
  claimIds: string[],
  companyId: string,
  opts: QueueOptions = {},
): Promise<QueueResult> {
  if (!claimIds.length) {
    return { ...EMPTY, error: "No claims selected" };
  }
  if (!companyId) {
    return { ...EMPTY, error: "Company context missing" };
  }

  // ── 1. Provider (per-tenant) + Submitter (global vendor) ──────────────
  const [{ data: company }, { data: vendor }] = await Promise.all([
    supabase
      .from("companies")
      .select("name, npi_number, ein_number, state_of_operation, address_street, address_city, address_state, address_zip, phone")
      .eq("id", companyId)
      .maybeSingle(),
    supabase
      .from("vendor_clearinghouse_settings" as any)
      .select("submitter_id, submitter_name, contact_name, contact_phone, receiver_id, receiver_name, test_mode")
      .limit(1)
      .maybeSingle(),
  ]);

  const providerInfo: ProviderInfo = {
    npi: (company as any)?.npi_number ?? "",
    tax_id: ((company as any)?.ein_number ?? "").toString().replace(/\D/g, ""),
    organization_name: (company as any)?.name ?? "",
    address: (company as any)?.address_street ?? "",
    city: (company as any)?.address_city ?? "",
    state: (company as any)?.address_state ?? (company as any)?.state_of_operation ?? "",
    zip: (company as any)?.address_zip ?? "",
    phone: ((company as any)?.phone ?? "").toString().replace(/\D/g, ""),
  };
  const testMode = opts.testMode ?? !!(vendor as any)?.test_mode;
  const submitterInfo: SubmitterInfo = {
    submitter_id: (vendor as any)?.submitter_id ?? "",
    submitter_name: (vendor as any)?.submitter_name ?? "",
    contact_name: (vendor as any)?.contact_name ?? "",
    contact_phone: ((vendor as any)?.contact_phone ?? "").toString(),
    receiver_id: (vendor as any)?.receiver_id ?? "330897513",
    receiver_name: (vendor as any)?.receiver_name ?? "OFFICE ALLY",
    usage_indicator: testMode ? "T" : "P",
  };

  const setupErrors = [
    ...validateProviderInfo(providerInfo).map(e => `Billing Provider: ${e}`),
    ...validateSubmitterInfo(submitterInfo).map(e => `Vendor Submitter: ${e}`),
  ];
  if (setupErrors.length) return { ...EMPTY, setupErrors };

  // ── 2. Fetch claims + joined trip / patient / leg context ─────────────
  const { data: claimRows, error: claimErr } = await supabase
    .from("claim_records" as any)
    .select("*")
    .in("id", claimIds)
    .eq("company_id", companyId);
  if (claimErr) return { ...EMPTY, error: claimErr.message };
  const claims = (claimRows ?? []) as any[];
  if (!claims.length) return { ...EMPTY, error: "No matching claims in your company scope" };

  const tripIds = [...new Set(claims.map(c => c.trip_id).filter(Boolean))];
  const patientIds = [...new Set(claims.map(c => c.patient_id).filter(Boolean))];

  const [{ data: trips }, { data: patients }] = await Promise.all([
    tripIds.length
      ? supabase
          .from("trip_records")
          .select("id, loaded_miles, bed_confined, requires_monitoring, stretcher_placement, oxygen_during_transport, weight_lbs, pickup_location, destination_location, assessment_json, leg_id, leg:scheduling_legs!trip_records_leg_id_fkey(is_oneoff, oneoff_name, oneoff_dob, oneoff_primary_payer, oneoff_member_id, oneoff_sex, oneoff_pickup_address)")
          .in("id", tripIds)
      : Promise.resolve({ data: [] as any[] }),
    patientIds.length
      ? supabase
          .from("patients")
          .select("id, first_name, last_name, dob, sex, weight_lbs, member_id, primary_payer, pickup_address, pcs_on_file, pcs_physician_npi, pcs_physician_name, facility_id")
          .in("id", patientIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const tripMap: Record<string, any> = {};
  (trips ?? []).forEach((t: any) => { tripMap[t.id] = t; });
  const patMap: Record<string, any> = {};
  (patients ?? []).forEach((p: any) => { patMap[p.id] = p; });

  // ── 3. Facility lookup (drives G/J modifiers + dest address resolution) ─
  const candidateNames = new Set<string>();
  claims.forEach(c => {
    const trip = tripMap[c.trip_id] || {};
    const o = extractFacilityName(trip.pickup_location);
    const d = extractFacilityName(trip.destination_location);
    if (o) candidateNames.add(o);
    if (d) candidateNames.add(d);
    if (!c.destination_address && trip.destination_location) candidateNames.add(trip.destination_location);
  });
  const facilityIds = [...new Set(Object.values(patMap).map((p: any) => p?.facility_id).filter(Boolean))] as string[];
  const facById: Record<string, any> = {};
  const facByName: Record<string, any> = {};
  const facAddrMap: Record<string, string> = {};
  if (facilityIds.length || candidateNames.size) {
    const orParts: string[] = [];
    if (facilityIds.length) orParts.push(`id.in.(${facilityIds.join(",")})`);
    if (candidateNames.size) {
      const csv = [...candidateNames].map(n => `"${n.replace(/"/g, "")}"`).join(",");
      orParts.push(`name.in.(${csv})`);
    }
    const { data: facs } = await supabase
      .from("facilities" as any)
      .select("id, name, address, facility_type, dialysis_subtype")
      .or(orParts.join(","));
    (facs ?? []).forEach((f: any) => {
      facById[f.id] = f;
      facByName[f.name] = f;
      if (f.address) facAddrMap[f.name] = f.address;
    });
  }
  const metaFromFacility = (f: any) =>
    f ? { facility_type: f.facility_type, dialysis_subtype: f.dialysis_subtype ?? null } : null;

  // ── 4. Build ClaimForEDI[] + validate ──────────────────────────────────
  const ediClaims: ClaimForEDI[] = [];
  const blocked: { claimId: string; issues: ReadinessIssue[] }[] = [];
  const acceptedClaimIds: string[] = [];

  for (const c of claims) {
    const trip = tripMap[c.trip_id] || {};
    const pat = patMap[c.patient_id] || {};
    const leg = trip.leg as any;
    const isOneoff = !c.patient_id && leg?.is_oneoff;
    const oneoffName = leg?.oneoff_name ?? "";
    const oneoffParts = oneoffName.trim().split(/\s+/);
    const patientFirst = pat.first_name ?? (isOneoff ? oneoffParts[0] ?? "" : "");
    const patientLast = pat.last_name ?? (isOneoff ? (oneoffParts.slice(1).join(" ") || oneoffParts[0] ?? "") : "");

    const rawPatientAddr = String(pat.pickup_address ?? (isOneoff ? leg?.oneoff_pickup_address : "") ?? "").trim();
    const parsedPat = parseAddressString(rawPatientAddr);

    const claimOriginAddr = c.origin_address || trip.pickup_location || rawPatientAddr || null;
    const claimDestAddr =
      c.destination_address ||
      (trip.destination_location && facAddrMap[trip.destination_location] ? facAddrMap[trip.destination_location] : null) ||
      trip.destination_location ||
      null;

    const originFacByName = facByName[extractFacilityName(trip.pickup_location) || ""] || null;
    const destFacByName = facByName[extractFacilityName(trip.destination_location) || ""] || null;
    const standingFac = pat?.facility_id ? facById[pat.facility_id] : null;
    let originMeta = metaFromFacility(originFacByName);
    let destMeta = metaFromFacility(destFacByName);
    if (standingFac) {
      if (!originFacByName && destFacByName && destFacByName.id !== standingFac.id) {
        originMeta = metaFromFacility(standingFac);
      }
      if (!destFacByName && originFacByName && originFacByName.id !== standingFac.id) {
        destMeta = metaFromFacility(standingFac);
      }
    }

    const ec: ClaimForEDI = {
      claim_id: c.id,
      company_id: companyId,
      patient_name: `${patientLast || "UNKNOWN"}, ${patientFirst || "UNKNOWN"}`,
      patient_dob: pat.dob ?? (isOneoff ? leg?.oneoff_dob : null) ?? "1900-01-01",
      patient_sex: pat.sex ?? (isOneoff ? leg?.oneoff_sex : null) ?? null,
      patient_address: parsedPat.street || rawPatientAddr,
      patient_city: parsedPat.city || "",
      patient_state: parsedPat.state || providerInfo.state || "",
      patient_zip: parsedPat.zip || c.origin_zip || "",
      member_id: pat.member_id || c.member_id || (isOneoff ? leg?.oneoff_member_id : null) || "UNKNOWN",
      payer_name: c.payer_name || c.payer_type || "MEDICARE",
      payer_id: c.payer_type === "medicare" ? "MEDICARE" : c.payer_type === "medicaid" ? "MEDICAID" : (c.payer_name || "UNKNOWN"),
      payer_type: c.payer_type || "medicare",
      run_date: c.run_date,
      hcpcs_codes: c.hcpcs_codes || ["A0428"],
      hcpcs_modifiers: c.hcpcs_modifiers || [],
      total_charge: c.total_charge || 0,
      base_charge: c.base_charge || 0,
      mileage_charge: c.mileage_charge || 0,
      loaded_miles: trip.loaded_miles || 0,
      origin_type: c.origin_type,
      destination_type: c.destination_type,
      origin_address: claimOriginAddr,
      origin_city: c.origin_city || "",
      origin_state: c.origin_state || providerInfo.state || null,
      origin_zip: c.origin_zip,
      destination_address: claimDestAddr,
      destination_city: c.destination_city || "",
      destination_state: c.destination_state || providerInfo.state || null,
      destination_zip: c.destination_zip,
      diagnosis_codes: [],
      auth_number: c.auth_number,
      icd10_codes: c.icd10_codes || [],
      origin_facility_meta: originMeta,
      destination_facility_meta: destMeta,
      bed_confined: !!trip.bed_confined,
      requires_monitoring: !!trip.requires_monitoring,
      stretcher_placement: trip.stretcher_placement || null,
      oxygen_required: !!trip.oxygen_during_transport,
      weight_lbs: trip.weight_lbs || pat.weight_lbs || null,
      pickup_facility_name: extractFacilityName(claimOriginAddr) || null,
      dropoff_facility_name:
        (trip.destination_location && facAddrMap[trip.destination_location]
          ? trip.destination_location
          : extractFacilityName(claimDestAddr)) || null,
      pcs_physician_name: c.pcs_physician_name ?? pat.pcs_physician_name ?? null,
      pcs_physician_npi: c.pcs_physician_npi ?? pat.pcs_physician_npi ?? null,
      pcs_certification_date: c.pcs_certification_date ?? null,
      pcs_diagnosis: c.pcs_diagnosis ?? null,
      pcs_on_file: !!pat.pcs_on_file,
      chief_complaint: c.chief_complaint ?? null,
      primary_impression: c.primary_impression ?? null,
      chief_complaint_other: (trip.assessment_json || {})?.chief_complaint_other ?? null,
      primary_impression_other: (trip.assessment_json || {})?.primary_impression_other ?? null,
    };

    const issues = evaluateClaimReadiness({
      claim: { ...ec, id: c.id, trip_id: c.trip_id, patient_id: c.patient_id },
      billingState: providerInfo.state,
    }).filter(x => x.severity === "block");
    if (issues.length) {
      blocked.push({ claimId: c.id, issues });
    } else {
      ediClaims.push(ec);
      acceptedClaimIds.push(c.id);
    }
  }

  if (!ediClaims.length) {
    return { ...EMPTY, blocked, error: "All selected claims blocked by validation" };
  }

  // ── 5. Generate + queue ────────────────────────────────────────────────
  const ediContent = generateEDI837P(
    ediClaims,
    new Map<string, ProviderInfo>([[companyId, providerInfo]]),
    submitterInfo,
  );
  const filename = generateEDIFilename(testMode);

  const { error: queueErr } = await supabase
    .from("claim_submission_queue" as any)
    .insert({
      company_id: companyId,
      claim_ids: acceptedClaimIds,
      filename,
      edi_content: ediContent,
      is_test: testMode,
      status: "pending",
    } as any);
  if (queueErr) return { ...EMPTY, blocked, error: queueErr.message };

  const now = new Date().toISOString();
  await supabase
    .from("claim_records" as any)
    .update({
      status: "submitted",
      submitted_at: now,
      exported_at: now,
      is_test_submission: testMode,
    } as any)
    .in("id", acceptedClaimIds);

  await logAuditEvent({
    action: "edi_837p_queued_for_sftp",
    tableName: "claim_submission_queue",
    notes: `Queued ${acceptedClaimIds.length} claim(s) as ${filename}${testMode ? " [TEST]" : ""}`,
    newData: { claim_ids: acceptedClaimIds, filename, test_mode: testMode },
  });

  return {
    ok: true,
    queuedCount: acceptedClaimIds.length,
    filename,
    setupErrors: [],
    blocked,
  };
}
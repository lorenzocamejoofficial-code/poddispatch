// Shared billing constants and utilities for the NEMT OS — Closed-Loop Engine

export const LOCATION_TYPES = [
  "Home",
  "Dialysis Center",
  "Hospital Inpatient",
  "Hospital Outpatient",
  "Emergency Room",
  "Skilled Nursing Facility (SNF)",
  "Assisted Living",
  "Rehab Facility",
  "Other",
] as const;

export type LocationType = (typeof LOCATION_TYPES)[number];

// HCPCS codes for BLS non-emergency ambulance
export const HCPCS = {
  BLS_NON_EMERGENCY: "A0428",
  MILEAGE: "A0425",
} as const;

// Auto-derive HCPCS codes from trip data
export function computeHcpcsCodes(trip: {
  service_level?: string;
  loaded_miles?: number | null;
  wait_time_minutes?: number | null;
  oxygen_required?: boolean;
  bariatric?: boolean;
}): { codes: string[]; modifiers: string[] } {
  const codes: string[] = [HCPCS.BLS_NON_EMERGENCY];
  const modifiers: string[] = [];

  if ((trip.loaded_miles ?? 0) > 0) {
    codes.push(HCPCS.MILEAGE);
  }

  if (trip.oxygen_required) modifiers.push("QM"); // oxygen
  if (trip.bariatric) modifiers.push("QL"); // bariatric
  if ((trip.wait_time_minutes ?? 0) > 0) modifiers.push("TP"); // wait time

  return { codes, modifiers };
}

// Auto-populate origin/destination type from location string + facility map
export function inferLocationType(
  location: string | null,
  facilityTypeMap: Map<string, string>
): LocationType | null {
  if (!location) return null;
  const loc = location.toLowerCase().trim();

  // Check facility map first
  for (const [facilityName, facilityType] of facilityTypeMap) {
    if (loc.includes(facilityName.toLowerCase())) {
      if (facilityType === "dialysis") return "Dialysis Center";
      if (facilityType === "hospital") return "Hospital Inpatient";
      if (facilityType === "snf") return "Skilled Nursing Facility (SNF)";
    }
  }

  // Simple heuristics
  if (loc.includes("dialysis")) return "Dialysis Center";
  if (loc.includes("hospital") || loc.includes("medical center")) return "Hospital Inpatient";
  if (loc.includes("snf") || loc.includes("nursing")) return "Skilled Nursing Facility (SNF)";
  if (loc.includes("rehab")) return "Rehab Facility";
  if (loc.includes("assisted living")) return "Assisted Living";

  // Likely a home address (contains numbers)
  if (/^\d/.test(loc)) return "Home";

  return null;
}

// Loaded miles validation
export interface MilesValidation {
  status: "ok" | "warning" | "error";
  message: string | null;
}

export function validateLoadedMiles(
  miles: number | null,
  typicalMin?: number,
  typicalMax?: number
): MilesValidation {
  if (miles === null || miles === undefined) {
    return { status: "error", message: "Loaded miles missing" };
  }
  if (miles === 0) {
    return { status: "error", message: "Loaded miles cannot be zero" };
  }
  if (miles > 200) {
    return { status: "warning", message: `${miles} miles seems unusually high` };
  }
  if (typicalMin && typicalMax && (miles < typicalMin * 0.5 || miles > typicalMax * 1.5)) {
    return { status: "warning", message: `Typical range: ${typicalMin}–${typicalMax} mi` };
  }
  return { status: "ok", message: null };
}

// ============================================================
// DOCUMENTATION GATES — validation before claim_ready
// ============================================================

export interface DocGateField {
  field: string;
  label: string;
  present: boolean;
  required: boolean;
}

export interface DocGateResult {
  passed: boolean;
  fields: DocGateField[];
  missingCount: number;
  readyPercent: number;
}

export function evaluateDocGates(trip: {
  loaded_miles?: number | null;
  loaded_at?: string | null;
  dropped_at?: string | null;
  dispatch_time?: string | null;
  origin_type?: string | null;
  destination_type?: string | null;
  signature_obtained?: boolean;
  pcs_attached?: boolean;
  clinical_note?: string | null;
  necessity_notes?: string | null;
  bed_confined?: boolean;
  cannot_transfer_safely?: boolean;
  requires_monitoring?: boolean;
  oxygen_during_transport?: boolean;
  crew_ids?: string[];
  truck_id?: string | null;
}): DocGateResult {
  const fields: DocGateField[] = [
    { field: "loaded_at", label: "Loaded timestamp", present: !!trip.loaded_at, required: true },
    { field: "dropped_at", label: "Drop-off timestamp", present: !!trip.dropped_at, required: true },
    { field: "dispatch_time", label: "Dispatch timestamp", present: !!trip.dispatch_time, required: true },
    { field: "loaded_miles", label: "Loaded miles", present: (trip.loaded_miles ?? 0) > 0, required: true },
    { field: "origin_type", label: "Origin type", present: !!trip.origin_type, required: true },
    { field: "destination_type", label: "Destination type", present: !!trip.destination_type, required: true },
    { field: "crew", label: "Crew assigned", present: !!trip.truck_id, required: true },
    { field: "signature_obtained", label: "Signature", present: !!trip.signature_obtained, required: true },
    { field: "pcs_attached", label: "PCS document", present: !!trip.pcs_attached, required: false },
    { field: "necessity_checklist", label: "Medical necessity flag", present: !!(trip.bed_confined || trip.cannot_transfer_safely || trip.requires_monitoring || trip.oxygen_during_transport), required: false },
    { field: "clinical_note", label: "Clinical note", present: !!(trip.clinical_note || trip.necessity_notes), required: false },
  ];

  const requiredFields = fields.filter(f => f.required);
  const missingRequired = requiredFields.filter(f => !f.present);
  const totalPresent = fields.filter(f => f.present).length;

  return {
    passed: missingRequired.length === 0,
    fields,
    missingCount: missingRequired.length,
    readyPercent: Math.round((totalPresent / fields.length) * 100),
  };
}

// Compute missing docs per day for a batch of trips
export function computeMissingDocsCount(trips: Parameters<typeof evaluateDocGates>[0][]): number {
  return trips.filter(t => !evaluateDocGates(t).passed).length;
}

// ============================================================
// CLEAN CLAIM ENGINE — enhanced with structured gates
// ============================================================

export type CleanTripLevel = "clean" | "review" | "blocked";

export interface CleanTripIssue {
  field: string;
  message: string;
  severity: "blocker" | "warning";
}

export interface CleanTripResult {
  level: CleanTripLevel;
  issues: string[];
  structured_issues: CleanTripIssue[];
}

export function computeCleanTripStatus(trip: {
  loaded_miles?: number | null;
  signature_obtained?: boolean;
  pcs_attached?: boolean;
  origin_type?: string | null;
  destination_type?: string | null;
  necessity_notes?: string | null;
  clinical_note?: string | null;
  loaded_at?: string | null;
  dropped_at?: string | null;
  dispatch_time?: string | null;
  bed_confined?: boolean;
  cannot_transfer_safely?: boolean;
  requires_monitoring?: boolean;
  oxygen_during_transport?: boolean;
}, payerRules?: {
  requires_pcs?: boolean;
  requires_signature?: boolean;
  requires_necessity_note?: boolean;
  requires_timestamps?: boolean;
  requires_miles?: boolean;
  requires_auth?: boolean;
} | null, authInfo?: {
  auth_required?: boolean;
  auth_expiration?: string | null;
} | null): CleanTripResult {
  const structured: CleanTripIssue[] = [];

  // Always required for billing
  if (!trip.origin_type) structured.push({ field: "origin_type", message: "Missing origin type", severity: "blocker" });
  if (!trip.destination_type) structured.push({ field: "destination_type", message: "Missing destination type", severity: "blocker" });
  if (!trip.loaded_miles || trip.loaded_miles <= 0) structured.push({ field: "loaded_miles", message: "Missing loaded miles", severity: "blocker" });

  // Timestamp checks - always required
  if (!trip.loaded_at) structured.push({ field: "loaded_at", message: "Missing loaded timestamp", severity: "blocker" });
  if (!trip.dropped_at) structured.push({ field: "dropped_at", message: "Missing drop-off timestamp", severity: "blocker" });

  // Auth expiry check
  if (authInfo?.auth_required && authInfo.auth_expiration) {
    if (new Date(authInfo.auth_expiration) <= new Date()) {
      structured.push({ field: "auth_expiration", message: "Authorization expired", severity: "blocker" });
    }
  }

  // Payer rule checks
  if (payerRules) {
    if (payerRules.requires_signature && !trip.signature_obtained) structured.push({ field: "signature_obtained", message: "Signature required by payer", severity: "blocker" });
    if (payerRules.requires_pcs && !trip.pcs_attached) structured.push({ field: "pcs_attached", message: "PCS required by payer", severity: "blocker" });
    if (payerRules.requires_necessity_note) {
      if (!trip.necessity_notes && !trip.clinical_note) structured.push({ field: "necessity_notes", message: "Clinical justification note required", severity: "blocker" });
      const hasChecklist = trip.bed_confined || trip.cannot_transfer_safely || trip.requires_monitoring || trip.oxygen_during_transport;
      if (!hasChecklist) structured.push({ field: "necessity_checklist", message: "At least one medical necessity criterion required", severity: "blocker" });
    }
    if (payerRules.requires_timestamps && !trip.dispatch_time) structured.push({ field: "dispatch_time", message: "Dispatch timestamp required", severity: "blocker" });
  } else {
    // Default checks without payer rules
    if (!trip.signature_obtained) structured.push({ field: "signature_obtained", message: "No signature", severity: "warning" });
    if (!trip.pcs_attached) structured.push({ field: "pcs_attached", message: "No PCS", severity: "warning" });
  }

  const blockers = structured.filter(i => i.severity === "blocker");
  const warnings = structured.filter(i => i.severity === "warning");

  if (blockers.length > 0) return { level: "blocked", issues: blockers.map(i => i.message), structured_issues: structured };
  if (warnings.length > 0) return { level: "review", issues: warnings.map(i => i.message), structured_issues: structured };
  return { level: "clean", issues: [], structured_issues: [] };
}

// ============================================================
// PCR TYPE RULES — required fields per PCR type
// ============================================================

export const PCR_TYPES = [
  { value: "nemt_dialysis", label: "NEMT Dialysis" },
  { value: "ift_discharge", label: "IFT Discharge" },
  { value: "emergency_ems", label: "Emergency / EMS" },
  { value: "other", label: "Other" },
] as const;

export type PcrType = (typeof PCR_TYPES)[number]["value"];

export interface PcrFieldRule {
  field: string;
  label: string;
  required: boolean;
}

const BASE_PCR_FIELDS: PcrFieldRule[] = [
  { field: "loaded_miles", label: "Loaded miles", required: true },
  { field: "loaded_at", label: "Loaded timestamp", required: true },
  { field: "dropped_at", label: "Drop-off timestamp", required: true },
  { field: "origin_type", label: "Origin type", required: true },
  { field: "destination_type", label: "Destination type", required: true },
  { field: "signature_obtained", label: "Signature", required: true },
];

const PCR_RULES: Record<PcrType, PcrFieldRule[]> = {
  nemt_dialysis: [
    ...BASE_PCR_FIELDS,
    { field: "pcs_attached", label: "PCS document", required: true },
    { field: "necessity_checklist", label: "Medical necessity flag", required: true },
    { field: "dispatch_time", label: "Dispatch timestamp", required: true },
  ],
  ift_discharge: [
    ...BASE_PCR_FIELDS,
    { field: "pcs_attached", label: "PCS document", required: true },
    { field: "clinical_note", label: "Clinical note", required: true },
    { field: "dispatch_time", label: "Dispatch timestamp", required: true },
  ],
  emergency_ems: [
    ...BASE_PCR_FIELDS,
    { field: "necessity_checklist", label: "Medical necessity flag", required: true },
    { field: "clinical_note", label: "Clinical note", required: true },
    { field: "dispatch_time", label: "Dispatch timestamp", required: true },
  ],
  other: [
    ...BASE_PCR_FIELDS,
  ],
};

export function getPcrRules(pcrType: PcrType | string | null): PcrFieldRule[] {
  return PCR_RULES[(pcrType as PcrType) ?? "other"] ?? PCR_RULES.other;
}

export function evaluatePcrCompleteness(trip: {
  loaded_miles?: number | null;
  loaded_at?: string | null;
  dropped_at?: string | null;
  dispatch_time?: string | null;
  origin_type?: string | null;
  destination_type?: string | null;
  signature_obtained?: boolean;
  pcs_attached?: boolean;
  clinical_note?: string | null;
  necessity_notes?: string | null;
  bed_confined?: boolean;
  cannot_transfer_safely?: boolean;
  requires_monitoring?: boolean;
  oxygen_during_transport?: boolean;
  pcr_type?: string | null;
}): { passed: boolean; missing: PcrFieldRule[]; rules: PcrFieldRule[] } {
  const rules = getPcrRules(trip.pcr_type ?? null);
  const hasNecessity = !!(trip.bed_confined || trip.cannot_transfer_safely || trip.requires_monitoring || trip.oxygen_during_transport);
  const hasClinicalNote = !!(trip.clinical_note || trip.necessity_notes);

  const fieldPresent: Record<string, boolean> = {
    loaded_miles: (trip.loaded_miles ?? 0) > 0,
    loaded_at: !!trip.loaded_at,
    dropped_at: !!trip.dropped_at,
    dispatch_time: !!trip.dispatch_time,
    origin_type: !!trip.origin_type,
    destination_type: !!trip.destination_type,
    signature_obtained: !!trip.signature_obtained,
    pcs_attached: !!trip.pcs_attached,
    clinical_note: hasClinicalNote,
    necessity_checklist: hasNecessity,
  };

  const missing = rules.filter(r => r.required && !fieldPresent[r.field]);
  return { passed: missing.length === 0, missing, rules };
}

// ============================================================
// BILLING QUEUE STATUS — computed per trip for One-Screen view
// ============================================================

export type BillingQueueStatus = "ready" | "review" | "blocked";

export interface BillingOverrideLike {
  trip_id: string;
  is_active?: boolean | null;
}

export interface BillingQueueTrip {
  id: string;
  patient_name: string;
  run_date: string;
  trip_type: string | null;
  pcr_type: string | null;
  truck_name: string;
  status: string;
  expected_revenue: number;
  queue_status: BillingQueueStatus;
  missing_fields: string[];
  blockers: string[];
}

export function computeBillingQueueStatus(
  trip: {
    id: string;
    status: string;
    claim_ready?: boolean | null;
    pcr_type?: string | null;
    loaded_miles?: number | null;
    loaded_at?: string | null;
    dropped_at?: string | null;
    dispatch_time?: string | null;
    origin_type?: string | null;
    destination_type?: string | null;
    signature_obtained?: boolean;
    pcs_attached?: boolean;
    necessity_notes?: string | null;
    clinical_note?: string | null;
    bed_confined?: boolean;
    cannot_transfer_safely?: boolean;
    requires_monitoring?: boolean;
    oxygen_during_transport?: boolean;
    blockers?: string[] | null;
    auth_required?: boolean;
    auth_expiration?: string | null;
  },
  payerRules?: {
    requires_pcs?: boolean;
    requires_signature?: boolean;
    requires_necessity_note?: boolean;
    requires_timestamps?: boolean;
    requires_miles?: boolean;
    requires_auth?: boolean;
  } | null,
  overrideMap?: Map<string, BillingOverrideLike>,
): BillingQueueStatus {
  const activeOverride = overrideMap?.get(trip.id);
  if (trip.claim_ready || (activeOverride && activeOverride.is_active !== false)) {
    return "ready";
  }

  if (!["completed", "ready_for_billing"].includes(trip.status)) {
    return "blocked";
  }

  const pcrResult = evaluatePcrCompleteness(trip);
  const cleanResult = computeCleanTripStatus(
    trip,
    payerRules,
    { auth_required: trip.auth_required, auth_expiration: trip.auth_expiration }
  );

  if (cleanResult.level === "blocked") return "blocked";
  if (!pcrResult.passed || cleanResult.level === "review") return "review";
  return "ready";
}

// ============================================================
// DENIAL TRACKING
// ============================================================

export const DENIAL_CATEGORIES = [
  "missing_auth",
  "missing_medical_necessity",
  "duplicate_claim",
  "missing_pcs_signature",
  "incorrect_hcpcs",
  "timely_filing",
  "invalid_member_id",
  "other",
] as const;

export type DenialCategory = (typeof DENIAL_CATEGORIES)[number];

export const DENIAL_LABELS: Record<DenialCategory, string> = {
  missing_auth: "Missing Authorization",
  missing_medical_necessity: "Missing Medical Necessity",
  duplicate_claim: "Duplicate Claim",
  missing_pcs_signature: "Missing PCS / Signature",
  incorrect_hcpcs: "Incorrect HCPCS",
  timely_filing: "Timely Filing Exceeded",
  invalid_member_id: "Invalid Member ID",
  other: "Other",
};

// ============================================================
// FINANCIAL METRICS — closed-loop dashboard computations
// ============================================================

export interface FinancialMetrics {
  revenueCaptured: number;
  revenueAtRisk: number;
  revenueDelayed: number;
  cleanClaimRate: number;
  dispatchEfficiency: number;
  missingDocsCount: number;
  completedTrips: number;
  plannedTrips: number;
  blockedTrips: number;
  latePickupCascades: number;
}

export function computeFinancialMetrics(
  trips: {
    status: string;
    expected_revenue?: number;
    claim_ready?: boolean;
    billing_blocked_reason?: string | null;
    blockers?: string[];
  }[],
  claims: {
    total_charge: number;
    status: string;
    submitted_at: string | null;
    paid_at: string | null;
  }[],
  avgPaymentDays: number,
  billingCadenceDays: number,
): FinancialMetrics {
  const completedStatuses = ["completed", "ready_for_billing", "arrived_dropoff"];
  const terminalStatuses = [...completedStatuses, "no_show", "cancelled"];

  const completed = trips.filter(t => completedStatuses.includes(t.status));
  const blocked = completed.filter(t => t.billing_blocked_reason || (t.blockers && t.blockers.length > 0));
  const clean = completed.filter(t => t.claim_ready && !t.billing_blocked_reason);
  const planned = trips.filter(t => t.status !== "cancelled");

  const revenueCaptured = claims
    .filter(c => ["submitted", "paid"].includes(c.status))
    .reduce((s, c) => s + c.total_charge, 0);

  const revenueAtRisk = blocked.reduce((s, t) => s + (t.expected_revenue ?? 0), 0);

  const submittedUnpaid = claims.filter(c => c.status === "submitted" && c.submitted_at);
  const revenueDelayed = submittedUnpaid.reduce((s, c) => s + c.total_charge, 0);

  const cleanClaimRate = completed.length > 0 ? (clean.length / completed.length) * 100 : 0;
  const dispatchEfficiency = planned.length > 0 ? (completed.length / planned.length) * 100 : 0;

  const missingDocsCount = blocked.length;

  return {
    revenueCaptured: Math.round(revenueCaptured),
    revenueAtRisk: Math.round(revenueAtRisk),
    revenueDelayed: Math.round(revenueDelayed),
    cleanClaimRate: Math.round(cleanClaimRate),
    dispatchEfficiency: Math.round(dispatchEfficiency),
    missingDocsCount,
    completedTrips: completed.length,
    plannedTrips: planned.length,
    blockedTrips: blocked.length,
    latePickupCascades: 0, // computed from status_updates at query time
  };
}

// ============================================================
// AR AGING
// ============================================================

export interface AgingBucket {
  label: string;
  min: number;
  max: number;
  total: number;
  count: number;
}

export function computeAgingBuckets(claims: {
  total_charge: number;
  submitted_at: string | null;
  status: string;
}[]): AgingBucket[] {
  const now = Date.now();
  const DAY = 86400000;
  const buckets: AgingBucket[] = [
    { label: "0–30 days", min: 0, max: 30, total: 0, count: 0 },
    { label: "31–60 days", min: 31, max: 60, total: 0, count: 0 },
    { label: "61–90 days", min: 61, max: 90, total: 0, count: 0 },
    { label: "90+ days", min: 91, max: Infinity, total: 0, count: 0 },
  ];

  for (const c of claims) {
    if (!["ready_to_bill", "submitted", "needs_correction"].includes(c.status)) continue;
    const submittedDate = c.submitted_at ? new Date(c.submitted_at).getTime() : now;
    const ageDays = Math.floor((now - submittedDate) / DAY);

    for (const b of buckets) {
      if (ageDays >= b.min && ageDays <= b.max) {
        b.total += c.total_charge;
        b.count++;
        break;
      }
    }
  }

  return buckets;
}

export function computeAverageDaysToPayment(claims: {
  submitted_at: string | null;
  paid_at: string | null;
  status: string;
}[]): number | null {
  const paidClaims = claims.filter(c => c.status === "paid" && c.submitted_at && c.paid_at);
  if (paidClaims.length === 0) return null;

  const DAY = 86400000;
  const total = paidClaims.reduce((sum, c) => {
    const days = Math.floor((new Date(c.paid_at!).getTime() - new Date(c.submitted_at!).getTime()) / DAY);
    return sum + Math.max(0, days);
  }, 0);

  return Math.round(total / paidClaims.length);
}

// ============================================================
// BILLING PACKET — structured export per trip
// ============================================================

export interface BillingPacket {
  trip_id: string;
  patient_name: string;
  run_date: string;
  trip_type: string;
  origin: { location: string | null; type: string | null };
  destination: { location: string | null; type: string | null };
  timestamps: { dispatch: string | null; loaded: string | null; dropped: string | null };
  loaded_miles: number | null;
  hcpcs_codes: string[];
  hcpcs_modifiers: string[];
  payer: string | null;
  auth_number: string | null;
  signature_obtained: boolean;
  pcs_attached: boolean;
  medical_necessity: {
    bed_confined: boolean;
    cannot_transfer_safely: boolean;
    requires_monitoring: boolean;
    oxygen_during_transport: boolean;
    clinical_note: string | null;
  };
  claim_status: string;
  blockers: string[];
  expected_revenue: number;
}

export function buildBillingPacket(trip: any, patientName: string): BillingPacket {
  return {
    trip_id: trip.id,
    patient_name: patientName,
    run_date: trip.run_date,
    trip_type: trip.trip_type ?? "dialysis",
    origin: { location: trip.pickup_location, type: trip.origin_type },
    destination: { location: trip.destination_location, type: trip.destination_type },
    timestamps: { dispatch: trip.dispatch_time, loaded: trip.loaded_at, dropped: trip.dropped_at },
    loaded_miles: trip.loaded_miles,
    hcpcs_codes: trip.hcpcs_codes ?? [],
    hcpcs_modifiers: trip.hcpcs_modifiers ?? [],
    payer: trip.payer ?? null,
    auth_number: trip.auth_number ?? null,
    signature_obtained: trip.signature_obtained ?? false,
    pcs_attached: trip.pcs_attached ?? false,
    medical_necessity: {
      bed_confined: trip.bed_confined ?? false,
      cannot_transfer_safely: trip.cannot_transfer_safely ?? false,
      requires_monitoring: trip.requires_monitoring ?? false,
      oxygen_during_transport: trip.oxygen_during_transport ?? false,
      clinical_note: trip.clinical_note ?? trip.necessity_notes ?? null,
    },
    claim_status: trip.claim_ready ? "clean" : "blocked",
    blockers: trip.blockers ?? [],
    expected_revenue: trip.expected_revenue ?? 0,
  };
}

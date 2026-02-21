// Shared billing constants and utilities for the NEMT OS

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

// Clean trip badge logic — enhanced with structured medical necessity
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
      if (!trip.necessity_notes) structured.push({ field: "necessity_notes", message: "Clinical justification note required", severity: "blocker" });
      // Check structured checklist - at least one must be checked
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

// AR aging bucket calculator
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

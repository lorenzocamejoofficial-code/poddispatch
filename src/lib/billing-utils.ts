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

// Clean trip badge logic
export type CleanTripLevel = "clean" | "review" | "blocked";

export interface CleanTripResult {
  level: CleanTripLevel;
  issues: string[];
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
}, payerRules?: {
  requires_pcs?: boolean;
  requires_signature?: boolean;
  requires_necessity_note?: boolean;
  requires_timestamps?: boolean;
  requires_miles?: boolean;
  requires_auth?: boolean;
} | null): CleanTripResult {
  const issues: string[] = [];
  const blockers: string[] = [];

  // Always required for billing
  if (!trip.origin_type) blockers.push("Missing origin type");
  if (!trip.destination_type) blockers.push("Missing destination type");
  if (!trip.loaded_miles || trip.loaded_miles <= 0) blockers.push("Missing loaded miles");

  // Payer rule checks
  if (payerRules) {
    if (payerRules.requires_signature && !trip.signature_obtained) blockers.push("Signature required");
    if (payerRules.requires_pcs && !trip.pcs_attached) blockers.push("PCS required");
    if (payerRules.requires_necessity_note && !trip.necessity_notes) issues.push("Necessity note missing");
    if (payerRules.requires_timestamps && (!trip.loaded_at || !trip.dropped_at)) blockers.push("Timestamps required");
    if (payerRules.requires_miles && (!trip.loaded_miles || trip.loaded_miles <= 0)) {
      // already covered above
    }
  } else {
    // Default checks without payer rules
    if (!trip.signature_obtained) issues.push("No signature");
    if (!trip.pcs_attached) issues.push("No PCS");
  }

  if (blockers.length > 0) return { level: "blocked", issues: blockers };
  if (issues.length > 0) return { level: "review", issues };
  return { level: "clean", issues: [] };
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

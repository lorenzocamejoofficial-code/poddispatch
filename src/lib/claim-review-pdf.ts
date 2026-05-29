import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { resolvePayerForClaim, type PayerResolution } from "@/lib/payer-directory-lookup";
import { ICD10_DESCRIPTIONS } from "@/lib/icd10-codes";

/**
 * Claim Review PDF — biller-facing claim summary
 * ----------------------------------------------
 * Builds the SAME claim envelope the 837P generator emits, then renders it
 * as a one-page-per-claim PDF an experienced ambulance biller can audit at
 * a glance. Every standardized code (HCPCS, origin/dest letter, modifiers,
 * SBR09 filing indicator, ICD-10, CRC, CR1-04) is rendered with its plain-
 * English meaning.
 *
 * Data path parity (CRITICAL):
 *   This module MUST read from the same resolved payer/envelope the
 *   generator uses, so the PDF and the 837P never disagree.
 *     - Payer name / OA payer ID / SBR09 → resolvePayerForClaim()
 *     - Origin / destination letter pair → mirrors edi-837p-generator
 *       locationTypeCode() (duplicated here because the generator does not
 *       export it; see comment block on LOCATION_CODE_TABLE below).
 *     - CR1-04 transport reason → mirrors buildCr1ReasonCode().
 *     - CRC certification codes → mirrors buildCrcCodes().
 *
 * Nothing internal is shown on the page: no UUIDs, no claim_records column
 * names, no artifact filenames, no scenario slugs. Scenario context (when
 * supplied) appears once in a small header chip — never inside patient data.
 */

// ── Plain-English lookups ──────────────────────────────────────────────
/** HCPCS ambulance procedure codes most commonly billed by NEMT providers. */
const HCPCS_DESCRIPTIONS: Record<string, string> = {
  A0425: "Ground mileage, per statute mile",
  A0426: "Ambulance service, ALS, non-emergency (ALS1)",
  A0427: "Ambulance service, ALS, emergency (ALS1-E)",
  A0428: "Ambulance service, BLS, non-emergency",
  A0429: "Ambulance service, BLS, emergency",
  A0432: "Paramedic intercept (PI), rural area",
  A0433: "Advanced life support, level 2 (ALS2)",
  A0434: "Specialty care transport (SCT)",
  A0998: "Ambulance response and treatment, no transport",
  A0999: "Unlisted ambulance service",
};

/** Modifier letters used in the ambulance origin/dest modifier pair (HCPCS
 *  modifier slot 1). Mirrors edi-837p-generator locationTypeCode(). */
const LOCATION_CODE_TABLE: Record<string, string> = {
  D: "Diagnostic or therapeutic site (incl. freestanding dialysis when subtype unknown)",
  E: "Residential, domiciliary, custodial facility (other than 1819 SNF)",
  G: "Hospital-based dialysis facility",
  H: "Hospital",
  I: "Site of transfer (e.g. airport, ferry, ground-to-ground)",
  J: "Freestanding (non-hospital) dialysis facility",
  N: "Skilled Nursing Facility (1819 SNF)",
  P: "Physician's office",
  R: "Residence",
  S: "Scene of accident or acute event",
  X: "Intermediate stop at a physician's office en route",
};

/** Non-locational HCPCS modifiers (CMS ambulance & payer modifiers). */
const NON_LOC_MODIFIERS: Record<string, string> = {
  GY: "Statutorily excluded service",
  GA: "Waiver of liability statement on file (ABN signed)",
  TQ: "BLS transport by volunteer ambulance provider",
  QL: "Patient pronounced dead after ambulance called",
  QM: "Ambulance service provided under arrangement",
  QN: "Ambulance service furnished directly by provider",
  ET: "Emergency transport",
};

/** X12 005010 SBR09 claim filing indicator code set with plain-English
 *  meaning. Mirrors VALID_FILING_INDICATORS in edi-837p-generator. */
const FILING_INDICATOR_LABELS: Record<string, string> = {
  MB: "Medicare Part B",
  MA: "Medicare Part A",
  MC: "Medicaid",
  CI: "Commercial insurance",
  "16": "Health Maintenance Organization (HMO) Medicare risk",
  BL: "Blue Cross / Blue Shield",
  HM: "Health Maintenance Organization (HMO)",
  WC: "Workers' compensation",
  AM: "Automobile medical",
  CH: "CHAMPUS / TRICARE",
  VA: "Veterans Affairs plan",
  ZZ: "Mutually defined — directory fallback, review",
};

/** CMS ambulance CRC*07 certification condition codes. */
const CRC_LABELS: Record<string, string> = {
  "01": "Patient was admitted to a hospital",
  "04": "Patient was bed-confined before and after transport",
  "05": "Patient was bed-confined before transport only",
  "06": "Patient was bed-confined after transport only",
  "07": "Transferred to a non-hospital facility (SNF, dialysis, etc.)",
  "08": "Interfacility transport — patient is a hospital inpatient",
  "09": "Patient was moved by stretcher",
};

/** CR1-04 ambulance transport reason codes. */
const CR1_REASON_LABELS: Record<string, string> = {
  A: "Transported to nearest facility for care of symptoms",
  B: "Transported for benefit of preferred physician",
  C: "Transported for nearness of family members",
  D: "Transported for care of a specialist or specialized equipment",
  E: "Other reason",
};

const PLACE_OF_SERVICE_41 = "41 — Ambulance (Land)";

// ── Mirrors of generator helpers (NOT exported by generator; see header
//    docblock for rationale on duplication). ────────────────────────────
function locationTypeCode(
  type: string | null,
  facilityMeta?: { facility_type?: string | null; dialysis_subtype?: string | null } | null,
): string {
  if (facilityMeta?.facility_type === "dialysis") {
    if (facilityMeta.dialysis_subtype === "hospital_based") return "G";
    if (facilityMeta.dialysis_subtype === "freestanding") return "J";
    return "D";
  }
  if (!type) return "R";
  const t = type.toLowerCase();
  if (t.includes("hospital outpatient") || t === "e") return "E";
  if (t.includes("hospital inpatient") || t.includes("emergency room") || t === "h") return "H";
  if (t.includes("dialysis") || t === "d") return "D";
  if (t.includes("nursing") || t.includes("snf") || t === "n") return "N";
  if (t.includes("scene") || t === "s") return "S";
  if (t.includes("physician") || t.includes("doctor") || t === "p") return "P";
  if (t.includes("site of transfer") || t.includes("ift") || t === "i") return "I";
  if (t.includes("intermediate") || t === "x") return "X";
  return "R";
}

function cr1ReasonCode(destinationType: string | null): "A" | "D" {
  const dest = (destinationType || "").toLowerCase();
  if (dest.includes("dialysis") || dest === "j" || dest === "g") return "D";
  return "A";
}

function crcCodes(args: {
  destinationType: string | null;
  bedConfined: boolean;
  stretcherPlacement: string | null;
}): string[] {
  const codes: string[] = [];
  const dest = (args.destinationType || "").toLowerCase();
  const stretcher = (args.stretcherPlacement || "").toLowerCase();
  if (dest.includes("hospital") && !dest.includes("dialysis")) codes.push("01");
  if (args.bedConfined) codes.push("04");
  if (
    dest.includes("nursing") || dest.includes("snf") || dest.includes("dialysis") ||
    dest === "n" || dest === "j" || dest === "g"
  ) codes.push("07");
  if (stretcher && stretcher !== "ambulatory") codes.push("09");
  return [...new Set(codes)].slice(0, 4);
}

/** Strip scenario slug suffixes the OATEST seeder appends to patient last
 *  names (e.g. "Anderson OATEST-bls-emergency-s-h" → "Anderson"). Never
 *  shown on a biller-facing document. */
function cleanPatientName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/\s+OATEST-[\w-]+\s*$/i, "").trim();
}

// ── Types ──────────────────────────────────────────────────────────────

type ResolvedClaim = {
  claimRef: string;
  runDate: string;
  patient: {
    last: string; first: string;
    dob: string | null;
    sex: string | null;
    memberId: string | null;
    address: string | null;
  };
  payer: {
    name: string;
    oaPayerId: string;
    payerType: string | null;
    filingIndicator: string;
    matchStrategy: string;
    resolutionError: string | null;
  };
  secondary: { name: string; memberId: string | null } | null;
  service: {
    placeOfService: string;
    originType: string | null;
    destinationType: string | null;
    originLetter: string;
    destinationLetter: string;
    originAddress: string | null;
    destinationAddress: string | null;
    loadedMiles: number | null;
    cr1Reason: string;
    serviceLevel: string | null;
    isEmergency: boolean;
  };
  lines: {
    hcpcs: string;
    modifiers: string[];
    units: number;
    charge: number;
  }[];
  charges: { base: number; mileage: number; extras: number; total: number };
  diagnoses: { code: string; description: string }[];
  pointerPattern: string;
  medical: {
    chiefComplaint: string | null;
    primaryImpression: string | null;
    bedConfined: boolean;
    stretcherPlacement: string | null;
    medicalNecessityReason: string | null;
    weightLbs: number | null;
    crcCodes: string[];
  };
  pcs: {
    onFile: boolean;
    physicianName: string | null;
    physicianNpi: string | null;
    expiration: string | null;
    certificationDate: string | null;
  };
  billingProvider: {
    name: string | null;
    npi: string | null;
    taxId: string | null;
    state: string | null;
  };
  isSimulated: boolean;
};

// ── Data loader ────────────────────────────────────────────────────────

async function loadClaimEnvelope(claimId: string): Promise<ResolvedClaim> {
  const { data: c, error: cerr } = await (supabase as any)
    .from("claim_records")
    .select(`
      id, company_id, run_date, payer_type, payer_name, member_id, auth_number,
      base_charge, mileage_charge, extras_charge, total_charge,
      icd10_codes, hcpcs_codes, hcpcs_modifiers,
      origin_type, destination_type, origin_zip, destination_zip,
      origin_address, origin_city, origin_state,
      destination_address, destination_city, destination_state,
      service_level, chief_complaint, primary_impression,
      medical_necessity_reason, stretcher_placement, patient_sex,
      pcs_physician_name, pcs_physician_npi, pcs_certification_date,
      pcs_document_on_file, is_simulated,
      trip_id, patient_id
    `)
    .eq("id", claimId)
    .maybeSingle();
  if (cerr) throw new Error(cerr.message);
  if (!c) throw new Error("Claim record not found");

  const [{ data: pat }, { data: trip }, { data: company }] = await Promise.all([
    c.patient_id
      ? (supabase as any).from("patients")
          .select("first_name,last_name,dob,sex,pickup_address,member_id,primary_payer,secondary_payer,secondary_payer_id,pcs_on_file,pcs_expiration_date,pcs_physician_name,pcs_physician_npi,weight_lbs")
          .eq("id", c.patient_id).maybeSingle()
      : Promise.resolve({ data: null }),
    c.trip_id
      ? (supabase as any).from("trip_records")
          .select("loaded_miles,bed_confined,stretcher_required,stretcher_placement,chief_complaint,primary_impression,medical_necessity_reason,weight_lbs,is_emergency_pcr,emergency_upgrade_at,destination_location,pickup_location")
          .eq("id", c.trip_id).maybeSingle()
      : Promise.resolve({ data: null }),
    (supabase as any).from("companies")
      .select("name,npi_number,ein_number,address_state,state_of_operation")
      .eq("id", c.company_id).maybeSingle(),
  ]);

  // Resolve payer through the same path the generator uses.
  const resolution: PayerResolution = await resolvePayerForClaim({
    company_id: c.company_id,
    payer_name: c.payer_name,
    payer_type: c.payer_type,
  });

  const patient = pat ?? {};
  const t = trip ?? {};

  // Patient name: strip scenario slug suffix the OATEST seeder appends.
  const last = cleanPatientName(patient.last_name);
  const first = cleanPatientName(patient.first_name);

  // Resolve origin/destination facility metadata so dialysis-subtype-driven
  // letters (G hospital-based / J freestanding) match what
  // queue-claims-for-submission.ts → generateEDI837P emits. Without this,
  // the PDF would default to "D" (generic dialysis) while the EDI emits
  // G or J, and the modifier pair would diverge from the actual SV1 line.
  const facilityNames = [t.pickup_location, t.destination_location]
    .map((n: string | null) => (n || "").trim()).filter(Boolean) as string[];
  let originMeta: { facility_type: string | null; dialysis_subtype: string | null } | null = null;
  let destMeta: { facility_type: string | null; dialysis_subtype: string | null } | null = null;
  if (facilityNames.length) {
    const { data: facs } = await (supabase as any)
      .from("facilities")
      .select("name,facility_type,dialysis_subtype")
      .eq("company_id", c.company_id)
      .in("name", facilityNames);
    const byName: Record<string, any> = {};
    (facs ?? []).forEach((f: any) => { byName[f.name] = f; });
    const o = t.pickup_location ? byName[t.pickup_location.trim()] : null;
    const d = t.destination_location ? byName[t.destination_location.trim()] : null;
    if (o) originMeta = { facility_type: o.facility_type, dialysis_subtype: o.dialysis_subtype ?? null };
    if (d) destMeta = { facility_type: d.facility_type, dialysis_subtype: d.dialysis_subtype ?? null };
  }
  const originLetter = locationTypeCode(c.origin_type, originMeta);
  const destLetter = locationTypeCode(c.destination_type, destMeta);
  const facilityPair = `${originLetter}${destLetter}`;

  // Service lines mirroring the generator's SV1 emission.
  // The generator builds modifiers as ensureQn([facilityCode, ...hcpcs_modifiers])
  // — a single origin/dest pair plus non-locational mods plus QN. Some claim
  // records have a stale 2-letter location pair persisted in hcpcs_modifiers
  // (legacy seed data); render only the resolved pair so the PDF matches the
  // single SV1 line the EDI actually emits.
  const isLocationPair = (m: string) =>
    /^[A-Z]{2}$/.test(m) &&
    LOCATION_CODE_TABLE[m[0]] !== undefined &&
    LOCATION_CODE_TABLE[m[1]] !== undefined;
  const lines: ResolvedClaim["lines"] = [];
  const mods = (c.hcpcs_modifiers ?? []) as string[];
  const nonLocMods = mods.filter((m) => !isLocationPair(m));
  const baseHcpcs = (c.hcpcs_codes ?? []).find((h: string) => h !== "A0425");
  if (baseHcpcs) {
    lines.push({
      hcpcs: baseHcpcs,
      modifiers: [facilityPair, ...nonLocMods],
      units: 1,
      charge: Number(c.base_charge ?? 0),
    });
  }
  if ((c.hcpcs_codes ?? []).includes("A0425") && (t.loaded_miles ?? 0) > 0) {
    lines.push({
      hcpcs: "A0425",
      modifiers: [facilityPair],
      units: Number(t.loaded_miles ?? 0),
      charge: Number(c.mileage_charge ?? 0),
    });
  }

  const icds = (c.icd10_codes ?? []) as string[];
  const diagnoses = icds.map((code) => ({
    code,
    description: ICD10_DESCRIPTIONS[code] ?? "(no description on file)",
  }));
  const pointer = icds.length
    ? Array.from({ length: Math.min(icds.length, 4) }, (_, i) => i + 1).join(":")
    : "—";

  const isEmergency = !!(t.is_emergency_pcr || t.emergency_upgrade_at);
  const crc = crcCodes({
    destinationType: c.destination_type,
    bedConfined: !!t.bed_confined,
    stretcherPlacement: t.stretcher_placement ?? null,
  });

  let payerBlock: ResolvedClaim["payer"];
  const r = resolution as PayerResolution;
  if (r.ok === true) {
    payerBlock = {
      name: r.payer_name,
      oaPayerId: r.oa_payer_id,
      payerType: c.payer_type ?? null,
      filingIndicator: r.claim_filing_indicator,
      matchStrategy: r.match_strategy,
      resolutionError: null,
    };
  } else {
    payerBlock = {
      name: c.payer_name || "",
      oaPayerId: "",
      payerType: c.payer_type ?? null,
      filingIndicator: "",
      matchStrategy: "",
      resolutionError: `${r.reason}${r.detail ? ` — ${r.detail}` : ""}`,
    };
  }

  // Short, biller-friendly claim reference (matches generator's CLM01).
  const claimRef = (() => {
    const datePart = String(c.run_date ?? "").replace(/-/g, "").slice(2);
    const idPart = String(c.id).replace(/-/g, "").slice(0, 8).toUpperCase();
    return `${datePart}-${idPart}`;
  })();

  const originAddr = [c.origin_address, c.origin_city, c.origin_state, c.origin_zip]
    .filter(Boolean).join(", ") || t.pickup_location || null;
  const destAddr = [c.destination_address, c.destination_city, c.destination_state, c.destination_zip]
    .filter(Boolean).join(", ") || t.destination_location || null;

  return {
    claimRef,
    runDate: c.run_date ?? "",
    patient: {
      last: last || "",
      first: first || "",
      dob: patient.dob ?? null,
      sex: c.patient_sex ?? patient.sex ?? null,
      memberId: c.member_id ?? patient.member_id ?? null,
      address: patient.pickup_address ?? null,
    },
    payer: payerBlock,
    secondary: patient.secondary_payer
      ? { name: patient.secondary_payer, memberId: patient.secondary_payer_id ?? null }
      : null,
    service: {
      placeOfService: PLACE_OF_SERVICE_41,
      originType: c.origin_type ?? null,
      destinationType: c.destination_type ?? null,
      originLetter,
      destinationLetter: destLetter,
      originAddress: originAddr,
      destinationAddress: destAddr,
      loadedMiles: t.loaded_miles ?? null,
      cr1Reason: cr1ReasonCode(c.destination_type),
      serviceLevel: c.service_level ?? null,
      isEmergency,
    },
    lines,
    charges: {
      base: Number(c.base_charge ?? 0),
      mileage: Number(c.mileage_charge ?? 0),
      extras: Number(c.extras_charge ?? 0),
      total: Number(c.total_charge ?? 0),
    },
    diagnoses,
    pointerPattern: pointer,
    medical: {
      chiefComplaint: t.chief_complaint ?? c.chief_complaint ?? null,
      primaryImpression: t.primary_impression ?? c.primary_impression ?? null,
      bedConfined: !!t.bed_confined,
      stretcherPlacement: t.stretcher_placement ?? c.stretcher_placement ?? null,
      medicalNecessityReason: t.medical_necessity_reason ?? c.medical_necessity_reason ?? null,
      weightLbs: t.weight_lbs ?? patient.weight_lbs ?? null,
      crcCodes: crc,
    },
    pcs: {
      onFile: !!(patient.pcs_on_file ?? c.pcs_document_on_file),
      physicianName: c.pcs_physician_name ?? patient.pcs_physician_name ?? null,
      physicianNpi: c.pcs_physician_npi ?? patient.pcs_physician_npi ?? null,
      expiration: patient.pcs_expiration_date ?? null,
      certificationDate: c.pcs_certification_date ?? null,
    },
    billingProvider: {
      name: company?.name ?? null,
      npi: company?.npi_number ?? null,
      taxId: company?.ein_number ?? null,
      state: company?.address_state ?? company?.state_of_operation ?? null,
    },
    isSimulated: !!c.is_simulated,
  };
}

// ── PDF renderer ───────────────────────────────────────────────────────

export async function downloadClaimReviewPdf(opts: {
  artifactId?: string | null;
  claimId?: string | null;
  runFilename?: string | null;
  scenarioName?: string | null;
}): Promise<void> {
  const { artifactId, claimId, runFilename, scenarioName } = opts;
  if (!artifactId && !claimId && !runFilename) throw new Error("No claim generated");

  // Resolve which claim IDs to render. We never re-parse EDI: artifact rows
  // carry the originating claim IDs, so the same envelope the generator
  // emitted is rebuilt here.
  let claimIds: string[] = [];
  if (artifactId) {
    const { data } = await (supabase as any).from("claim_submission_artifacts")
      .select("claim_ids").eq("id", artifactId).maybeSingle();
    if (data?.claim_ids?.length) claimIds = data.claim_ids;
  }
  if (!claimIds.length && runFilename) {
    const { data } = await (supabase as any).from("claim_submission_artifacts")
      .select("claim_ids").eq("filename", runFilename).maybeSingle();
    if (data?.claim_ids?.length) claimIds = data.claim_ids;
  }
  if (!claimIds.length && claimId) claimIds = [claimId];
  if (!claimIds.length) throw new Error("No claim available to render");

  const envelopes = await Promise.all(claimIds.map(loadClaimEnvelope));

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const MARGIN = 48;
  const COL_LABEL_W = 150;

  const today = new Date().toISOString().slice(0, 10);

  envelopes.forEach((e, idx) => {
    if (idx > 0) doc.addPage();
    renderClaim(doc, e, {
      pageW: PAGE_W, pageH: PAGE_H, margin: MARGIN, labelW: COL_LABEL_W,
      scenarioName: scenarioName ?? null, today,
    });
  });

  const safe = (envelopes[0]?.claimRef || "claim").replace(/[^\w.-]+/g, "_");
  doc.save(`claim-review_${safe}.pdf`);
}

// ── Layout primitives ──────────────────────────────────────────────────

type Ctx = {
  pageW: number; pageH: number; margin: number; labelW: number;
  scenarioName: string | null; today: string;
};

const COLORS = {
  ink: [30, 30, 30] as const,
  muted: [120, 120, 130] as const,
  rule: [210, 210, 215] as const,
  band: [245, 246, 250] as const,
  brand: [22, 51, 94] as const,    // deep navy
  accent: [60, 100, 160] as const,
  warn: [180, 60, 60] as const,
};

const MISSING_LABEL = "missing — required";

function renderClaim(doc: jsPDF, e: ResolvedClaim, ctx: Ctx) {
  let y = ctx.margin;

  // ── Top brand bar ────────────────────────────────────────────────────
  doc.setFillColor(...COLORS.brand);
  doc.rect(0, 0, ctx.pageW, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("PodDispatch  ·  Claim Review Packet", ctx.margin, 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Generated ${ctx.today}`, ctx.pageW - ctx.margin, 22, { align: "right" });
  doc.setTextColor(...COLORS.ink);
  y = 54;

  // ── Header banner: claim ref, DOS, total, status chips ───────────────
  doc.setFillColor(...COLORS.band);
  doc.rect(ctx.margin, y, ctx.pageW - ctx.margin * 2, 56, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`Claim ${e.claimRef}`, ctx.margin + 12, y + 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);
  doc.text(
    `Date of service ${e.runDate || "—"}    ·    Place of service ${e.service.placeOfService}`,
    ctx.margin + 12, y + 36,
  );
  doc.text(
    e.service.isEmergency ? "Emergency transport" : "Non-emergency transport",
    ctx.margin + 12, y + 50,
  );
  // Right side: total charge
  doc.setTextColor(...COLORS.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(`$${e.charges.total.toFixed(2)}`,
    ctx.pageW - ctx.margin - 12, y + 26, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);
  doc.text("total billed charge",
    ctx.pageW - ctx.margin - 12, y + 40, { align: "right" });
  doc.setTextColor(...COLORS.ink);
  y += 70;

  // ── Section 1: PAYER ROUTING ─────────────────────────────────────────
  y = sectionHeader(doc, ctx, y, "Payer routing");
  if (e.payer.resolutionError) {
    y = kv(doc, ctx, y, "Status", `Cannot route — ${e.payer.resolutionError}`, { warn: true });
  } else {
    y = kv(doc, ctx, y, "Primary payer", e.payer.name);
    y = kv(doc, ctx, y, "Office Ally payer ID", e.payer.oaPayerId);
    const fi = e.payer.filingIndicator;
    y = kv(doc, ctx, y, "Claim filing indicator (SBR09)",
      `${fi}  —  ${FILING_INDICATOR_LABELS[fi] ?? "(unknown code)"}`);
    y = kv(doc, ctx, y, "Directory match", strategyLabel(e.payer.matchStrategy));
  }
  if (e.secondary) {
    y = kv(doc, ctx, y, "Secondary payer",
      `${e.secondary.name}${e.secondary.memberId ? "  ·  member " + e.secondary.memberId : ""}`);
  }

  // ── Section 2: PATIENT ───────────────────────────────────────────────
  y = sectionHeader(doc, ctx, y, "Patient");
  const nameDisplay = (e.patient.last || e.patient.first)
    ? `${e.patient.last}, ${e.patient.first}`.replace(/^, |, $/g, "")
    : "";
  y = kv(doc, ctx, y, "Name", nameDisplay);
  y = kv(doc, ctx, y, "Date of birth", e.patient.dob);
  y = kv(doc, ctx, y, "Sex", sexLabel(e.patient.sex));
  y = kv(doc, ctx, y, "Member ID", e.patient.memberId);
  y = kv(doc, ctx, y, "Address", e.patient.address);

  // ── Section 3: TRANSPORT ─────────────────────────────────────────────
  y = sectionHeader(doc, ctx, y, "Transport");
  y = kv(doc, ctx, y, "Origin",
    locationLine(e.service.originLetter, e.service.originType, e.service.originAddress));
  y = kv(doc, ctx, y, "Destination",
    locationLine(e.service.destinationLetter, e.service.destinationType, e.service.destinationAddress));
  y = kv(doc, ctx, y, "Loaded miles",
    e.service.loadedMiles == null ? null : e.service.loadedMiles.toFixed(1));
  y = kv(doc, ctx, y, "Transport reason (CR1-04)",
    `${e.service.cr1Reason}  —  ${CR1_REASON_LABELS[e.service.cr1Reason]}`);
  if (e.service.serviceLevel) {
    y = kv(doc, ctx, y, "Service level", e.service.serviceLevel);
  }

  // ── Section 4: SERVICE LINES ─────────────────────────────────────────
  y = sectionHeader(doc, ctx, y, "Service lines");
  if (e.lines.length === 0) {
    y = kv(doc, ctx, y, "Lines", null, { warnText: MISSING_LABEL });
  } else {
    y = serviceLineHeader(doc, ctx, y);
    e.lines.forEach((ln) => { y = serviceLineRow(doc, ctx, y, ln); });
    y += 4;
    y = kv(doc, ctx, y, "Base charge", `$${e.charges.base.toFixed(2)}`);
    y = kv(doc, ctx, y, "Mileage charge", `$${e.charges.mileage.toFixed(2)}`);
    if (e.charges.extras > 0) y = kv(doc, ctx, y, "Extras", `$${e.charges.extras.toFixed(2)}`);
    y = kv(doc, ctx, y, "Total charge", `$${e.charges.total.toFixed(2)}`, { bold: true });
  }

  // ── Section 5: DIAGNOSES ─────────────────────────────────────────────
  y = sectionHeader(doc, ctx, y, "Diagnoses (ICD-10)");
  if (e.diagnoses.length === 0) {
    y = kv(doc, ctx, y, "Codes", null, { warnText: MISSING_LABEL });
  } else {
    e.diagnoses.forEach((d, i) => {
      y = kv(doc, ctx, y, `${i + 1}.  ${d.code}`, d.description);
    });
    y = kv(doc, ctx, y, "Pointer pattern", e.pointerPattern);
  }

  // ── Section 6: MEDICAL NECESSITY ─────────────────────────────────────
  y = sectionHeader(doc, ctx, y, "Medical necessity");
  y = kv(doc, ctx, y, "Chief complaint (dispatch)", e.medical.chiefComplaint);
  y = kv(doc, ctx, y, "Primary impression (on-scene)", e.medical.primaryImpression);
  y = kv(doc, ctx, y, "Bed-confined", yesNo(e.medical.bedConfined));
  y = kv(doc, ctx, y, "Stretcher placement", e.medical.stretcherPlacement);
  y = kv(doc, ctx, y, "Patient weight (lbs)",
    e.medical.weightLbs == null ? null : String(e.medical.weightLbs));
  y = kv(doc, ctx, y, "Medical-necessity narrative", e.medical.medicalNecessityReason);
  if (e.medical.crcCodes.length) {
    e.medical.crcCodes.forEach((c) => {
      y = kv(doc, ctx, y, `Certification (CRC*07) ${c}`, CRC_LABELS[c] ?? "(unknown)");
    });
  } else {
    y = kv(doc, ctx, y, "Certification (CRC*07)", "no condition codes apply");
  }

  // ── Section 7: PCS ───────────────────────────────────────────────────
  y = sectionHeader(doc, ctx, y, "Physician Certification Statement (PCS)");
  y = kv(doc, ctx, y, "PCS on file", yesNo(e.pcs.onFile));
  y = kv(doc, ctx, y, "Certifying physician", e.pcs.physicianName);
  y = kv(doc, ctx, y, "Physician NPI", e.pcs.physicianNpi);
  y = kv(doc, ctx, y, "Certification date", e.pcs.certificationDate);
  y = kv(doc, ctx, y, "Expires", e.pcs.expiration);

  // ── Section 8: BILLING PROVIDER ──────────────────────────────────────
  y = sectionHeader(doc, ctx, y, "Billing provider");
  y = kv(doc, ctx, y, "Organization", e.billingProvider.name);
  y = kv(doc, ctx, y, "Provider NPI", e.billingProvider.npi);
  y = kv(doc, ctx, y, "Tax ID (EIN)", e.billingProvider.taxId);
  y = kv(doc, ctx, y, "State of operation", e.billingProvider.state);

  // ── Footer ───────────────────────────────────────────────────────────
  const footerY = ctx.pageH - 24;
  doc.setDrawColor(...COLORS.rule);
  doc.line(ctx.margin, footerY - 12, ctx.pageW - ctx.margin, footerY - 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  const leftFoot = e.isSimulated
    ? "Synthetic test data — generated for biller review. Not a real billable claim."
    : "Confidential — claim review document.";
  doc.text(leftFoot, ctx.margin, footerY);
  if (ctx.scenarioName) {
    doc.text(`Source: ${ctx.scenarioName}`, ctx.pageW - ctx.margin, footerY, { align: "right" });
  }
  doc.setTextColor(...COLORS.ink);
}

// ── Helpers ─────────────────────────────────────────────────────────────

function sectionHeader(doc: jsPDF, ctx: Ctx, y: number, title: string): number {
  y = ensureRoom(doc, ctx, y, 36);
  y += 10;
  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(1.2);
  doc.line(ctx.margin, y, ctx.margin + 18, y);
  doc.setLineWidth(0.4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...COLORS.brand);
  doc.text(title.toUpperCase(), ctx.margin + 26, y + 3);
  doc.setTextColor(...COLORS.ink);
  return y + 14;
}

function kv(
  doc: jsPDF, ctx: Ctx, y: number,
  label: string, value: string | number | null | undefined,
  opts: { bold?: boolean; warn?: boolean; warnText?: string } = {},
): number {
  const displayMissing = value === null || value === undefined || value === "";
  const text = displayMissing ? (opts.warnText ?? MISSING_LABEL) : String(value);
  const lineH = 13;
  const valueW = ctx.pageW - ctx.margin * 2 - ctx.labelW - 8;
  const wrapped = doc.splitTextToSize(text, valueW);
  y = ensureRoom(doc, ctx, y, wrapped.length * lineH + 2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);
  doc.text(label, ctx.margin, y);

  doc.setFont("helvetica", opts.bold ? "bold" : "normal");
  doc.setFontSize(10);
  if (displayMissing || opts.warn) doc.setTextColor(...COLORS.warn);
  else doc.setTextColor(...COLORS.ink);
  let lineY = y;
  for (const w of wrapped) {
    doc.text(w, ctx.margin + ctx.labelW, lineY);
    lineY += lineH;
  }
  doc.setTextColor(...COLORS.ink);
  return Math.max(y + lineH, lineY);
}

function serviceLineHeader(doc: jsPDF, ctx: Ctx, y: number): number {
  y = ensureRoom(doc, ctx, y, 28);
  doc.setDrawColor(...COLORS.rule);
  doc.line(ctx.margin, y - 4, ctx.pageW - ctx.margin, y - 4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);
  const cols = serviceLineColumns(ctx);
  doc.text("HCPCS / Description", cols.x1, y + 6);
  doc.text("Modifiers", cols.x2, y + 6);
  doc.text("Units", cols.x3, y + 6, { align: "right" });
  doc.text("Charge", cols.x4, y + 6, { align: "right" });
  doc.setTextColor(...COLORS.ink);
  doc.line(ctx.margin, y + 10, ctx.pageW - ctx.margin, y + 10);
  return y + 18;
}

function serviceLineRow(
  doc: jsPDF, ctx: Ctx, y: number,
  ln: { hcpcs: string; modifiers: string[]; units: number; charge: number },
): number {
  const cols = serviceLineColumns(ctx);
  const desc = HCPCS_DESCRIPTIONS[ln.hcpcs] ?? "(no HCPCS description on file)";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.ink);
  doc.text(ln.hcpcs, cols.x1, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);
  const descWrapped = doc.splitTextToSize(desc, cols.x2 - cols.x1 - 6);
  doc.text(descWrapped, cols.x1, y + 11);

  doc.setTextColor(...COLORS.ink);
  const modLines: string[] = [];
  ln.modifiers.forEach((m) => {
    if (/^[A-Z]{2}$/.test(m) && LOCATION_CODE_TABLE[m[0]] && LOCATION_CODE_TABLE[m[1]]) {
      modLines.push(`${m}  origin/dest pair`);
    } else if (NON_LOC_MODIFIERS[m]) {
      modLines.push(`${m}  ${NON_LOC_MODIFIERS[m]}`);
    } else if (m) {
      modLines.push(m);
    }
  });
  doc.setFontSize(9);
  let modY = y;
  if (modLines.length === 0) {
    doc.setTextColor(...COLORS.muted);
    doc.text("—", cols.x2, modY);
  } else {
    modLines.forEach((mline) => {
      const wrapped = doc.splitTextToSize(mline, cols.x3 - cols.x2 - 10);
      doc.setTextColor(...COLORS.ink);
      wrapped.forEach((w: string) => { doc.text(w, cols.x2, modY); modY += 11; });
    });
  }
  doc.setTextColor(...COLORS.ink);
  doc.text(String(ln.units), cols.x3, y, { align: "right" });
  doc.text(`$${ln.charge.toFixed(2)}`, cols.x4, y, { align: "right" });

  const rowH = Math.max(descWrapped.length * 11 + 13, modY - y + 4, 22);
  doc.setDrawColor(...COLORS.rule);
  doc.setLineWidth(0.2);
  doc.line(ctx.margin, y + rowH - 4, ctx.pageW - ctx.margin, y + rowH - 4);
  return y + rowH;
}

function serviceLineColumns(ctx: Ctx) {
  const x1 = ctx.margin;
  const x4 = ctx.pageW - ctx.margin;
  const x3 = x4 - 60;
  const x2 = x1 + 200;
  return { x1, x2, x3, x4 };
}

function ensureRoom(doc: jsPDF, ctx: Ctx, y: number, needed: number): number {
  if (y + needed > ctx.pageH - 50) {
    doc.addPage();
    return ctx.margin;
  }
  return y;
}

function locationLine(letter: string, type: string | null, addr: string | null): string {
  const meaning = LOCATION_CODE_TABLE[letter] ?? "(unknown location code)";
  const typeText = type ? `${type}` : "type unspecified";
  const base = `${letter}  —  ${meaning}  ·  ${typeText}`;
  return addr ? `${base}\n${addr}` : base;
}

function strategyLabel(s: string): string {
  if (s === "oa_payer_id") return "matched on Office Ally payer ID";
  if (s === "payer_name") return "matched on payer name";
  if (s === "payer_type_unique") return "matched on payer type (only one directory row)";
  return s || "—";
}

function sexLabel(s: string | null): string | null {
  if (!s) return null;
  const u = s.toUpperCase();
  if (u === "M" || u === "MALE") return "M — Male";
  if (u === "F" || u === "FEMALE") return "F — Female";
  return `${u} — Unknown`;
}

function yesNo(b: boolean): string {
  return b ? "yes" : "no";
}
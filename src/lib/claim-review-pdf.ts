import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

/**
 * Generates a human-readable PDF of a single OATEST claim artifact for an
 * external biller review. Pulls structured data from claim_records (+ joined
 * patients/trip_records) — never re-parses raw EDI. If a field isn't on the
 * record, the PDF prints "—" rather than fabricating a value.
 */
export async function downloadClaimReviewPdf(opts: {
  artifactId?: string | null;
  claimId?: string | null;
  runFilename?: string | null;
  scenarioName?: string | null;
}): Promise<void> {
  const { artifactId, claimId, runFilename, scenarioName } = opts;
  if (!artifactId && !claimId && !runFilename) throw new Error("No claim generated");

  let artifact: any = null;
  if (artifactId) {
    const { data, error } = await (supabase as any)
      .from("claim_submission_artifacts")
      .select("id,filename,claim_ids,generated_at")
      .eq("id", artifactId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    artifact = data;
  }
  if (!artifact && runFilename) {
    const { data, error } = await (supabase as any)
      .from("claim_submission_artifacts")
      .select("id,filename,claim_ids,generated_at")
      .eq("filename", runFilename)
      .maybeSingle();
    if (error) throw new Error(error.message);
    artifact = data;
  }

  const claimIds: string[] = artifact?.claim_ids?.length ? artifact.claim_ids : claimId ? [claimId] : [];
  if (claimIds.length === 0) throw new Error("Artifact contains no claims");

  const { data: claims, error: cerr } = await (supabase as any)
    .from("claim_records")
    .select(`
      id, run_date, payer_type, payer_name, member_id, auth_number,
      base_charge, mileage_charge, extras_charge, total_charge,
      icd10_codes, hcpcs_codes, hcpcs_modifiers,
      origin_type, destination_type, origin_zip, destination_zip,
      origin_address, origin_city, origin_state,
      destination_address, destination_city, destination_state,
      service_level, chief_complaint, primary_impression,
      medical_necessity_reason, stretcher_placement, patient_sex,
      pcs_physician_name, pcs_physician_npi, pcs_certification_date,
      pcs_document_on_file,
      trip_id, patient_id,
      patients:patient_id (
        first_name, last_name, dob, sex, pickup_address,
        member_id, primary_payer, secondary_payer, secondary_payer_id,
        pcs_on_file, pcs_expiration_date,
        pcs_physician_name, pcs_physician_npi,
        prior_auth_utn, weight_lbs
      ),
      trip_records:trip_id (
        loaded_miles, bed_confined, stretcher_required,
        chief_complaint, primary_impression, medical_necessity_reason,
        weight_lbs, is_emergency_pcr, emergency_upgrade_at,
        destination_location
      )
    `)
    .in("id", claimIds);
  if (cerr) throw new Error(cerr.message);
  if (!claims || claims.length === 0) throw new Error("No claim_records found");

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const MARGIN = 40;
  const today = new Date().toISOString().slice(0, 10);

  claims.forEach((c: any, idx: number) => {
    if (idx > 0) doc.addPage();
    let y = MARGIN;

    const setH = (size: number, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
    };
    const line = (text: string, size = 10, bold = false, indent = 0) => {
      setH(size, bold);
      const wrapped = doc.splitTextToSize(text, PAGE_W - MARGIN * 2 - indent);
      for (const w of wrapped) {
        if (y > PAGE_H - MARGIN - 30) { doc.addPage(); y = MARGIN; }
        doc.text(w, MARGIN + indent, y);
        y += size + 3;
      }
    };
    const section = (title: string) => {
      y += 6;
      line(title, 11, true);
      setH(10);
      doc.setDrawColor(180);
      doc.line(MARGIN, y - 8, PAGE_W - MARGIN, y - 8);
    };
    const kv = (k: string, v: any) => {
      const val = v === null || v === undefined || v === "" ? "—" : String(v);
      line(`${k}: ${val}`, 10, false, 12);
    };
    const yn = (v: any) =>
      v === true ? "yes" : v === false ? "no" : "—";

    const p = c.patients ?? {};
    const t = c.trip_records ?? {};

    // Header
    line("PODDISPATCH — CLAIM REVIEW", 14, true);
    line(`Scenario: ${scenarioName ?? "—"}`);
    line(`Generated: ${today}`);
    line(`Artifact filename: ${artifact?.filename ?? runFilename ?? "—"}`);

    // PATIENT
    section("PATIENT");
    const fullName = `${p.last_name ?? "—"}, ${p.first_name ?? "—"}`;
    kv("Name", fullName);
    kv("DOB", p.dob ?? "—");
    kv("Sex", c.patient_sex ?? p.sex ?? "—");
    kv("Member ID", c.member_id ?? p.member_id ?? "—");
    kv("Address", p.pickup_address ?? "—");

    // SERVICE
    section("SERVICE");
    kv("Date of service", c.run_date ?? "—");
    const originAddr = [c.origin_address, c.origin_city, c.origin_state, c.origin_zip]
      .filter(Boolean).join(", ");
    const destAddr = [c.destination_address, c.destination_city, c.destination_state, c.destination_zip]
      .filter(Boolean).join(", ");
    kv("Origin", `${c.origin_type ?? "—"}${originAddr ? " — " + originAddr : ""}`);
    kv("Destination", `${c.destination_type ?? "—"}${destAddr ? " — " + destAddr : t.destination_location ? " — " + t.destination_location : ""}`);
    kv("Loaded miles", t.loaded_miles ?? "—");
    // Origin/Dest modifier: in Loop 2400 SV1 these are the 2-char letter pair
    // derived from origin_type + destination_type. We surface the stored
    // hcpcs_modifiers (which the generator persists alongside the base code).
    const mods = (c.hcpcs_modifiers ?? []) as string[];
    const odMod = mods.find((m) => /^[A-Z]{2}$/.test(m)) ?? "—";
    kv("Origin/Dest modifier", odMod);
    kv("Round trip", "no"); // single-leg artifact; round trips are 2 separate claims
    kv("Emergency", yn(t.is_emergency_pcr || !!t.emergency_upgrade_at));
    kv("Service level", c.service_level ?? "—");

    // CODES
    section("CODES");
    const hcpcs = (c.hcpcs_codes ?? []) as string[];
    if (hcpcs.length === 0) {
      line("HCPCS lines: —", 10, false, 12);
    } else {
      line("HCPCS lines:", 10, false, 12);
      hcpcs.forEach((code, i) => {
        const isMileage = code === "A0425";
        const units = isMileage ? (t.loaded_miles ?? "—") : 1;
        const charge = isMileage
          ? Number(c.mileage_charge ?? 0).toFixed(2)
          : Number(c.base_charge ?? 0).toFixed(2);
        const lineMods = i === 0 ? mods.join(", ") || "—" : "—";
        line(`• ${code}  mods=[${lineMods}]  units=${units}  charge=$${charge}`, 10, false, 24);
      });
    }
    kv("Total charge", `$${Number(c.total_charge ?? 0).toFixed(2)}`);
    const icds = (c.icd10_codes ?? []) as string[];
    kv("Diagnoses (ICD-10)", icds.length ? icds.join(", ") : "—");
    // Pointer pattern: generator emits 1:2:3:4 (up to # of dx) per line
    const ptr = icds.length ? Array.from({ length: Math.min(icds.length, 4) }, (_, i) => i + 1).join(":") : "—";
    kv("Diagnosis pointer pattern", ptr);

    // PAYER
    section("PAYER");
    kv("Primary", `${p.primary_payer ?? c.payer_name ?? "—"}  payer-type=${c.payer_type ?? "—"}`);
    kv("Secondary", p.secondary_payer ? `${p.secondary_payer}  member=${p.secondary_payer_id ?? "—"}` : "—");
    kv("Prior auth UTN", p.prior_auth_utn ?? c.auth_number ?? "none");

    // PCS / CERTIFICATION
    section("PCS / CERTIFICATION");
    kv("PCS on file", yn(p.pcs_on_file ?? c.pcs_document_on_file));
    kv("PCS expiration", p.pcs_expiration_date ?? "n/a");
    const physName = c.pcs_physician_name ?? p.pcs_physician_name ?? "—";
    const physNpi = c.pcs_physician_npi ?? p.pcs_physician_npi ?? "—";
    kv("Certifying physician", `${physName}  NPI ${physNpi}`);
    kv("Bed confined", yn(t.bed_confined));
    kv("Stretcher required", yn(t.stretcher_required));
    kv("Medical necessity reason", t.medical_necessity_reason ?? c.medical_necessity_reason ?? "(none)");

    // CR1 / TRANSPORT
    section("CR1 / TRANSPORT");
    kv("Patient weight (lbs)", t.weight_lbs ?? p.weight_lbs ?? "—");
    // CR1-04 reason code: derived by generator from emergency/condition;
    // not persisted on claim_records as a discrete column. Show "—" rather
    // than fabricate.
    kv("Ambulance transport reason code (CR1-04)", "—");
    kv("Chief complaint", t.chief_complaint ?? c.chief_complaint ?? "—");
    kv("Primary impression", t.primary_impression ?? c.primary_impression ?? "—");

    // Footer
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text("Synthetic test data — not real PHI", PAGE_W / 2, PAGE_H - 20, { align: "center" });
    doc.setTextColor(0);
  });

  const safeName = (artifact?.filename ?? runFilename ?? `claim-${claimIds[0] ?? artifactId}`).replace(/[^\w.-]+/g, "_");
  doc.save(`review_${safeName}.pdf`);
}
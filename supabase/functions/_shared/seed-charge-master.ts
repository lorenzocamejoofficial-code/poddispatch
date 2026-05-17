// Shared helper used by company-signup and create-company.
// Given a brand-new company id + 5-digit ZIP, looks up the CMS locality and
// seeds 5 standard charge_master rows. Medicare is auto-populated from real
// 2026 CMS Ambulance Fee Schedule data for that locality. The other four
// payer types (medicaid, private, self_pay, default) are placeholder rows
// marked needs_review=true so the wizard's "Verify Your Rates" gate forces
// the owner to enter real amounts before completing onboarding.
//
// HCPCS used as the canonical base/mileage rate:
//   A0428 = BLS non-emergency  -> base_rate
//   A0425 = mileage            -> mileage_rate
// (Other HCPCS amounts stay in cms_ambulance_fee_schedule for the 837P
// generator to pull at claim time.)

// deno-lint-ignore no-explicit-any
type SupabaseAdmin = any;

const BASE_HCPCS = "A0428";   // BLS non-emergency base
const MILEAGE_HCPCS = "A0425";

export async function seedChargeMasterForNewCompany(
  supabaseAdmin: SupabaseAdmin,
  companyId: string,
  zip5: string,
): Promise<{ ok: boolean; medicareSeeded: boolean; ruralFlag?: string; error?: string }> {
  try {
    const cleanZip = String(zip5 ?? "").replace(/\D/g, "").slice(0, 5);

    // 1. Lookup carrier+locality+rural flag from ZIP.
    let carrier: string | null = null;
    let locality: string | null = null;
    let ruralFlag: string | null = null;

    if (cleanZip.length === 5) {
      const { data: zipRow } = await supabaseAdmin
        .from("cms_zip_locality")
        .select("carrier, locality, rural_flag")
        .eq("zip5", cleanZip)
        .maybeSingle();
      if (zipRow) {
        carrier = zipRow.carrier;
        locality = zipRow.locality;
        ruralFlag = zipRow.rural_flag;
      }
    }

    // 2. Lookup base + mileage rates for that locality.
    let medicareBase = 0;
    let medicareMileage = 0;
    let medicareSeeded = false;

    if (carrier && locality) {
      const { data: rates } = await supabaseAdmin
        .from("cms_ambulance_fee_schedule")
        .select("hcpcs, urban_rate, rural_rate, rural_lowest_quartile_rate, rural_miles_1_17_rate")
        .eq("carrier", carrier)
        .eq("locality", locality)
        .in("hcpcs", [BASE_HCPCS, MILEAGE_HCPCS]);

      const baseRow = rates?.find((r: any) => r.hcpcs === BASE_HCPCS);
      const mileRow = rates?.find((r: any) => r.hcpcs === MILEAGE_HCPCS);

      // Pick the right column based on rural flag.
      // U = urban, R = rural, B = super-rural (lowest quartile bonus applies).
      const pickBase = (r: any) =>
        ruralFlag === "B" ? (r?.rural_lowest_quartile_rate ?? r?.rural_rate)
        : ruralFlag === "R" ? r?.rural_rate
        : r?.urban_rate;

      const pickMileage = (r: any) =>
        ruralFlag === "B" ? (r?.rural_miles_1_17_rate ?? r?.rural_rate)
        : ruralFlag === "R" ? r?.rural_rate
        : r?.urban_rate;

      const b = baseRow ? Number(pickBase(baseRow)) : NaN;
      const m = mileRow ? Number(pickMileage(mileRow)) : NaN;

      if (Number.isFinite(b) && b > 0) { medicareBase = b; medicareSeeded = true; }
      if (Number.isFinite(m) && m > 0) { medicareMileage = m; }
    }

    // 3. Build 5 standard payer rows.
    const rows = [
      {
        company_id: companyId,
        payer_type: "medicare",
        base_rate: medicareBase,
        mileage_rate: medicareMileage,
        wait_rate_per_min: 0,
        oxygen_fee: 50,
        bariatric_fee: 150,
        auto_seeded: true,
        needs_review: !medicareSeeded, // if lookup failed, owner must enter manually
      },
      // Placeholder rows — owner MUST review before wizard completes.
      { company_id: companyId, payer_type: "medicaid", base_rate: 0, mileage_rate: 0, auto_seeded: true, needs_review: true, oxygen_fee: 0, bariatric_fee: 0 },
      { company_id: companyId, payer_type: "private",  base_rate: 0, mileage_rate: 0, auto_seeded: true, needs_review: true, oxygen_fee: 0, bariatric_fee: 0 },
      { company_id: companyId, payer_type: "self_pay", base_rate: 0, mileage_rate: 0, auto_seeded: true, needs_review: true, oxygen_fee: 0, bariatric_fee: 0 },
      { company_id: companyId, payer_type: "default",  base_rate: 0, mileage_rate: 0, auto_seeded: true, needs_review: true, oxygen_fee: 0, bariatric_fee: 0 },
    ];

    const { error: insertErr } = await supabaseAdmin
      .from("charge_master")
      .insert(rows);

    if (insertErr) {
      return { ok: false, medicareSeeded: false, error: insertErr.message };
    }

    return { ok: true, medicareSeeded, ruralFlag: ruralFlag ?? undefined };
  } catch (err) {
    return { ok: false, medicareSeeded: false, error: String(err) };
  }
}
// OATEST runner — drives `oatest_scenarios` rows through the same product
// pipeline a tenant uses (scheduling_legs → trip_records → submitted PCR →
// auto_create_claim_on_pcr_submit trigger → claim_records) and then queues
// the resulting claim into `claim_submission_queue` with `is_test=true` so
// the SFTP worker uploads it to Office Ally OATEST. Every run is recorded
// in `oatest_runs` with the failure stage so we can see *exactly* where the
// real product code (PCR fields, readiness rules, generator mappings) is
// missing pieces.
//
// Body: { action: "seed" | "submit" | "seed_and_submit", scenario_slug: string, run_id?: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureCmsChargeMasterForCompany } from "../_shared/seed-charge-master.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LORENZO_TEST_COMPANY_ID = "f53311c3-a40e-4b2b-b4c2-5aec852f7789";

type ActionBody = {
  action: "seed" | "submit" | "seed_and_submit" | "preconditions";
  scenario_slug?: string;
  run_id?: string;
  local_date?: string; // YYYY-MM-DD from the caller's browser, so today
                      // matches the Sim Lab seeder preconditions exactly.
};

function ok(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function fail(message: string, extras: Record<string, unknown> = {}, status = 200) {
  return ok({ ok: false, error: message, ...extras }, status);
}

// ── Normalizers ──────────────────────────────────────────────────────────────
const ORIGIN_DEST_MAP: Record<string, string> = {
  R: "residence", residence: "residence", home: "residence",
  D: "dialysis", dialysis: "dialysis",
  H: "hospital", hospital: "hospital",
  N: "snf", snf: "snf", nursing_home: "snf",
  S: "scene", scene: "scene",
  P: "physician_office", physician_office: "physician_office",
};
function normLoc(v: any): string {
  const k = String(v ?? "").trim();
  return ORIGIN_DEST_MAP[k] ?? ORIGIN_DEST_MAP[k.toUpperCase()] ?? "residence";
}
const TRANSPORT_MAP: Record<string, string> = {
  bls: "outpatient", als: "outpatient", emergency: "outpatient",
  dialysis: "dialysis", wound_care: "wound_care", hospice: "ift",
  bariatric: "ift", discharge: "discharge", ift: "ift",
  outpatient: "outpatient", psych_transport: "psych_transport",
};
function normTransport(v: any): string {
  return TRANSPORT_MAP[String(v ?? "").toLowerCase()] ?? "outpatient";
}

// ── Minimal 837P generator (single-claim, OATEST envelope) ───────────────────
function pad2(n: number) { return String(n).padStart(2, "0"); }
function ediDate(d: Date) { return `${d.getUTCFullYear()}${pad2(d.getUTCMonth()+1)}${pad2(d.getUTCDate())}`; }
function ediTime(d: Date) { return `${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}`; }
function s(v: any): string { return String(v ?? "").trim(); }
function clean(v: any): string { return s(v).replace(/[^A-Za-z0-9 ]/g, "").toUpperCase(); }

function build837P(opts: {
  filename: string;
  testMode: boolean;
  provider: { name: string; npi: string; tax_id: string; addr: string; city: string; state: string; zip: string };
  submitter: { name: string; id: string; contact: string; phone: string };
  receiver: { name: string; id: string };
  patient: { first: string; last: string; dob: string; sex: string; member_id: string; addr: string; city: string; state: string; zip: string };
  payer: { name: string; id: string; type: string };
  claim: {
    control: string; charge: number; hcpcs: string; modifiers: string[];
    icd10: string[]; service_date: string; loaded_miles: number;
    origin: { type: string; addr: string; city: string; state: string; zip: string };
    destination: { type: string; addr: string; city: string; state: string; zip: string };
    medical_necessity: string;
  };
}): string {
  const now = new Date();
  const isaDate = ediDate(now).slice(2);
  const ctlNum = String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
  const usage = opts.testMode ? "T" : "P";
  const seg: string[] = [];
  const push = (...parts: string[]) => seg.push(parts.join("*"));
  push("ISA", "00", "          ", "00", "          ", "ZZ", opts.submitter.id.padEnd(15), "ZZ", opts.receiver.id.padEnd(15),
       isaDate, ediTime(now), "^", "00501", ctlNum, "0", usage, ":");
  push("GS", "HC", opts.submitter.id, opts.receiver.id, ediDate(now), ediTime(now), "1", "X", "005010X222A1");
  push("ST", "837", "0001", "005010X222A1");
  push("BHT", "0019", "00", opts.claim.control, ediDate(now), ediTime(now), "CH");
  push("NM1", "41", "2", clean(opts.submitter.name), "", "", "", "", "46", opts.submitter.id);
  push("PER", "IC", clean(opts.submitter.contact), "TE", opts.submitter.phone);
  push("NM1", "40", "2", clean(opts.receiver.name), "", "", "", "", "46", opts.receiver.id);
  push("HL", "1", "", "20", "1");
  push("NM1", "85", "2", clean(opts.provider.name), "", "", "", "", "XX", opts.provider.npi);
  push("N3", clean(opts.provider.addr));
  push("N4", clean(opts.provider.city), opts.provider.state, opts.provider.zip);
  push("REF", "EI", opts.provider.tax_id);
  push("HL", "2", "1", "22", "0");
  push("SBR", "P", "18", "", "", "", "", "", "", clean(opts.payer.type));
  push("NM1", "IL", "1", clean(opts.patient.last), clean(opts.patient.first), "", "", "", "MI", opts.patient.member_id);
  push("N3", clean(opts.patient.addr));
  push("N4", clean(opts.patient.city), opts.patient.state, opts.patient.zip);
  push("DMG", "D8", opts.patient.dob.replace(/-/g, ""), opts.patient.sex);
  push("NM1", "PR", "2", clean(opts.payer.name), "", "", "", "", "PI", opts.payer.id);
  push("CLM", opts.claim.control, opts.claim.charge.toFixed(2), "", "", `41:${opts.claim.origin.type === "residence" ? "B" : "B"}:1`, "Y", "A", "Y", "Y");
  if (opts.claim.icd10.length) {
    const codes = opts.claim.icd10.slice(0, 12).map((c, i) => `${i === 0 ? "ABK" : "ABF"}:${clean(c).replace(".", "")}`).join("*");
    push("HI", codes);
  }
  // Origin / destination addresses
  push("NM1", "PW", "2", clean("Pickup"), "", "", "", "", "");
  push("N3", clean(opts.claim.origin.addr));
  push("N4", clean(opts.claim.origin.city), opts.claim.origin.state, opts.claim.origin.zip);
  push("NM1", "45", "2", clean("Dropoff"), "", "", "", "", "");
  push("N3", clean(opts.claim.destination.addr));
  push("N4", clean(opts.claim.destination.city), opts.claim.destination.state, opts.claim.destination.zip);

  // Service line: HCPCS + modifiers + miles
  const mods = opts.claim.modifiers.slice(0, 4);
  const proc = ["HC", opts.claim.hcpcs, ...mods].join(":");
  push("LX", "1");
  push("SV1", proc, opts.claim.charge.toFixed(2), "UN", "1", "", "", "1");
  push("DTP", "472", "D8", opts.claim.service_date.replace(/-/g, ""));
  if (opts.claim.loaded_miles > 0) {
    push("LX", "2");
    push("SV1", "HC:A0425", (opts.claim.loaded_miles * 7).toFixed(2), "UN", String(opts.claim.loaded_miles), "", "", "1");
    push("DTP", "472", "D8", opts.claim.service_date.replace(/-/g, ""));
  }
  push("SE", String(seg.length + 1), "0001");
  push("GE", "1", "1");
  push("IEA", "1", ctlNum);
  return seg.join("~\n") + "~\n";
}

// ── Main ─────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Caller auth (system creator gate)
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) return fail("Authentication required", {}, 401);

  const { data: isCreator } = await userClient.rpc("is_system_creator");
  if (!isCreator) return fail("System creators only", {}, 403);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const userId = userData.user.id;

  // pcr_submitted_by references profiles(id), NOT auth.users(id). Look up the
  // creator's profile row so the FK on trip_records is satisfied; fall back to
  // null (column is nullable) if no profile exists.
  const { data: creatorProfile } = await admin
    .from("profiles").select("id").eq("user_id", userId).maybeSingle();
  const submitterProfileId: string | null = creatorProfile?.id ?? null;

  let body: ActionBody;
  try { body = await req.json(); } catch { return fail("Invalid JSON body"); }
  if (!body.action) return fail("action is required");

  // Resolve "today" the same way the simulation-lab seeder preconditions do:
  // honor an explicit local_date from the client; otherwise fall back to UTC.
  const todayRe = /^\d{4}-\d{2}-\d{2}$/;
  const today = body.local_date && todayRe.test(body.local_date)
    ? body.local_date
    : new Date().toISOString().slice(0, 10);

  // ── Helpers ──
  const loadScenario = async (slug: string) => {
    const { data, error } = await admin
      .from("oatest_scenarios").select("*").eq("slug", slug).maybeSingle();
    if (error) throw new Error(`scenario lookup failed: ${error.message}`);
    if (!data) throw new Error(`scenario not found: ${slug}`);
    return data;
  };

  // Shared preconditions read: every check the runner depends on, in ONE
  // place. `seed` consumes this; the `preconditions` action just returns it
  // so the UI can render a status panel that matches the Sim Lab seeder.
  const readPreconditions = async () => {
    const [trucksRes, crewsTodayRes, crewsAnyRes, templatesRes, facilitiesRes, companyRes, scenariosRes] = await Promise.all([
      admin.from("trucks").select("id, name, active, is_simulated")
        .eq("company_id", LORENZO_TEST_COMPANY_ID).eq("is_simulated", false).eq("active", true).limit(50),
      admin.from("crews").select("id, truck_id, member1_id, member2_id, member3_id")
        .eq("company_id", LORENZO_TEST_COMPANY_ID).eq("active_date", today),
      admin.from("crews").select("id", { count: "exact", head: true })
        .eq("company_id", LORENZO_TEST_COMPANY_ID),
      admin.from("patients").select("id", { count: "exact", head: true })
        .eq("company_id", LORENZO_TEST_COMPANY_ID).eq("is_template", true),
      admin.from("facilities").select("id", { count: "exact", head: true })
        .eq("company_id", LORENZO_TEST_COMPANY_ID).eq("is_simulated", false),
      admin.from("companies").select("npi_number, ein_number")
        .eq("id", LORENZO_TEST_COMPANY_ID).maybeSingle(),
      admin.from("oatest_scenarios").select("id", { count: "exact", head: true }).eq("enabled", true),
    ]);
    for (const [label, res] of Object.entries({ trucksRes, crewsTodayRes, crewsAnyRes, templatesRes, facilitiesRes, companyRes, scenariosRes })) {
      if ((res as any).error) throw new Error(`${label}: ${(res as any).error.message}`);
    }
    const trucks = trucksRes.data ?? [];
    const activeRealTruckIds = new Set(trucks.map((t: any) => t.id));
    const crewsToday = (crewsTodayRes.data ?? []).filter((c: any) => activeRealTruckIds.has(c.truck_id));
    const truckIdsWithCrew = new Set(crewsToday.map((c: any) => c.truck_id));
    const trucksWithCrewToday = trucks.filter((t: any) => truckIdsWithCrew.has(t.id)).length;
    const providerNpi = s(companyRes.data?.npi_number).replace(/\D/g, "");
    const providerTaxId = s(companyRes.data?.ein_number).replace(/\D/g, "");
    return {
      today,
      companyId: LORENZO_TEST_COMPANY_ID,
      trucks: trucks.length,
      crews: crewsAnyRes.count ?? 0,
      crewsAssignedToday: crewsToday.length,
      trucksWithCrewToday,
      templatePatients: templatesRes.count ?? 0,
      facilities: facilitiesRes.count ?? 0,
      enabledScenarios: scenariosRes.count ?? 0,
      npiOnFile: providerNpi.length === 10 && isLuhnValidNpi(providerNpi),
      taxIdOnFile: providerTaxId.length >= 9,
      raw: { trucks, crewsToday },
    };
  };

  // ── PRECONDITIONS (read-only status for the UI panel) ──
  if (body.action === "preconditions") {
    try {
      const pre = await readPreconditions();
      const { raw: _raw, ...summary } = pre;
      return ok({ ok: true, preconditions: summary });
    } catch (e: any) {
      return fail(`preconditions read failed: ${e.message}`);
    }
  }

  // ── SEED ──
  if (body.action === "seed" || body.action === "seed_and_submit") {
    if (!body.scenario_slug) return fail("scenario_slug is required");
    let scenario: any;
    try { scenario = await loadScenario(body.scenario_slug); } catch (e: any) { return fail(e.message); }

    // Create oatest_runs row up front so we can record failure_stage
    const { data: runRow, error: runErr } = await admin
      .from("oatest_runs").insert({
        scenario_id: scenario.id, status: "seeding", triggered_by: userId,
      }).select("*").single();
    if (runErr) return fail(`could not create oatest_run: ${runErr.message}`);
    const runId = runRow.id;

    const recordFailure = async (stage: string, summary: string, extras: Record<string, unknown> = {}) => {
      await admin.from("oatest_runs").update({
        status: "failed", failure_stage: stage, failure_summary: summary,
        completed_at: new Date().toISOString(), ...extras,
      }).eq("id", runId);
      return fail(summary, { stage, run_id: runId });
    };

    // Pull every precondition the runner depends on and bail with a single,
    // structured failure that the UI panel can render.
    const pre = await readPreconditions();
    const issues: string[] = [];
    if (pre.trucksWithCrewToday === 0) issues.push(`No active truck with a crew assigned today (${today})`);
    if (pre.templatePatients === 0) issues.push("No template patients exist (Patients → Templates)");
    if (pre.facilities === 0) issues.push("No facilities exist");
    if (!pre.npiOnFile || !pre.taxIdOnFile) issues.push("Lorenzo Test Company is missing Provider NPI (must be a 10-digit Luhn-valid NPI) or 9-digit EIN/Tax ID — fix it on the company profile");
    if (pre.enabledScenarios === 0) issues.push("No OATEST scenarios are enabled");
    if (issues.length > 0) {
      const { raw: _raw, ...summary } = pre;
      return await recordFailure(
        "preconditions",
        issues.join(" | "),
        { readiness_issues: { preconditions: summary } as any },
      );
    }
    // Re-read the rows we actually need (templates + facilities full records).
    const [{ data: templates }, { data: facilities }] = await Promise.all([
      admin.from("patients").select("*")
        .eq("company_id", LORENZO_TEST_COMPANY_ID).eq("is_template", true).limit(20),
      admin.from("facilities").select("id, name, facility_type, address")
        .eq("company_id", LORENZO_TEST_COMPANY_ID).eq("is_simulated", false).limit(30),
    ]);
    const truck = pre.raw.trucks.find((t: any) =>
      pre.raw.crewsToday.some((c: any) => c.truck_id === t.id),
    )!;
    const crew = pre.raw.crewsToday.find((c: any) => c.truck_id === truck.id)!;
    if (!templates || templates.length === 0 || !facilities || facilities.length === 0) {
      return await recordFailure("preconditions", "template/facility re-read returned empty");
    }

    // Build a fresh patient cloned from template, overriding payer per scenario
    const tpl = templates[0];
    const tplData = scenario.scenario_template ?? {};
    const desiredPayer = (tplData.patient?.primary_payer ?? tplData.leg?.oneoff_primary_payer ?? scenario.payer_type ?? tpl.primary_payer ?? "medicare").toString().toLowerCase();
    const { id: _x, created_at: _ca, updated_at: _ua, is_template: _it, ...patientRest } = tpl;
    const patientPayload = {
      ...patientRest,
      first_name: tpl.first_name,
      last_name: `${tpl.last_name} OATEST-${body.scenario_slug}`,
      primary_payer: desiredPayer,
      pcs_on_file: tplData.patient?.pcs_on_file ?? true,
      pcs_expiration_date: new Date(Date.now() + 60 * 86400 * 1000).toISOString().slice(0, 10),
      is_template: false,
      is_simulated: true,
      company_id: LORENZO_TEST_COMPANY_ID,
    };
    const { data: patient, error: patientErr } = await admin
      .from("patients").insert(patientPayload).select("*").single();
    if (patientErr) return await recordFailure("seeding", `patient clone failed: ${patientErr.message}`);

    const rateSeed = await ensureCmsChargeMasterForCompany(admin, LORENZO_TEST_COMPANY_ID);
    if (!rateSeed.ok) return await recordFailure("seeding", `charge master seed failed: ${rateSeed.error}`);

    // Build the leg
    const originType = normLoc(tplData.leg?.origin_type ?? scenario.origin_modifier);
    const destType = normLoc(tplData.leg?.destination_type ?? scenario.destination_modifier);
    const transportType = normTransport(tplData.leg?.transport_type ?? scenario.transport_type);
    const serviceLevel = (tplData.pcr?.service_level ?? tplData.leg?.service_level ?? scenario.transport_type ?? "BLS").toString().toUpperCase();
    const originFac = facilities[0];
    const destFac = facilities[Math.min(1, facilities.length - 1)];
    const pickupAddr = originFac.address ?? "100 Test St, Atlanta, GA 30301";
    const dropoffAddr = destFac.address ?? "200 Test Ave, Atlanta, GA 30302";

    const legPayload = {
      patient_id: patient.id,
      leg_type: "A",
      pickup_time: "09:00",
      pickup_location: pickupAddr,
      destination_location: dropoffAddr,
      trip_type: transportType,
      origin_type: originType,
      destination_type: destType,
      service_level: serviceLevel,
      run_date: today,
      company_id: LORENZO_TEST_COMPANY_ID,
      is_simulated: true,
      oneoff_primary_payer: desiredPayer,
    };
    const { data: leg, error: legErr } = await admin
      .from("scheduling_legs").insert(legPayload).select("*").single();
    if (legErr) return await recordFailure("seeding", `leg insert failed: ${legErr.message}`, { readiness_issues: { leg_payload: legPayload } as any });

    // Build the trip with a fully-completed PCR. The database auto-claim
    // trigger is AFTER UPDATE OF pcr_status, not AFTER INSERT, so insert as
    // not_started first, then update to submitted below to fire the same path
    // crews use in production.
    const tripPayload: any = {
      company_id: LORENZO_TEST_COMPANY_ID,
      leg_id: leg.id,
      patient_id: patient.id,
      truck_id: truck.id,
      crew_id: crew.id,
      run_date: today,
      status: "completed",
      service_level: serviceLevel,
      trip_type: transportType,
      origin_type: originType,
      destination_type: destType,
      pickup_location: pickupAddr,
      destination_location: dropoffAddr,
      bed_confined: tplData.pcr?.bed_confined ?? true,
      requires_monitoring: tplData.pcr?.requires_monitoring ?? false,
      oxygen_during_transport: false,
      cannot_transfer_safely: true,
      loaded_miles: tplData.pcr?.loaded_miles ?? 8,
      odometer_at_scene: 10000,
      odometer_at_destination: 10000 + (tplData.pcr?.loaded_miles ?? 8),
      odometer_in_service: 10000 + (tplData.pcr?.loaded_miles ?? 8) + 2,
      dispatch_time: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      at_scene_time: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
      patient_contact_time: new Date(Date.now() - 70 * 60 * 1000).toISOString(),
      left_scene_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      arrived_dropoff_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      in_service_time: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      loaded_at: new Date(Date.now() - 65 * 60 * 1000).toISOString(),
      dropped_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      vitals_json: [
        { timestamp: new Date(Date.now() - 70 * 60 * 1000).toISOString(),
          taken_at: new Date(Date.now() - 70 * 60 * 1000).toISOString(),
          saved: true,
          bp_systolic: 128, bp_diastolic: 78, pulse: 82, respiration: 16, respiratory_rate: 16, spo2: 98, temperature: 98.6, blood_glucose: 110 },
        { timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          taken_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          saved: true,
          bp_systolic: 124, bp_diastolic: 76, pulse: 80, respiration: 16, respiratory_rate: 16, spo2: 99, temperature: 98.6 },
      ],
      blood_pressure: "120/80", heart_rate: 80, oxygen_saturation: 98, respiration_rate: 16,
      vitals_taken_at: new Date(Date.now() - 70 * 60 * 1000).toISOString(),
      signatures_json: [{ kind: "patient", signed_at: new Date().toISOString(), signer: `${patient.first_name} ${patient.last_name}` }],
      narrative: "OATEST harness narrative: Patient transported via stretcher with crew assist due to documented inability to ambulate or sit safely in alternative transport. Vitals monitored continuously and remained within acceptable parameters throughout transport. Patient delivered to destination without incident; care transferred to receiving facility staff. Medical necessity supported by primary impression and PCS on file.",
      level_of_consciousness: "alert_ox4",
      skin_condition: "normal",
      stretcher_placement: "Draw Sheet",
      patient_mobility: "Bedbound",
      patient_position: "Semi-Fowlers (30°)",
      chief_complaint: tplData.pcr?.chief_complaint ?? "No Complaint — Routine Transport",
      primary_impression: tplData.pcr?.primary_impression ?? "No Acute Findings — Routine Transport",
      medical_necessity_reason: tplData.pcr?.medical_necessity_reason ?? "Bed-confined; requires stretcher",
      icd10_codes: tplData.pcr?.icd10_codes ?? ["R53.1"],
      pcs_attached: tplData.patient?.pcs_on_file ?? true,
      signature_obtained: true,
      pcr_status: "not_started",
      pcr_completed_at: null,
      pcr_submitted_by: submitterProfileId,
      pcr_type: scenario.transport_type === "emergency" ? "emergency" : "non_emergency",
      is_simulated: true,
      primary_payer: desiredPayer,
      member_id: patient.member_id ?? `OATEST${Math.floor(Math.random()*1e8)}`,
      hcpcs_codes: scenario.expected_hcpcs ? [scenario.expected_hcpcs] : [],
      hcpcs_modifiers: scenario.expected_modifiers ?? [],
    };

    const { data: trip, error: tripErr } = await admin
      .from("trip_records").insert(tripPayload).select("*").single();
    if (tripErr) return await recordFailure("seeding", `trip insert failed: ${tripErr.message}`, { readiness_issues: { trip_payload_keys: Object.keys(tripPayload) } as any });

    const { error: submitErr } = await admin
      .from("trip_records")
      .update({
        pcr_status: "submitted",
        pcr_completed_at: new Date().toISOString(),
        pcr_submitted_by: submitterProfileId,
      })
      .eq("id", trip.id);
    if (submitErr) return await recordFailure("seeding", `PCR submit update failed: ${submitErr.message}`, { trip_id: trip.id });

    // Wait briefly for the auto-claim trigger
    await new Promise(r => setTimeout(r, 400));
    const { data: claim } = await admin
      .from("claim_records").select("*").eq("trip_id", trip.id).maybeSingle();

    if (!claim) {
      // Look up failure record from claim_creation_failures if any
      const { data: ccf } = await admin
        .from("claim_creation_failures").select("error_message,sqlstate").eq("trip_id", trip.id).maybeSingle();
      return await recordFailure("readiness", `claim was not auto-created from PCR (${ccf?.error_message ?? "no failure record"})`, {
        trip_id: trip.id,
        readiness_issues: ccf ? { claim_creation_failure: ccf } as any : null,
      });
    }

    await admin.from("oatest_runs").update({
      status: body.action === "seed_and_submit" ? "ready" : "ready",
      trip_id: trip.id,
      claim_id: claim.id,
    }).eq("id", runId);

    if (body.action === "seed") {
      return ok({ ok: true, run_id: runId, trip_id: trip.id, claim_id: claim.id, scenario: scenario.slug });
    }
    // fall through to submit using newly created run
    body.run_id = runId;
  }

  // ── SUBMIT ──
  if (body.action === "submit" || body.action === "seed_and_submit") {
    const runId = body.run_id;
    if (!runId) return fail("run_id is required for submit");

    const { data: run, error: runErr } = await admin
      .from("oatest_runs").select("*, oatest_scenarios(*)").eq("id", runId).maybeSingle();
    if (runErr || !run) return fail(`run not found: ${runErr?.message ?? runId}`);
    if (!run.claim_id) return fail("run has no claim_id; seed must complete first");

    const recordSubmitFailure = async (stage: string, summary: string) => {
      await admin.from("oatest_runs").update({
        status: "failed", failure_stage: stage, failure_summary: summary,
        completed_at: new Date().toISOString(),
      }).eq("id", runId);
      return fail(summary, { stage, run_id: runId });
    };

    const [{ data: claim }, { data: company }] = await Promise.all([
      admin.from("claim_records").select("*").eq("id", run.claim_id).maybeSingle(),
      admin.from("companies").select("name, npi_number, ein_number, address_street, address_city, address_state, address_zip").eq("id", LORENZO_TEST_COMPANY_ID).maybeSingle(),
    ]);
    if (!claim) return await recordSubmitFailure("generator", "claim not found");
    const providerNpi = s(company?.npi_number).replace(/\D/g, "");
    const providerTaxId = s(company?.ein_number).replace(/\D/g, "");
    if (providerNpi.length !== 10 || providerTaxId.length < 9) return await recordSubmitFailure("generator", "Lorenzo Test Company is missing Provider NPI or EIN/Tax ID — set them on the company profile before running OATEST.");

    const { data: patient } = await admin
      .from("patients").select("*").eq("id", claim.patient_id!).maybeSingle();
    if (!patient) return await recordSubmitFailure("generator", "patient not found for claim");

    const sc = (run as any).oatest_scenarios;
    const charge = (claim.total_charge as number) ?? 250;
    const filename = `OATEST_${sc.slug.toUpperCase().replace(/-/g, "_")}_${new Date().toISOString().slice(0,10).replace(/-/g,"")}_${Math.floor(Math.random()*1e4)}.837`;
    const edi = build837P({
      filename, testMode: true,
      provider: {
        name: company?.name ?? "LORENZO TEST",
        npi: providerNpi,
        tax_id: providerTaxId,
        addr: company?.address_street ?? "100 TEST ST",
        city: company?.address_city ?? "ATLANTA",
        state: company?.address_state ?? "GA",
        zip: (company?.address_zip ?? "30301").slice(0, 5),
      },
      submitter: { name: "PODDISPATCH", id: "PODDISPATCH", contact: "LORENZO", phone: "4045551212" },
      receiver: { name: "OFFICE ALLY", id: "OFFALLY" },
      patient: {
        first: patient.first_name, last: patient.last_name,
        dob: (patient.date_of_birth as string) ?? "19500101",
        sex: (patient.sex as string)?.toUpperCase() === "F" ? "F" : "M",
        member_id: claim.member_id ?? patient.member_id ?? "TEST123",
        addr: patient.address_line ?? "100 PATIENT ST",
        city: patient.city ?? "ATLANTA",
        state: patient.state ?? "GA",
        zip: (patient.postal_code ?? "30301").slice(0, 5),
      },
      payer: {
        name: (claim.payer_name ?? sc.payer_type ?? "MEDICARE").toString(),
        id: sc.payer_type === "medicare" ? "MEDICARE" : sc.payer_type === "medicaid" ? "MEDICAID" : "OATEST",
        type: sc.payer_type === "medicare" ? "MB" : sc.payer_type === "medicaid" ? "MC" : "CI",
      },
      claim: {
        control: `OA${runId.slice(0, 8)}`.toUpperCase(),
        charge,
        hcpcs: sc.expected_hcpcs ?? (claim.hcpcs_codes?.[0]) ?? "A0428",
        modifiers: sc.expected_modifiers ?? claim.hcpcs_modifiers ?? [],
        icd10: claim.icd10_codes ?? ["R53.1"],
        service_date: claim.run_date as string,
        loaded_miles: (claim.mileage_charge ? Math.round((claim.mileage_charge as number) / 7) : 0),
        origin: { type: claim.origin_type ?? "residence", addr: claim.origin_address ?? "100 ORIGIN ST", city: "ATLANTA", state: "GA", zip: (claim.origin_zip ?? "30301").slice(0,5) },
        destination: { type: claim.destination_type ?? "dialysis", addr: claim.destination_address ?? "200 DEST AVE", city: "ATLANTA", state: "GA", zip: (claim.destination_zip ?? "30302").slice(0,5) },
        medical_necessity: "Bed-confined; requires stretcher",
      },
    });

    // Persist artifact
    const { data: art, error: artErr } = await admin
      .from("claim_submission_artifacts").insert({
        company_id: LORENZO_TEST_COMPANY_ID,
        filename, edi_content: edi, claim_ids: [claim.id],
        byte_size: new Blob([edi]).size,
        is_test_submission: true,
        oatest_run_id: runId,
        oatest_scenario_id: sc.id,
        generated_by: userId,
      }).select("id").single();
    if (artErr) return await recordSubmitFailure("generator", `artifact insert failed: ${artErr.message}`);

    // Queue for SFTP
    const { data: queued, error: qErr } = await admin
      .from("claim_submission_queue").insert({
        company_id: LORENZO_TEST_COMPANY_ID,
        claim_ids: [claim.id], filename, edi_content: edi,
        is_test: true, status: "pending",
        oatest_run_id: runId,
      }).select("id").single();
    if (qErr) return await recordSubmitFailure("submission", `queue insert failed: ${qErr.message}`);

    await admin.from("oatest_runs").update({
      status: "submitted", filename,
      artifact_id: art.id, queue_id: queued.id,
      completed_at: new Date().toISOString(),
    }).eq("id", runId);

    return ok({ ok: true, run_id: runId, queue_id: queued.id, filename, scenario: sc.slug });
  }

  return fail(`unsupported action: ${body.action}`);
});
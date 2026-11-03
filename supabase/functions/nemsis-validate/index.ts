/**
 * nemsis-validate — in-app XSD + Schematron validation at record finalization.
 * Builds XML from entered data with the shared builders, validates it with the
 * bundled engine (no CTA call, nothing leaves the backend), and gates
 * finalization: any ERROR blocks; WARNINGs are returned and allowed.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { mergeUnits, validationUnits, type UnitResult } from "../_shared/nemsis/validation/engine.ts";
import { signUnitPayload as sign } from "../_shared/nemsis/validation/unit-sig.ts";
import type { ValidationResult } from "../_shared/nemsis/validation.ts";
import { buildCertRecordXml, CertGuardError } from "../_shared/nemsis/cert-records.ts";
import { buildEmsDataSet, type ExportContext } from "../_shared/nemsis/exporter.ts";
import { EMS5_SUBMISSION_XML } from "../_shared/nemsis/fixtures/ems5-submission.ts";
import { DEM1_SUBMISSION_XML } from "../_shared/nemsis/fixtures/dem1-submission.ts";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("validate_record"), record_id: z.string().uuid() }),
  z.object({ action: z.literal("finalize_record"), record_id: z.string().uuid() }),
  z.object({ action: z.literal("validate_trip"), trip_id: z.string().uuid() }),
  z.object({ action: z.literal("self_test") }),
]);
const UNIT_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/nemsis-validate-unit`;

/** Runs every validation unit as a parallel sub-request (each has its own CPU budget). */
async function validateXml(xml: string, dataset: "DEM" | "EMS"): Promise<ValidationResult> {
  const results = await Promise.all(validationUnits(dataset).map(async (unit): Promise<UnitResult> => {
    const payload = JSON.stringify({ action: "run_unit", dataset, unit, xml });
    const sig = await sign(payload);
    let last: UnitResult = { unit, ok: false, findings: [], error: "not run" };
    // Retry: a sub-request can be cut off when it shares a busy worker.
    for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(UNIT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-unit-sig": sig },
        body: payload,
        signal: AbortSignal.timeout(60_000),
      });
      if (res.ok) {
        const r = await res.json() as UnitResult;
        if (r.ok) return r;
        last = r;
      } else {
        last = { unit, ok: false, findings: [], error: `HTTP ${res.status}` };
        await res.body?.cancel();
      }
    } catch (e) {
      last = { unit, ok: false, findings: [], error: e instanceof Error ? e.message : String(e) };
    }
    }
    return last;
  }));
  return mergeUnits(dataset, results);
}

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // TEMP_PROBE_START
  if (new URL(req.url).searchParams.get("probe") === "1") {
    const sc = new URL(req.url).searchParams.get("sc");
    const [xml, ds] = sc === "dem-error" ? [DEM1_SUBMISSION_XML, "DEM"]
      : sc === "dem-warning" ? [DEM1_SUBMISSION_XML.replace(/(<dContact\.10 PhoneNumberType=")\d+(")/g, "$19913005$2"), "DEM"]
      : sc === "ems-error" ? [EMS5_SUBMISSION_XML.replace(/(<eMedications\.03 CodeType="9924003">)[^<]*/, "$1NOTACODE"), "EMS"]
      : [EMS5_SUBMISSION_XML, "EMS"];
    const r = await validateXml(xml, ds as "DEM" | "EMS");
    return json({ sc, errors: r.error_count, warnings: r.warning_count, can_finalize: r.can_finalize, first_error: r.findings.find((f) => f.level === "ERROR")?.message ?? null });
  }
  // TEMP_PROBE_END

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: u, error: uErr } = await admin.auth.getUser(auth.replace("Bearer ", ""));
  if (uErr || !u?.user) return json({ error: "Unauthorized" }, 401);
  const userId = u.user.id;

  let raw: unknown;
  try { raw = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const body = parsed.data;

  const isCreator = async () => {
    const { data } = await admin.from("system_creators").select("user_id").eq("user_id", userId).maybeSingle();
    return !!data;
  };

  if (body.action === "self_test") {
    if (!(await isCreator())) return json({ error: "Forbidden — system creators only" }, 403);
    const t0 = performance.now();
    const ems = await validateXml(EMS5_SUBMISSION_XML, "EMS");
    const t1 = performance.now();
    const dem = await validateXml(DEM1_SUBMISSION_XML, "DEM");
    const t2 = performance.now();
    return json({ ems, dem, ms: { ems: Math.round(t1 - t0), dem: Math.round(t2 - t1) } });
  }

  if (body.action === "validate_record" || body.action === "finalize_record") {
    if (!(await isCreator())) return json({ error: "Forbidden — system creators only" }, 403);
    const { data: rec, error } = await admin.from("nemsis_cert_records")
      .select("id, company_id, kind, case_key, payload, updated_at").eq("id", body.record_id).maybeSingle();
    if (error) return json({ error: "Record lookup failed" }, 500);
    if (!rec) return json({ error: "Record not found" }, 404);
    const { data: co } = await admin.from("companies")
      .select("id, is_sandbox, creator_test_tenant, nemsis_certification, deleted_at").eq("id", rec.company_id).maybeSingle();
    let built;
    try { built = buildCertRecordXml(rec, co); } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, e instanceof CertGuardError ? 403 : 422);
    }
    const result = await validateXml(built.xml, built.dataset);
    const finalize = body.action === "finalize_record" && result.can_finalize;
    // Only finalize if the record was not edited while validating.
    const { error: upErr } = await admin.from("nemsis_cert_records")
      .update({
        last_validation: result,
        ...(finalize ? { finalized_at: new Date().toISOString(), finalized_by: userId } : {}),
      })
      .eq("id", rec.id).eq("updated_at", rec.updated_at);
    if (upErr) return json({ error: `Could not save validation: ${upErr.message}`, result }, 500);
    if (body.action === "finalize_record" && !result.can_finalize) {
      return json({ finalized: false, blocked: true, result }, 409);
    }
    return json({ finalized: finalize, blocked: false, result });
  }

  // validate_trip: ePCR finalization. Caller must belong to the trip's company.
  const { data: trip } = await admin.from("trip_records")
    .select("*, patients:patient_id(*), companies:company_id(*)").eq("id", body.trip_id).maybeSingle();
  if (!trip) return json({ error: "Trip not found" }, 404);
  const { data: membership } = await admin.from("company_memberships")
    .select("id").eq("user_id", userId).eq("company_id", trip.company_id).maybeSingle();
  if (!membership && !(await isCreator())) return json({ error: "Forbidden" }, 403);
  const company = trip.companies as Record<string, unknown> | null;
  if (!company) return json({ error: "Company not resolvable" }, 400);

  const { data: vehicle } = trip.truck_id
    ? await admin.from("trucks").select("id, unit_number, vin, license_plate").eq("id", trip.truck_id).maybeSingle()
    : { data: null };
  const { data: crewRows } = await admin.from("trip_crew_assignments")
    .select("crew_member_id, employees:crew_member_id(full_name, medic_number, certification_level)").eq("trip_id", trip.id);
  const ctx: ExportContext = {
    agency: {
      npi: (company.npi as string) ?? null,
      name: String(company.name ?? ""),
      state_ems_agency_number: (company.state_ems_agency_number as string) ?? null,
      state_ems_license_state: (company.state_ems_license_state as string) ?? null,
    },
    vehicle: vehicle ? { vehicle_id: vehicle.id, unit_number: vehicle.unit_number, vin: vehicle.vin, license_plate: vehicle.license_plate } : null,
    personnel: (crewRows ?? []).map((r: { crew_member_id: string; employees: { full_name: string | null; medic_number: string | null; certification_level: string | null } | null }) => ({
      crew_member_id: r.crew_member_id,
      full_name: r.employees?.full_name ?? "Unknown",
      state_license_number: r.employees?.medic_number ?? null,
      certification_level: r.employees?.certification_level ?? null,
    })),
    state: (company.state_ems_license_state as string) ?? "GA",
    test_mode: true,
    software: { name: "PodDispatch", version: "1.0" },
  };
  let xml: string;
  try {
    xml = buildEmsDataSet({ trip: { ...trip, company_name: company.name }, patient: trip.patients as Record<string, unknown> | null }, ctx);
  } catch (e) {
    return json({ error: `Could not build NEMSIS XML: ${e instanceof Error ? e.message : String(e)}` }, 422);
  }
  return json({ result: await validateXml(xml, "EMS") });
});

/**
 * submit-gemsis-pcr — Phase 7
 *
 * Queues or immediately POSTs a NEMSIS eRecord for a single trip to the
 * destination state's Web Service. Called on PCR finalize (real path) and
 * from the nightly retry cron for previously failed submissions.
 *
 * Request:
 *   { trip_id: string, test_mode?: boolean }
 *
 * The XML exporter lives in the app bundle, so this function only handles:
 *   1. Load context (agency, personnel, vehicle, trip, patient)
 *   2. Build the XML (via a copy of the exporter shipped alongside)
 *   3. POST to the state endpoint (or record a queued row if no endpoint yet)
 *   4. Persist status + ack XML to nemsis_submissions
 *
 * The GEMSIS production endpoint is not public — GA DPH issues it with
 * vendor credentials. Until credentials arrive, requests are queued only
 * (status='queued') so nothing hits any external system by accident.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  buildEmsDataSet,
  type ExportContext,
  type PcrExportInput,
} from "../_shared/nemsis/exporter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Set per-state when the user obtains real vendor credentials.
// Until then the function only queues rows — no external POST is issued.
const STATE_ENDPOINTS: Record<string, { prod: string | null; test: string | null }> = {
  GA: { prod: null, test: null }, // populated after GA DPH vendor onboarding
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let body: { trip_id?: string; test_mode?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const trip_id = body.trip_id;
  if (!trip_id || typeof trip_id !== "string") {
    return json({ error: "trip_id is required" }, 400);
  }
  const test_mode = body.test_mode !== false; // default true until vendor cert lands

  // JWT check — caller must be authenticated.
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Load trip + patient + company context
  const { data: trip, error: tripErr } = await supabase
    .from("trip_records")
    .select("*, patients:patient_id(*), companies:company_id(*)")
    .eq("id", trip_id)
    .maybeSingle();
  if (tripErr || !trip) return json({ error: "Trip not found" }, 404);

  const company = trip.companies as { id: string; name: string; npi: string | null; state_ems_agency_number: string | null; state_ems_license_state: string | null } | null;
  if (!company) return json({ error: "Company not resolvable" }, 400);
  const state = company.state_ems_license_state ?? "GA";

  // Insert queued submission row up-front so we always have an audit trail,
  // even if XML build or POST fails.
  const { data: submission, error: insErr } = await supabase
    .from("nemsis_submissions")
    .insert({
      company_id: company.id,
      trip_id: trip.id,
      destination_state: state,
      test_mode,
      status: "queued",
    })
    .select("id")
    .single();
  if (insErr || !submission) {
    return json({ error: "Failed to queue submission", detail: insErr?.message }, 500);
  }

  // Assemble the ExportContext (personnel + assigned vehicle) so the exporter
  // can render a full NEMSIS 3.5.1 payload. Missing pieces gracefully degrade
  // to xsi:nil inside the exporter — they never abort submission.
  const { data: vehicle } = trip.truck_id
    ? await supabase.from("trucks")
        .select("id, unit_number, vin, license_plate")
        .eq("id", trip.truck_id)
        .maybeSingle()
    : { data: null } as { data: null };

  const { data: crewRows } = await supabase
    .from("trip_crew_assignments")
    .select("crew_member_id, employees:crew_member_id(full_name, medic_number, certification_level)")
    .eq("trip_id", trip.id);

  const personnel = (crewRows ?? []).map((r: {
    crew_member_id: string;
    employees: { full_name: string | null; medic_number: string | null; certification_level: string | null } | null;
  }) => ({
    crew_member_id: r.crew_member_id,
    full_name: r.employees?.full_name ?? "Unknown",
    state_license_number: r.employees?.medic_number ?? null,
    certification_level: r.employees?.certification_level ?? null,
  }));

  const patient = trip.patients as Record<string, unknown> | null;

  const ctx: ExportContext = {
    agency: {
      npi: company.npi,
      name: company.name,
      state_ems_agency_number: company.state_ems_agency_number,
      state_ems_license_state: company.state_ems_license_state,
    },
    vehicle: vehicle
      ? {
          vehicle_id: (vehicle as { id: string }).id,
          unit_number: (vehicle as { unit_number: string | null }).unit_number,
          vin: (vehicle as { vin: string | null }).vin,
          license_plate: (vehicle as { license_plate: string | null }).license_plate,
        }
      : null,
    personnel,
    state,
    test_mode,
    software: {
      name: "Pod Dispatch",
      version: Deno.env.get("APP_VERSION") ?? "3.5.1",
    },
  };

  const exportInput: PcrExportInput = {
    trip: { ...trip, company_name: company.name },
    patient,
  };

  let payloadXml: string;
  try {
    payloadXml = buildEmsDataSet(exportInput, ctx);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from("nemsis_submissions")
      .update({ status: "error", error_message: `Exporter failed: ${msg}` })
      .eq("id", submission.id);
    return json({ submission_id: submission.id, status: "error", error: msg }, 500);
  }

  // Determine endpoint. If none is configured yet, leave as 'queued' and exit
  // — the nightly retry job will pick this up once creds are configured.
  // We STILL persist the built XML so it's available for audit/download.
  const endpoints = STATE_ENDPOINTS[state];
  const endpoint = test_mode ? endpoints?.test : endpoints?.prod;
  if (!endpoint) {
    await supabase.from("nemsis_submissions")
      .update({ payload_xml: payloadXml })
      .eq("id", submission.id);
    return json({
      submission_id: submission.id,
      status: "queued",
      payload_bytes: payloadXml.length,
      note: `No ${state} ${test_mode ? "test" : "production"} endpoint configured yet — queued for later retry.`,
    }, 202);
  }

  await supabase.from("nemsis_submissions")
    .update({ status: "submitting", payload_xml: payloadXml, endpoint_url: endpoint, submitted_at: new Date().toISOString() })
    .eq("id", submission.id);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: payloadXml,
    });
    const ackXml = await res.text();
    const status = res.ok && !/<Nack|<Error/i.test(ackXml) ? "accepted" : "rejected";
    await supabase.from("nemsis_submissions")
      .update({ status, ack_xml: ackXml, acknowledged_at: new Date().toISOString() })
      .eq("id", submission.id);
    return json({ submission_id: submission.id, status }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from("nemsis_submissions")
      .update({ status: "error", error_message: msg, retry_count: 1 })
      .eq("id", submission.id);
    return json({ submission_id: submission.id, status: "error", error: msg }, 502);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
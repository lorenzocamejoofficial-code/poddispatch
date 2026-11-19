import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  ProviderNotConfiguredError,
  selectCoverageProvider,
  toCoverageCheckRow,
} from "../_shared/coverage/providers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Runs one coverage check for one patient and stores the result in
 * coverage_checks. Never edits the patient or any claim. Runs as the caller
 * (RLS enforces company scope + owner/biller role). No PHI is logged.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ success: false, error: "Unauthorized" }, 401);
    let body: any;
    try { body = await req.json(); } catch { return json({ success: false, error: "Invalid JSON body" }, 400); }
    const patientId = body?.patient_id;
    const checkType = body?.check_type;
    if (typeof patientId !== "string" || !UUID.test(patientId)) return json({ success: false, error: "patient_id must be a UUID" }, 400);
    if (checkType !== "eligibility" && checkType !== "discovery") return json({ success: false, error: "check_type must be 'eligibility' or 'discovery'" }, 400);

    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await client.auth.getUser();
    if (!u?.user) return json({ success: false, error: "Unauthorized" }, 401);
    const { data: companyId } = await client.rpc("get_my_company_id");
    if (!companyId) return json({ success: false, error: "No company found" }, 403);

    const { data: patient, error: pErr } = await client
      .from("patients")
      .select("id, company_id, first_name, last_name, dob, primary_payer, member_id")
      .eq("id", patientId).eq("company_id", companyId).maybeSingle();
    if (pErr) return json({ success: false, error: "Could not load patient" }, 500);
    if (!patient) return json({ success: false, error: "Patient not found" }, 404);

    const { data: settings } = await client
      .from("company_settings").select("coverage_provider").eq("company_id", companyId).maybeSingle();
    const provider = selectCoverageProvider((settings as any)?.coverage_provider);

    const input = {
      patient_id: patient.id, first_name: patient.first_name, last_name: patient.last_name,
      dob: patient.dob, primary_payer: patient.primary_payer, member_id: patient.member_id,
    };
    let result;
    try {
      result = checkType === "eligibility" ? await provider.checkEligibility(input) : await provider.discoverCoverage(input);
    } catch (e) {
      if (e instanceof ProviderNotConfiguredError) return json({ success: false, error: e.message }, 409);
      return json({ success: false, error: "Coverage provider failed" }, 502);
    }

    const row = toCoverageCheckRow(companyId as string, patient.id, result, new Date().toISOString());
    const { data: inserted, error: iErr } = await client.from("coverage_checks").insert(row).select("id").single();
    if (iErr) return json({ success: false, error: "Could not save coverage result (check your role)" }, 403);
    return json({ success: true, id: inserted.id, source: result.source });
  } catch (_e) {
    return json({ success: false, error: "Unexpected error running coverage check" }, 500);
  }
});

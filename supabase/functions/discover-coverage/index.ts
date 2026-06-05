import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Insurance Discovery (Office Ally REST JSON 270/271, multi-coverage mode).
 *
 * Sibling of `check-eligibility`. Verify takes a known payer + member ID and
 * confirms it is active; Discover takes just name + DOB (+ optional SSN) and
 * asks OA to find any/all coverage. Results are written to
 * `coverage_discoveries` (one row per discovered policy) which the patient
 * form reads and lets the user promote into primary/secondary/tertiary.
 *
 * Until OA activates the paid Discovery product, this function fails fast
 * with "endpoint not configured" — same pattern as check-eligibility — so
 * the UI button stays disabled and no placeholder URL is hit.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { patient_id, first_name, last_name, dob } = body || {};
    if (!patient_id && !(first_name && last_name && dob)) {
      return json({ success: false, error: "Provide patient_id OR first_name+last_name+dob" }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: companyId } = await userClient.rpc("get_my_company_id");
    if (!companyId) return json({ success: false, error: "No company found" }, 403);

    // Pull OA vendor endpoint config (same source as check-eligibility)
    const { data: vendor } = await userClient
      .from("vendor_clearinghouse_settings")
      .select("eligibility_rest_url_test, eligibility_rest_url_prod, test_mode")
      .maybeSingle();

    const url = (vendor as any)?.test_mode
      ? (vendor as any)?.eligibility_rest_url_test
      : (vendor as any)?.eligibility_rest_url_prod;

    if (!url) {
      return json(
        {
          success: false,
          error:
            "Insurance Discovery endpoint is not configured. The system creator must add the Office Ally REST URL in vendor settings once the Discovery product is activated.",
        },
        400,
      );
    }

    // Placeholder for the actual OA Discovery call. When the product is live,
    // POST a JSON 270 (no subscriber.memberId, with searchInquiry block) and
    // parse the 271 multi-coverage response into rows.
    return json(
      { success: false, error: "Discovery transport stub — wire OA REST call when product activates." },
      501,
    );
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
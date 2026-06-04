import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Office Ally REST API (JSON 270/271).
// The actual endpoint URLs are provided by Office Ally after the eligibility
// product is purchased. They are stored on vendor_clearinghouse_settings so
// the system creator can paste them in once available, without a code change.
// Until then this function fails fast with a clear "endpoint not configured"
// message instead of hitting a placeholder URL.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { patient_id, run_date } = await req.json();

    if (!patient_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required field: patient_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get user's company and verify permissions
    const { data: companyId } = await userClient.rpc("get_my_company_id");
    if (!companyId) {
      return new Response(
        JSON.stringify({ success: false, error: "No company found" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: membership } = await userClient
      .from("company_memberships")
      .select("role")
      .eq("company_id", companyId)
      .single();

    if (!membership || !["owner", "creator", "manager", "biller"].includes(membership.role)) {
      return new Response(
        JSON.stringify({ success: false, error: "Insufficient permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for data queries
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch patient data
    const { data: patient } = await supabase
      .from("patients")
      .select("id, first_name, last_name, dob, member_id, primary_payer")
      .eq("id", patient_id)
      .eq("company_id", companyId)
      .single();

    if (!patient) {
      return new Response(
        JSON.stringify({ success: false, error: "Patient not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch clearinghouse settings for this company
    const { data: settings } = await supabase
      .from("clearinghouse_settings")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_configured", true)
      .maybeSingle();

    if (!settings) {
      return new Response(
        JSON.stringify({ success: false, error: "Office Ally is not configured. Set up your connection in Settings first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const oaUsername = (settings.sftp_username ?? "").trim();

    // Password lives in the server-only clearinghouse_credentials table, NOT
    // on settings. Reading settings.sftp_password_encrypted (legacy) returns
    // null, which is why this endpoint used to always fail.
    const { data: credRow } = await supabase
      .from("clearinghouse_credentials")
      .select("sftp_password")
      .eq("company_id", companyId)
      .maybeSingle();
    const oaPassword = (credRow?.sftp_password ?? "").trim();

    // Fail-fast: clear, actionable messages instead of "non-2xx".
    if (!oaUsername) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Office Ally username is missing. Re-enter it in Settings → Clearinghouse → Step 2.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!oaPassword) {
      // Auto-flip is_configured so the eligibility button stops teasing the user.
      await supabase
        .from("clearinghouse_settings")
        .update({ is_configured: false, last_error: "Office Ally password not stored — re-enter in Settings." })
        .eq("id", settings.id);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Office Ally password not set — re-enter it in Settings → Clearinghouse → Step 2 and click Test Connection.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // test_mode + submitter_id now live on the global vendor_clearinghouse_settings
    // singleton (PodDispatch is the registered Office Ally vendor for all tenants).
    const { data: vendor } = await supabase
      .from("vendor_clearinghouse_settings")
      .select("submitter_id, test_mode, eligibility_rest_url_test, eligibility_rest_url_prod")
      .limit(1)
      .maybeSingle();
    const isTestMode = (vendor as any)?.test_mode === true;
    const eligibilityUrl = (
      isTestMode
        ? (vendor as any)?.eligibility_rest_url_test
        : (vendor as any)?.eligibility_rest_url_prod
    ) as string | null;
    const submitterId = (((vendor as any)?.submitter_id) ?? oaUsername).toString();

    if (!eligibilityUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Office Ally REST eligibility endpoint is not set${isTestMode ? " (test mode)" : ""}. The system creator must paste the OA REST URL into Vendor Clearinghouse Settings once your Office Ally eligibility product is active.`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceDate = run_date ?? new Date().toISOString().split("T")[0];

    // Build the REST JSON 270 inquiry. This shape follows the standard 270
    // payload Office Ally documents for its real-time JSON eligibility API
    // (information source / receiver / subscriber / service-type code 30 =
    // health benefit plan coverage). If OA's published schema differs in
    // field names, this is the single place to adjust.
    const inquiryPayload = {
      submitter: {
        id: submitterId,
        name: "PODDISPATCH",
      },
      receiver: {
        id: "OFFICEALLY",
        name: "OFFICE ALLY",
      },
      payer: {
        id: patient.primary_payer ?? "MEDICARE",
        name: patient.primary_payer ?? "MEDICARE",
      },
      provider: {
        npi: "0000000000",
        name: "PROVIDER",
      },
      subscriber: {
        firstName: patient.first_name ?? "",
        lastName: patient.last_name ?? "",
        memberId: patient.member_id ?? "",
        dob: patient.dob ?? null,
      },
      serviceDate,
      serviceTypeCodes: ["30"],
      testMode: isTestMode,
    };

    // Submit to the Office Ally REST eligibility endpoint
    try {
      const response = await fetch(eligibilityUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": "Basic " + btoa(`${oaUsername}:${oaPassword}`),
        },
        body: JSON.stringify(inquiryPayload),
      });

      const responseText = await response.text();

      let isEligible: boolean | null = null;
      let coverageStart: string | null = null;
      let coverageEnd: string | null = null;
      let responseSummary = "";

      if (response.ok) {
        // Parse the JSON 271 response. We accept several common field
        // shapes so minor differences in OA's payload don't break us.
        let responseData: any = {};
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseSummary = "Office Ally returned a non-JSON response.";
        }

        // Accept several common shapes:
        //   { eligible, coverage_start, coverage_end, message }
        //   { isEligible, coverageStartDate, coverageEndDate, summary }
        //   { status: "active"|"inactive", planBegin, planEnd }
        const eligibleRaw =
          responseData.eligible ??
          responseData.isEligible ??
          (typeof responseData.status === "string"
            ? responseData.status.toLowerCase() === "active"
            : undefined);
        if (typeof eligibleRaw === "boolean") {
          isEligible = eligibleRaw;
        }
        coverageStart =
          responseData.coverage_start ??
          responseData.coverageStartDate ??
          responseData.planBegin ??
          null;
        coverageEnd =
          responseData.coverage_end ??
          responseData.coverageEndDate ??
          responseData.planEnd ??
          null;
        responseSummary =
          responseData.message ??
          responseData.summary ??
          (isEligible === true
            ? "Active coverage confirmed"
            : isEligible === false
              ? "Coverage is inactive"
              : responseSummary || "Eligibility response received but status was unclear.");
      } else {
        isEligible = null;
        responseSummary = `Office Ally returned HTTP ${response.status}: ${responseText.slice(0, 200)}`;
      }

      // Get the user's actual ID for the record
      const { data: { user } } = await createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      }).auth.getUser();

      // Store eligibility check result
      await supabase.from("eligibility_checks").insert({
        patient_id,
        company_id: companyId,
        is_eligible: isEligible,
        coverage_start: coverageStart,
        coverage_end: coverageEnd,
        payer_type: patient.primary_payer,
        response_summary: isTestMode ? `[SANDBOX] ${responseSummary}` : responseSummary,
        checked_by: user?.id ?? null,
        raw_response: { status: response.status, body: responseText.slice(0, 5000), test_mode: isTestMode },
      });

      return new Response(
        JSON.stringify({
          success: true,
          is_eligible: isEligible,
          coverage_start: coverageStart,
          coverage_end: coverageEnd,
          summary: responseSummary,
          test_mode: isTestMode,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (fetchErr: any) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Could not reach Office Ally eligibility service: ${fetchErr.message}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

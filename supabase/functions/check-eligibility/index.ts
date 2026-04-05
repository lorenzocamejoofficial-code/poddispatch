import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OA_ELIGIBILITY_URL = "https://www.officeally.com/OA_API/Eligibility/SubmitInquiry";

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

    if (!membership || !["owner", "creator", "biller"].includes(membership.role)) {
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

    const oaUsername = settings.sftp_username ?? "";
    const oaPassword = settings.sftp_password_encrypted ?? "";
    const serviceDate = run_date ?? new Date().toISOString().split("T")[0];

    // Build 270 eligibility inquiry
    const controlNum = String(Math.floor(Math.random() * 999999999)).padStart(9, "0");
    const dateStr = serviceDate.replace(/-/g, "");
    const ES = "*";
    const ST = "~";

    const segments = [
      `ISA${ES}00${ES}          ${ES}00${ES}          ${ES}ZZ${ES}${oaUsername.padEnd(15)}${ES}ZZ${ES}${"OFFICEALLY".padEnd(15)}${ES}${dateStr.slice(2, 6)}${dateStr.slice(6, 8)}${ES}${new Date().getHours().toString().padStart(2, "0")}${new Date().getMinutes().toString().padStart(2, "0")}${ES}^${ES}00501${ES}${controlNum}${ES}0${ES}P${ES}:${ST}`,
      `GS${ES}HS${ES}${oaUsername}${ES}OFFICEALLY${ES}${dateStr}${ES}${new Date().getHours().toString().padStart(2, "0")}${new Date().getMinutes().toString().padStart(2, "0")}${ES}${controlNum}${ES}X${ES}005010X279A1${ST}`,
      `ST${ES}270${ES}0001${ES}005010X279A1${ST}`,
      `BHT${ES}0022${ES}13${ES}${controlNum}${ES}${dateStr}${ST}`,
      `HL${ES}1${ES}${ES}20${ES}1${ST}`,
      `NM1${ES}PR${ES}2${ES}${patient.primary_payer ?? "MEDICARE"}${ES}${ES}${ES}${ES}${ES}PI${ES}${patient.primary_payer ?? "MEDICARE"}${ST}`,
      `HL${ES}2${ES}1${ES}21${ES}1${ST}`,
      `NM1${ES}1P${ES}2${ES}PROVIDER${ES}${ES}${ES}${ES}${ES}XX${ES}0000000000${ST}`,
      `HL${ES}3${ES}2${ES}22${ES}0${ST}`,
      `NM1${ES}IL${ES}1${ES}${patient.last_name ?? ""}${ES}${patient.first_name ?? ""}${ES}${ES}${ES}${ES}MI${ES}${patient.member_id ?? ""}${ST}`,
      `DMG${ES}D8${ES}${(patient.dob ?? "19000101").replace(/-/g, "")}${ST}`,
      `DTP${ES}291${ES}D8${ES}${dateStr}${ST}`,
      `EQ${ES}30${ST}`,
      `SE${ES}13${ES}0001${ST}`,
      `GE${ES}1${ES}${controlNum}${ST}`,
      `IEA${ES}1${ES}${controlNum}${ST}`,
    ];

    const edi270 = segments.join("\n");

    // Submit to Office Ally eligibility endpoint
    try {
      const response = await fetch(OA_ELIGIBILITY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/EDI-X12",
          "Authorization": "Basic " + btoa(`${oaUsername}:${oaPassword}`),
        },
        body: edi270,
      });

      const responseText = await response.text();

      let isEligible: boolean | null = null;
      let coverageStart: string | null = null;
      let coverageEnd: string | null = null;
      let responseSummary = "";

      if (response.ok) {
        // Try to parse the 271 response
        let responseData: any = {};
        try {
          responseData = JSON.parse(responseText);
        } catch {
          // Try parsing as EDI 271
          if (responseText.includes("271")) {
            // Look for EB segments (eligibility/benefit information)
            const ebMatches = responseText.match(/EB\*[^~]+/g) ?? [];
            for (const eb of ebMatches) {
              const parts = eb.split("*");
              const infoCode = parts[1] ?? "";
              // EB*1 = Active Coverage, EB*6 = Inactive
              if (infoCode === "1") {
                isEligible = true;
                responseSummary = "Active coverage confirmed";
              } else if (infoCode === "6") {
                isEligible = false;
                responseSummary = "Coverage is inactive";
              }
            }

            // Look for DTP segments with coverage dates
            const dtpMatches = responseText.match(/DTP\*[^~]+/g) ?? [];
            for (const dtp of dtpMatches) {
              const parts = dtp.split("*");
              const qualifier = parts[1] ?? "";
              const dateValue = parts[3] ?? "";
              if (qualifier === "346" && dateValue.length >= 8) {
                // Plan begin date
                coverageStart = `${dateValue.slice(0, 4)}-${dateValue.slice(4, 6)}-${dateValue.slice(6, 8)}`;
              } else if (qualifier === "347" && dateValue.length >= 8) {
                // Plan end date
                coverageEnd = `${dateValue.slice(0, 4)}-${dateValue.slice(4, 6)}-${dateValue.slice(6, 8)}`;
              } else if (qualifier === "291" && dateValue.includes("-")) {
                // Date range format
                const [start, end] = dateValue.split("-");
                if (start?.length >= 8) coverageStart = `${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6, 8)}`;
                if (end?.length >= 8) coverageEnd = `${end.slice(0, 4)}-${end.slice(4, 6)}-${end.slice(6, 8)}`;
              }
            }

            if (isEligible === null) {
              isEligible = responseText.includes("EB*1");
              responseSummary = isEligible ? "Active coverage" : "Unable to determine eligibility from response";
            }
          } else {
            responseSummary = "Received non-standard response from payer";
          }
        }

        // Handle JSON response
        if (responseData.eligible !== undefined) {
          isEligible = responseData.eligible;
          coverageStart = responseData.coverage_start ?? null;
          coverageEnd = responseData.coverage_end ?? null;
          responseSummary = responseData.message ?? (isEligible ? "Active coverage" : "Inactive coverage");
        }
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
        response_summary: responseSummary,
        checked_by: user?.id ?? null,
        raw_response: { status: response.status, body: responseText.slice(0, 5000) },
      });

      return new Response(
        JSON.stringify({
          success: true,
          is_eligible: isEligible,
          coverage_start: coverageStart,
          coverage_end: coverageEnd,
          summary: responseSummary,
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

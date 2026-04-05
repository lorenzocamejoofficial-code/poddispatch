import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OA_SUBMIT_URL = "https://www.officeally.com/OA_API/ClaimSubmission/SubmitClaim";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let targetCompanyId: string | null = null;
    try {
      const body = await req.json();
      targetCompanyId = body?.company_id ?? null;
    } catch {
      // No body — process all active companies
    }

    // If called with a specific company, verify auth
    if (targetCompanyId) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: membership } = await userClient
          .from("company_memberships")
          .select("role")
          .eq("company_id", targetCompanyId)
          .single();

        if (!membership || !["owner", "creator", "biller"].includes(membership.role)) {
          return new Response(
            JSON.stringify({ success: false, error: "Insufficient permissions" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Fetch active clearinghouse settings
    let settingsQuery = supabase
      .from("clearinghouse_settings")
      .select("*")
      .eq("is_configured", true);

    if (targetCompanyId) {
      settingsQuery = settingsQuery.eq("company_id", targetCompanyId);
    } else {
      settingsQuery = settingsQuery.eq("is_active", true).eq("auto_send_enabled", true);
    }

    const { data: settingsRows } = await settingsQuery;

    if (!settingsRows?.length) {
      return new Response(
        JSON.stringify({ success: true, message: "No configured clearinghouses to process", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalSent = 0;
    const errors: string[] = [];

    for (const settings of settingsRows) {
      try {
        // Fetch claims ready to send: submitted, exported, but not yet sent
        const { data: claims } = await supabase
          .from("claim_records")
          .select("*, patient:patients!claim_records_patient_id_fkey(first_name, last_name, dob, pickup_address, member_id, primary_payer)")
          .eq("company_id", settings.company_id)
          .eq("status", "submitted")
          .not("exported_at", "is", null)
          .is("sftp_sent_at", null)
          .limit(500);

        if (!claims?.length) continue;

        // Get company/provider info for EDI generation
        const { data: company } = await supabase
          .from("companies")
          .select("name, npi_number")
          .eq("id", settings.company_id)
          .single();

        // Build 837P EDI content
        const now = new Date();
        const dateStr = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
        const controlNum = String(Math.floor(Math.random() * 999999999)).padStart(9, "0");

        // Build simple 837P segments from claim data
        const segments: string[] = [];
        const ES = "*";
        const ST = "~";

        // ISA header
        segments.push(
          `ISA${ES}00${ES}          ${ES}00${ES}          ${ES}ZZ${ES}${(settings.sftp_username ?? "PODDISPATCH").padEnd(15)}${ES}ZZ${ES}${"OFFICEALLY".padEnd(15)}${ES}${dateStr.slice(2, 8)}${ES}${dateStr.slice(8, 12)}${ES}^${ES}00501${ES}${controlNum}${ES}0${ES}P${ES}:${ST}`
        );
        segments.push(`GS${ES}HC${ES}${settings.sftp_username ?? "PODDISPATCH"}${ES}OFFICEALLY${ES}${dateStr.slice(0, 8)}${ES}${dateStr.slice(8, 12)}${ES}${controlNum}${ES}X${ES}005010X222A1${ST}`);

        let claimCount = 0;
        for (const claim of claims as any[]) {
          const stNum = String(claimCount + 1).padStart(4, "0");
          let segCount = 0;
          const addSeg = (s: string) => { segments.push(s + ST); segCount++; };

          const patientName = claim.patient
            ? `${claim.patient.last_name ?? "UNKNOWN"}, ${claim.patient.first_name ?? "UNKNOWN"}`
            : "UNKNOWN, UNKNOWN";

          addSeg(`ST${ES}837${ES}${stNum}${ES}005010X222A1`);
          addSeg(`BHT${ES}0019${ES}00${ES}${controlNum}${ES}${dateStr.slice(0, 8)}${ES}${dateStr.slice(8, 12)}${ES}CH`);
          addSeg(`NM1${ES}41${ES}2${ES}${company?.name ?? "PROVIDER"}${ES}${ES}${ES}${ES}${ES}46${ES}${settings.sftp_username ?? "PODDISPATCH"}`);
          addSeg(`NM1${ES}40${ES}2${ES}OFFICEALLY${ES}${ES}${ES}${ES}${ES}46${ES}OFFICEALLY`);
          addSeg(`HL${ES}1${ES}${ES}20${ES}1`);
          addSeg(`NM1${ES}85${ES}2${ES}${company?.name ?? "PROVIDER"}${ES}${ES}${ES}${ES}${ES}XX${ES}${company?.npi_number ?? "0000000000"}`);
          addSeg(`HL${ES}2${ES}1${ES}22${ES}0`);
          addSeg(`SBR${ES}P${ES}18${ES}${ES}${ES}${ES}${ES}${ES}${ES}MC`);
          addSeg(`NM1${ES}IL${ES}1${ES}${(claim.patient?.last_name ?? "UNKNOWN")}${ES}${(claim.patient?.first_name ?? "UNKNOWN")}${ES}${ES}${ES}${ES}MI${ES}${claim.member_id ?? ""}`);
          addSeg(`NM1${ES}PR${ES}2${ES}${claim.payer_name ?? "MEDICARE"}${ES}${ES}${ES}${ES}${ES}PI${ES}${claim.payer_name ?? "MEDICARE"}`);
          addSeg(`CLM${ES}${claim.id}${ES}${(claim.total_charge ?? 0).toFixed(2)}${ES}${ES}${ES}41:B:1${ES}Y${ES}A${ES}Y${ES}Y`);
          addSeg(`DTP${ES}472${ES}D8${ES}${(claim.run_date ?? "").replace(/-/g, "")}`);

          if (claim.icd10_codes?.length) {
            const hiParts = claim.icd10_codes.slice(0, 12).map((c: string, i: number) => `${i === 0 ? "ABK" : "ABF"}:${c.replace(/\./g, "")}`);
            addSeg(`HI${ES}${hiParts.join(ES)}`);
          } else {
            addSeg(`HI${ES}ABK:N186`);
          }

          if (claim.base_charge > 0) {
            addSeg(`LX${ES}1`);
            const hcpcs = claim.hcpcs_codes?.[0] ?? "A0428";
            const mods = claim.hcpcs_modifiers?.length ? `:${claim.hcpcs_modifiers.join(":")}` : "";
            addSeg(`SV1${ES}HC:${hcpcs}${mods}${ES}${(claim.base_charge ?? 0).toFixed(2)}${ES}UN${ES}1${ES}41`);
            addSeg(`DTP${ES}472${ES}D8${ES}${(claim.run_date ?? "").replace(/-/g, "")}`);
          }

          if (claim.mileage_charge > 0) {
            addSeg(`LX${ES}2`);
            addSeg(`SV1${ES}HC:A0425${ES}${(claim.mileage_charge ?? 0).toFixed(2)}${ES}UN${ES}1${ES}41`);
            addSeg(`DTP${ES}472${ES}D8${ES}${(claim.run_date ?? "").replace(/-/g, "")}`);
          }

          addSeg(`SE${ES}${segCount + 1}${ES}${stNum}`);
          claimCount++;
        }

        segments.push(`GE${ES}${claimCount}${ES}${controlNum}${ST}`);
        segments.push(`IEA${ES}1${ES}${controlNum}${ST}`);

        const ediContent = segments.join("\n");

        // Submit via Office Ally HTTP API
        const oaUsername = settings.sftp_username ?? "";
        const oaPassword = settings.sftp_password_encrypted ?? "";

        try {
          const response = await fetch(OA_SUBMIT_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/EDI-X12",
              "Authorization": "Basic " + btoa(`${oaUsername}:${oaPassword}`),
            },
            body: ediContent,
          });

          const responseText = await response.text();

          if (response.ok) {
            // Parse response — Office Ally returns JSON with acceptance status
            let responseData: any = {};
            try {
              responseData = JSON.parse(responseText);
            } catch {
              // If not JSON, treat successful HTTP status as acceptance
              responseData = { accepted: true };
            }

            if (responseData.accepted !== false && responseData.error === undefined) {
              // Mark claims as sent
              const claimIds = (claims as any[]).map((c: any) => c.id);
              await supabase
                .from("claim_records")
                .update({ sftp_sent_at: now.toISOString() })
                .in("id", claimIds);

              totalSent += claims.length;

              await supabase
                .from("clearinghouse_settings")
                .update({ last_send_at: now.toISOString(), last_error: null })
                .eq("id", settings.id);
            } else {
              const errorMsg = responseData.error ?? responseData.message ?? "Claims rejected by Office Ally";
              errors.push(`Company ${settings.company_id}: ${errorMsg}`);
              await supabase
                .from("clearinghouse_settings")
                .update({ last_error: errorMsg })
                .eq("id", settings.id);
            }
          } else {
            const errorMsg = `Office Ally returned HTTP ${response.status}: ${responseText.slice(0, 200)}`;
            errors.push(`Company ${settings.company_id}: ${errorMsg}`);
            await supabase
              .from("clearinghouse_settings")
              .update({ last_error: errorMsg })
              .eq("id", settings.id);

            // Notify owner
            const { data: ownerMembership } = await supabase
              .from("company_memberships")
              .select("user_id")
              .eq("company_id", settings.company_id)
              .eq("role", "owner")
              .limit(1)
              .single();

            if (ownerMembership) {
              await supabase.from("notifications").insert({
                user_id: ownerMembership.user_id,
                message: `Office Ally claim submission failed: ${errorMsg}. Check your clearinghouse settings.`,
                notification_type: "clearinghouse_error",
              });
            }
          }
        } catch (fetchErr: any) {
          const errorMsg = `Office Ally API request failed: ${fetchErr.message}`;
          errors.push(`Company ${settings.company_id}: ${errorMsg}`);
          await supabase
            .from("clearinghouse_settings")
            .update({ last_error: errorMsg })
            .eq("id", settings.id);

          const { data: ownerMembership } = await supabase
            .from("company_memberships")
            .select("user_id")
            .eq("company_id", settings.company_id)
            .eq("role", "owner")
            .limit(1)
            .single();

          if (ownerMembership) {
            await supabase.from("notifications").insert({
              user_id: ownerMembership.user_id,
              message: `Office Ally claim submission failed: ${fetchErr.message}. Check your clearinghouse settings.`,
              notification_type: "clearinghouse_error",
            });
          }
        }
      } catch (companyErr: any) {
        errors.push(`Company ${settings.company_id}: ${companyErr.message}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: totalSent, errors: errors.length > 0 ? errors : undefined }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

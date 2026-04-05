import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OA_REMITTANCE_URL = "https://www.officeally.com/OA_API/Remittance/GetRemittanceFiles";

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
      settingsQuery = settingsQuery.eq("is_active", true).eq("auto_receive_enabled", true);
    }

    const { data: settingsRows } = await settingsQuery;

    if (!settingsRows?.length) {
      return new Response(
        JSON.stringify({ success: true, message: "No configured clearinghouses to check", received: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalReceived = 0;
    const errors: string[] = [];

    for (const settings of settingsRows) {
      try {
        const oaUsername = settings.sftp_username ?? "";
        const oaPassword = settings.sftp_password_encrypted ?? "";

        try {
          // Fetch available remittance files from Office Ally
          const response = await fetch(OA_REMITTANCE_URL, {
            method: "GET",
            headers: {
              "Authorization": "Basic " + btoa(`${oaUsername}:${oaPassword}`),
              "Accept": "application/json",
            },
          });

          const responseText = await response.text();

          if (response.ok) {
            let filesData: any = {};
            try {
              filesData = JSON.parse(responseText);
            } catch {
              filesData = { files: [] };
            }

            const files = filesData.files ?? filesData.remittanceFiles ?? [];

            // Get already-imported file identifiers
            const { data: existingFiles } = await supabase
              .from("remittance_files" as any)
              .select("file_identifier")
              .eq("company_id", settings.company_id);

            const importedIds = new Set((existingFiles ?? []).map((f: any) => f.file_identifier));

            for (const file of files) {
              const fileId = file.fileId ?? file.id ?? file.fileName;
              if (!fileId || importedIds.has(fileId)) continue;

              // Download the individual 835 file
              const fileUrl = file.downloadUrl ?? `${OA_REMITTANCE_URL}/${fileId}`;
              const fileResponse = await fetch(fileUrl, {
                headers: {
                  "Authorization": "Basic " + btoa(`${oaUsername}:${oaPassword}`),
                },
              });

              if (!fileResponse.ok) {
                const errText = await fileResponse.text();
                errors.push(`Company ${settings.company_id}: Failed to download file ${fileId}: ${errText.slice(0, 100)}`);
                continue;
              }

              const ediContent = await fileResponse.text();

              // Parse 835 content — inline minimal parser for edge function context
              // Match claims by member_id and date_of_service against claim_records
              const clpMatches = ediContent.match(/CLP\*[^~]+/g) ?? [];

              for (const clpSegment of clpMatches) {
                const els = clpSegment.split("*");
                const paidAmount = parseFloat(els[4] ?? "0") || 0;
                const patientResp = parseFloat(els[5] ?? "0") || 0;
                const payerControlNum = els[7] ?? "";

                // Try to match claim by payer_claim_control_number
                if (payerControlNum) {
                  const { data: matchedClaims } = await supabase
                    .from("claim_records")
                    .select("id")
                    .eq("company_id", settings.company_id)
                    .eq("payer_claim_control_number", payerControlNum)
                    .limit(1);

                  if (matchedClaims?.length) {
                    const statusCode = els[2] ?? "";
                    const newStatus = (statusCode === "1" || statusCode === "19") ? "paid" :
                                      (statusCode === "3" || statusCode === "4") ? "denied" : "needs_correction";

                    await supabase
                      .from("claim_records")
                      .update({
                        amount_paid: paidAmount,
                        patient_responsibility_amount: patientResp,
                        status: newStatus,
                        paid_at: paidAmount > 0 ? new Date().toISOString() : null,
                        remittance_date: new Date().toISOString().split("T")[0],
                        payer_claim_control_number: payerControlNum,
                      })
                      .eq("id", matchedClaims[0].id);
                  }
                }
              }

              // Record the imported file
              await supabase.from("remittance_files" as any).insert({
                company_id: settings.company_id,
                file_identifier: fileId,
                file_name: file.fileName ?? fileId,
                imported_at: new Date().toISOString(),
                claim_count: clpMatches.length,
              });

              totalReceived++;
            }

            // Update last_receive_at
            await supabase
              .from("clearinghouse_settings")
              .update({ last_receive_at: new Date().toISOString(), last_error: null })
              .eq("id", settings.id);

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
                message: `Office Ally payment retrieval failed: ${errorMsg}. Check your clearinghouse settings.`,
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
              message: `Office Ally payment retrieval failed: ${fetchErr.message}. Check your clearinghouse settings.`,
              notification_type: "clearinghouse_error",
            });
          }
        }
      } catch (companyErr: any) {
        errors.push(`Company ${settings.company_id}: ${companyErr.message}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, received: totalReceived, errors: errors.length > 0 ? errors : undefined }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

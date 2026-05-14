import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Production vs OATEST sandbox endpoints. Routed by the global
// vendor_clearinghouse_settings.test_mode (PodDispatch vendor singleton).
const OA_REMITTANCE_URL_PROD = "https://www.officeally.com/OA_API/Remittance/GetRemittanceFiles";
const OA_REMITTANCE_URL_TEST = "https://oatest.officeally.com/OA_API/Remittance/GetRemittanceFiles";

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
      const isServiceRole =
        authHeader === `Bearer ${serviceRoleKey}`;
      if (!isServiceRole) {
        if (!authHeader) {
          return new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: membership } = await userClient
          .from("company_memberships")
          .select("role")
          .eq("company_id", targetCompanyId)
          .maybeSingle();

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

    // Vendor-wide test/prod routing — same for every tenant.
    const { data: vendor } = await supabase
      .from("vendor_clearinghouse_settings")
      .select("test_mode")
      .limit(1)
      .maybeSingle();
    const isTestMode = (vendor as any)?.test_mode === true;

    for (const settings of settingsRows) {
      try {
        const oaUsername = (settings.sftp_username ?? "").trim();

        // Real password lives in clearinghouse_credentials, not on settings.
        const { data: credRow } = await supabase
          .from("clearinghouse_credentials")
          .select("sftp_password")
          .eq("company_id", settings.company_id)
          .maybeSingle();
        const oaPassword = (credRow?.sftp_password ?? "").trim();

        // Fail-fast on missing creds with a real message instead of HTTP 401 noise.
        if (!oaUsername || !oaPassword) {
          const msg = !oaUsername
            ? "Office Ally username missing — re-enter in Settings → Clearinghouse."
            : "Office Ally password not stored — re-enter in Settings → Clearinghouse → Step 2.";
          errors.push(`Company ${settings.company_id}: ${msg}`);
          await supabase
            .from("clearinghouse_settings")
            .update({ last_error: msg, ...(oaPassword ? {} : { is_configured: false }) })
            .eq("id", settings.id);
          continue;
        }

        const remittanceUrl = isTestMode ? OA_REMITTANCE_URL_TEST : OA_REMITTANCE_URL_PROD;

        try {
          // Fetch available remittance files from Office Ally
          const response = await fetch(remittanceUrl, {
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
              const fileUrl = file.downloadUrl ?? `${remittanceUrl}/${fileId}`;
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

              // Parse 835 content — inline minimal parser for edge function context.
              // We extract: file-level Billing Provider NPI (NM1*85 before any CLP),
              // then for each CLP we capture the claim reference, payer control #,
              // amounts, status, and any per-claim NM1*85 override.
              const segments = ediContent.split("~").map(s => s.replace(/[\r\n]/g, "").trim()).filter(Boolean);

              // Look up the importing company's billing NPI (the company whose creds we used)
              const { data: importingCompany } = await supabase
                .from("companies")
                .select("npi_number, name")
                .eq("id", settings.company_id)
                .maybeSingle();
              const importingNpi = (importingCompany?.npi_number ?? "").trim();

              type ParsedClp = {
                pcn: string;
                payerControlNum: string;
                statusCode: string;
                paidAmount: number;
                patientResp: number;
                billingNpi: string;
                rawSegment: string;
              };

              let fileLevelBillingNpi = "";
              const claims: ParsedClp[] = [];
              let current: ParsedClp | null = null;

              for (const seg of segments) {
                const els = seg.split("*");
                const tag = els[0];
                if (tag === "NM1" && els[1] === "85") {
                  const npi = (els[9] ?? "").trim();
                  if (current) current.billingNpi = npi;
                  else fileLevelBillingNpi = npi;
                } else if (tag === "CLP") {
                  if (current) claims.push(current);
                  current = {
                    pcn: els[1] ?? "",
                    payerControlNum: els[7] ?? "",
                    statusCode: els[2] ?? "",
                    paidAmount: parseFloat(els[4] ?? "0") || 0,
                    patientResp: parseFloat(els[5] ?? "0") || 0,
                    billingNpi: fileLevelBillingNpi,
                    rawSegment: seg,
                  };
                }
              }
              if (current) claims.push(current);

              let claimsMatched = 0;
              let claimsUpdated = 0;
              let totalPaid = 0;
              let claimsQuarantined = 0;

              for (const c of claims) {
                const { pcn, payerControlNum, statusCode, paidAmount, patientResp, billingNpi, rawSegment } = c;

                // ===== NPI verification gate =====
                // If the 835 carries a Billing NPI and we know the importing company's NPI,
                // they MUST match. Otherwise quarantine and do NOT post payment.
                const npiMismatch =
                  billingNpi.length > 0 &&
                  importingNpi.length > 0 &&
                  billingNpi !== importingNpi;

                if (npiMismatch) {
                  // Try to find the company that DOES own this NPI (for review hint)
                  const { data: trueOwner } = await supabase
                    .from("companies")
                    .select("id")
                    .eq("npi_number", billingNpi)
                    .maybeSingle();

                  await supabase.from("remittance_quarantine").insert({
                    importing_company_id: settings.company_id,
                    matched_company_id: trueOwner?.id ?? null,
                    patient_control_number: pcn,
                    payer_claim_control_number: payerControlNum,
                    billing_npi_in_file: billingNpi,
                    expected_billing_npi: importingNpi,
                    paid_amount: paidAmount,
                    patient_responsibility: patientResp,
                    claim_status_code: statusCode,
                    file_name: file.fileName ?? fileId,
                    raw_clp_segment: rawSegment,
                    quarantine_reason: trueOwner?.id
                      ? `NPI mismatch — file NPI ${billingNpi} belongs to a different company (not importing company ${importingCompany?.name ?? settings.company_id})`
                      : `NPI mismatch — file NPI ${billingNpi} does not match importing company NPI ${importingNpi} and no other company in the system owns that NPI`,
                    status: "pending_review",
                  });
                  claimsQuarantined++;
                  continue; // do not post
                }

                // Try to match claim by payer_claim_control_number
                if (payerControlNum) {
                  const { data: matchedClaims } = await supabase
                    .from("claim_records")
                    .select("id, company_id")
                    .eq("company_id", settings.company_id)
                    .eq("payer_claim_control_number", payerControlNum)
                    .limit(1);

                  if (matchedClaims?.length) {
                    claimsMatched++;
                    const newStatus = (statusCode === "1" || statusCode === "19") ? "paid" :
                                      (statusCode === "3" || statusCode === "4") ? "denied" : "needs_correction";

                    const { error: upErr } = await supabase
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
                    if (!upErr) {
                      claimsUpdated++;
                      totalPaid += paidAmount;
                    }
                  } else {
                    // No matching claim under this company — quarantine for review.
                    // Could be: stale control #, claim under a different company, or test data.
                    await supabase.from("remittance_quarantine").insert({
                      importing_company_id: settings.company_id,
                      matched_company_id: null,
                      patient_control_number: pcn,
                      payer_claim_control_number: payerControlNum,
                      billing_npi_in_file: billingNpi,
                      expected_billing_npi: importingNpi,
                      paid_amount: paidAmount,
                      patient_responsibility: patientResp,
                      claim_status_code: statusCode,
                      file_name: file.fileName ?? fileId,
                      raw_clp_segment: rawSegment,
                      quarantine_reason: `No matching claim found under importing company for payer control number ${payerControlNum}`,
                      status: "pending_review",
                    });
                    claimsQuarantined++;
                  }
                }
              }

              // Record the imported file
              const fileStatus = claims.length === 0
                ? "no_claims"
                : claimsQuarantined > 0 && claimsMatched === 0
                  ? "quarantined"
                  : claimsMatched === 0
                    ? "unmatched"
                    : "imported";
              const { data: insertedFile } = await supabase.from("remittance_files" as any).insert({
                company_id: settings.company_id,
                file_identifier: fileId,
                file_name: file.fileName ?? fileId,
                file_content: ediContent,
                imported_at: new Date().toISOString(),
                claims_matched: claimsMatched,
                claims_updated: claimsUpdated,
                total_paid: totalPaid,
                status: fileStatus,
              }).select("id").maybeSingle();

              // Back-fill remittance_file_id on the just-created quarantine rows for this file
              if (insertedFile?.id && claimsQuarantined > 0) {
                await supabase
                  .from("remittance_quarantine")
                  .update({ remittance_file_id: insertedFile.id })
                  .eq("file_name", file.fileName ?? fileId)
                  .eq("importing_company_id", settings.company_id)
                  .is("remittance_file_id", null);
              }

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

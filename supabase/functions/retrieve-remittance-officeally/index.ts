import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { parseEDI835Envelope } from "../_shared/edi-835-parser.ts";
import { matchRemittanceClaim } from "../_shared/remittance-match.ts";
import { buildClaimPaymentRow } from "../_shared/remittance-post.ts";


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
        const { data: userData } = await userClient.auth.getUser();
        const uid = userData?.user?.id;
        if (!uid) {
          return new Response(
            JSON.stringify({ success: false, error: "Unauthorized" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        // Service-role lookup so we don't depend on RLS visibility of the
        // membership row from the caller's JWT.
        const { data: membership } = await supabase
          .from("company_memberships")
          .select("role")
          .eq("company_id", targetCompanyId)
          .eq("user_id", uid)
          .maybeSingle();

        const allowed = ["owner", "creator", "biller", "manager", "dispatcher"];
        if (!membership || !allowed.includes(membership.role)) {
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

              // Full 835 parse using the SAME parser the manual upload uses
              // (src/lib/edi-835-parser.ts, mirrored into _shared by
              // scripts/sync-billing-to-edge.sh). CAS → CARC/RARC, SVC lines,
              // and PLB provider-level adjustments are all captured.
              const envelope = parseEDI835Envelope(ediContent);
              const parsedClaims = envelope.claims;

              // Importing company: billing NPI + simulation flags (server-derived,
              // never client input — guard_simulated_payment rejects is_simulated
              // on a real tenant).
              const { data: importingCompany } = await supabase
                .from("companies")
                .select("id, name, npi_number, creator_test_tenant, is_sandbox")
                .eq("id", settings.company_id)
                .maybeSingle();
              const importingNpi = (importingCompany?.npi_number ?? "").trim();
              const isSimTenant = Boolean(
                (importingCompany as any)?.creator_test_tenant || (importingCompany as any)?.is_sandbox
              );

              // Candidate claims for this company — same status window the manual
              // upload uses, so both paths match against the same population.
              const { data: candidateClaims } = await supabase
                .from("claim_records")
                .select("id, member_id, run_date, patient_id, total_charge, payer_type, payer_name, payer_claim_control_number")
                .eq("company_id", settings.company_id)
                .in("status", ["submitted", "ready_to_bill", "needs_correction", "needs_review"]);
              const claimsList = (candidateClaims ?? []) as any[];

              let claimsMatched = 0;
              let claimsUpdated = 0;
              let totalPaid = 0;
              let claimsQuarantined = 0;

              // Create the remittance_files row first so claim_payments / PLB rows
              // can reference it. Counters are finalized at the end.
              const sumPlb = envelope.plb_adjustments.reduce((s, p) => s + p.amount, 0);
              const { data: insertedFile } = await supabase.from("remittance_files" as any).insert({
                company_id: settings.company_id,
                file_identifier: fileId,
                file_name: file.fileName ?? fileId,
                file_content: ediContent,
                imported_at: new Date().toISOString(),
                claims_matched: 0,
                claims_updated: 0,
                total_paid: 0,
                status: "processing",
                bpr_total_paid: envelope.bpr_total_paid,
                payment_date: envelope.payment_date || null,
                payer_name: envelope.payer_name || null,
                eft_trace_number: envelope.eft_trace_number || null,
                is_simulated: isSimTenant,
              }).select("id").maybeSingle();
              const remittanceFileId = (insertedFile as any)?.id ?? null;

              for (const rem of parsedClaims) {
                const pcn = rem.patient_control_number;
                const payerControlNum = rem.payer_claim_control_number;
                const statusCode = rem.claim_status_code;
                const paidAmount = rem.paid_amount;
                const patientResp = rem.patient_responsibility;
                const billingNpi = (rem.billing_provider_npi ?? "").trim();
                const rawSegment = `CLP*${pcn}*${statusCode}*${rem.charged_amount}*${paidAmount}*${patientResp}**${payerControlNum}`;

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
                    remittance_file_id: remittanceFileId,
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

                // Shared matcher — identical precedence ladder as the manual upload.
                const match = matchRemittanceClaim(rem as any, claimsList);

                if (!match.matchedClaimId) {
                  // No matching claim under this company — quarantine for review.
                  // Could be: stale control #, claim under a different company, or test data.
                  await supabase.from("remittance_quarantine").insert({
                    importing_company_id: settings.company_id,
                    matched_company_id: null,
                    remittance_file_id: remittanceFileId,
                    patient_control_number: pcn,
                    payer_claim_control_number: payerControlNum,
                    billing_npi_in_file: billingNpi,
                    expected_billing_npi: importingNpi,
                    paid_amount: paidAmount,
                    patient_responsibility: patientResp,
                    claim_status_code: statusCode,
                    file_name: file.fileName ?? fileId,
                    raw_clp_segment: rawSegment,
                    quarantine_reason: payerControlNum
                      ? `No matching claim found under importing company for payer control number ${payerControlNum}`
                      : `No matching claim found under importing company for patient control number ${pcn}`,
                    status: "pending_review",
                  });
                  claimsQuarantined++;
                  continue;
                }

                claimsMatched++;
                const matchedClaim = claimsList.find((c) => c.id === match.matchedClaimId);
                const primaryPayer = (matchedClaim?.payer_type ?? matchedClaim?.payer_name ?? null) as string | null;
                let secondaryPayer: string | null = null;
                if (match.matchedPatientId) {
                  const { data: pat } = await supabase
                    .from("patients")
                    .select("secondary_payer")
                    .eq("id", match.matchedPatientId)
                    .maybeSingle();
                  secondaryPayer = (pat?.secondary_payer ?? null) as string | null;
                }

                // Shared row builder — identical shape as the manual upload.
                // recompute_claim_from_payments derives every claim_records field
                // from this ledger row; we never write claim_records.status here.
                const { row, prCap } = buildClaimPaymentRow(rem as any, {
                  claimRecordId: match.matchedClaimId,
                  companyId: settings.company_id,
                  remittanceFileId,
                  primaryPayer,
                  secondaryPayer,
                  envelopePaymentDate: envelope.payment_date || null,
                  isSimulated: isSimTenant,
                });

                const { error: payErr } = await supabase
                  .from("claim_payments" as any)
                  .insert(row as any);

                if (!payErr) {
                  claimsUpdated++;
                  totalPaid += rem.paid_amount;
                  if (prCap.wasCapped) {
                    try {
                      await supabase.from("audit_logs").insert({
                        company_id: settings.company_id,
                        action: "edit",
                        table_name: "claim_records",
                        record_id: match.matchedClaimId,
                        old_data: { patient_responsibility: prCap.original },
                        new_data: { patient_responsibility: 0, capped: true },
                        notes: `PR auto-capped on Office Ally 835 retrieval: ${prCap.reason}`,
                      });
                    } catch (_) { /* best-effort */ }
                  }
                }
              }

              // Provider-level adjustments (PLB) — same capture as the manual upload.
              if (remittanceFileId && envelope.plb_adjustments.length > 0) {
                await supabase.from("plb_adjustments" as any).insert(
                  envelope.plb_adjustments.map((p) => ({
                    remittance_file_id: remittanceFileId,
                    company_id: settings.company_id,
                    provider_npi: p.provider_npi || null,
                    fiscal_period: p.fiscal_period || null,
                    reason_code: p.reason_code,
                    reference_id: p.reference_id || null,
                    amount: p.amount,
                    is_simulated: isSimTenant,
                  })) as any
                );
              }

              // Finalize the imported file record
              // Parity with the manual import path (src/pages/RemittanceImport.tsx):
              // variance = BPR02 - (sum of ALL parsed CLP paid amounts - sum of PLB).
              // Must use every parsed claim (including quarantined/unmatched ones),
              // not just the ones that posted, or the file looks out of balance.
              const sumClp = envelope.claims.reduce((s: number, c: any) => s + c.paid_amount, 0);
              const variance = Number(
                (envelope.bpr_total_paid - (sumClp - sumPlb)).toFixed(2)
              );
              const fileStatus = parsedClaims.length === 0
                ? "no_claims"
                : claimsQuarantined > 0 && claimsMatched === 0
                  ? "quarantined"
                  : claimsMatched === 0
                    ? "unmatched"
                    : "imported";
              if (remittanceFileId) {
                await supabase
                  .from("remittance_files" as any)
                  .update({
                    claims_matched: claimsMatched,
                    claims_updated: claimsUpdated,
                    total_paid: totalPaid,
                    status: fileStatus,
                    reconciled: Math.abs(variance) < 0.01,
                    reconciliation_variance: variance,
                  })
                  .eq("id", remittanceFileId);
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

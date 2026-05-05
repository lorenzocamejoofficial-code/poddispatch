import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * send-claims-officeally — DISABLED auto-send path.
 *
 * As of the 837P compliance hardening pass (Office Ally vendor cert prep),
 * this function NO LONGER builds or submits EDI. The inline 837P stub it
 * previously contained diverged from the validated frontend generator in
 * src/lib/edi-837p-generator.ts and was producing non-compliant output:
 *   - Loop 2310E (pickup location) entirely missing
 *   - Mileage units hardcoded to UN*1 instead of actual loaded miles
 *   - Origin/destination modifier missing on the mileage SV1 line
 *   - Fabricated N18.6 ESRD diagnosis on missing-ICD10 claims (fraud exposure)
 *   - Segments joined with newlines instead of `~` terminator
 *   - SE01 segment count wrong (would hard-reject at scrubber)
 *   - Hardcoded PODDISPATCH submitter ID and OFFICEALLY receiver
 *
 * Per single-generator policy: all 837P submissions must go through
 * src/lib/edi-837p-generator.ts via Billing -> EDI Export. Until automated
 * submission is rebuilt to pull that generator's output via a queued artifact
 * AND we have a production-tested HTTP submission contract from Office Ally,
 * this endpoint is a controlled no-op.
 *
 * DEFERRED — to re-enable automated send:
 *   1. Have the frontend (or a worker) call generateEDI837P() and persist the
 *      EDI text + filename to a `claim_submission_artifacts` table.
 *   2. This function reads the queued artifact, posts it to Office Ally,
 *      records the response on claim_records, and updates clearinghouse_settings.
 *   3. Add retry, rate limiting, and per-claim error isolation BEFORE flipping
 *      auto_send_enabled back on for any company.
 *   4. Honor vendor_clearinghouse_settings.test_mode (global PodDispatch vendor
 *      singleton): when true, route to the OATEST endpoint, use the vendor
 *      submitter_id, set ISA15="T" on generated artifacts, and tag
 *      claim_records.is_test_submission=true.
 *      Apply the same fail-fast credential checks used by check-eligibility
 *      and retrieve-remittance-officeally (return clear errors and flip
 *      is_configured=false when the SFTP/HTTP password is missing).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Defensive: force auto_send OFF on every row so a stale flag can't trip
    // a scheduled invocation while this path is disabled.
    await supabase
      .from("clearinghouse_settings")
      .update({
        auto_send_enabled: false,
        last_error:
          "Automated submission disabled — pending compliant generator wiring. Use Billing → EDI Export to generate 837P files.",
      })
      .eq("auto_send_enabled", true);

    return new Response(
      JSON.stringify({
        success: false,
        disabled: true,
        message:
          "Automated 837P submission is disabled. Generate claim files via Billing → EDI Export, which uses the validated frontend generator.",
        sent: 0,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

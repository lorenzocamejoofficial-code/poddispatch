import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Determine if called for a specific company or all active companies
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
        // Attempt SFTP connection to check for new 835 files
        try {
          const conn = await Deno.connect({
            hostname: settings.sftp_host || "sftp.officeally.com",
            port: settings.sftp_port || 22,
          });

          // Read SSH banner to verify connectivity
          const buf = new Uint8Array(256);
          await conn.read(buf);
          conn.close();

          // Note: Full SFTP directory listing and file download requires an SSH library.
          // In production, this would:
          // 1. List files in settings.inbound_folder ending in .835 or .txt
          // 2. Cross-reference against remittance_files to skip already-imported files
          // 3. Download each new file
          // 4. Parse using the 835 parser (same logic as RemittanceImport page)
          // 5. Match claims by member_id and date_of_service
          // 6. Update claim_records with payment data
          // 7. Record in remittance_files table
          // 8. Rename/move the processed file on the SFTP server

          // Update last_receive_at to indicate successful check
          await supabase
            .from("clearinghouse_settings")
            .update({ last_receive_at: new Date().toISOString(), last_error: null })
            .eq("id", settings.id);

        } catch (connErr: any) {
          const errorMsg = `SFTP connection failed: ${connErr.message}`;
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
              message: `Clearinghouse SFTP receive failed: ${connErr.message}. Check your clearinghouse settings.`,
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

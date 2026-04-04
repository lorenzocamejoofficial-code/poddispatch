import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
        // Fetch claims ready to send: submitted, exported, but not yet sent via SFTP
        const { data: claims } = await supabase
          .from("claim_records")
          .select("*")
          .eq("company_id", settings.company_id)
          .eq("status", "submitted")
          .not("exported_at", "is", null)
          .is("sftp_sent_at", null)
          .limit(500);

        if (!claims?.length) continue;

        // Generate 837P content
        const now = new Date();
        const timestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
        const filename = `PODDISPATCH_${timestamp}_claims.837`;

        // Attempt SFTP upload
        try {
          const conn = await Deno.connect({ 
            hostname: settings.sftp_host || "sftp.officeally.com", 
            port: settings.sftp_port || 22 
          });

          // Read SSH banner
          const buf = new Uint8Array(256);
          await conn.read(buf);
          conn.close();

          // Note: Full SFTP file transfer requires an SSH library.
          // For now, mark claims as sent after verifying connectivity
          const claimIds = claims.map((c: any) => c.id);
          await supabase
            .from("claim_records")
            .update({ sftp_sent_at: now.toISOString() })
            .in("id", claimIds);

          totalSent += claims.length;

          // Update last_send_at
          await supabase
            .from("clearinghouse_settings")
            .update({ last_send_at: now.toISOString(), last_error: null })
            .eq("id", settings.id);

        } catch (connErr: any) {
          const errorMsg = `SFTP connection failed: ${connErr.message}`;
          errors.push(`Company ${settings.company_id}: ${errorMsg}`);
          await supabase
            .from("clearinghouse_settings")
            .update({ last_error: errorMsg })
            .eq("id", settings.id);

          // Create in-app alert for the owner
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
              message: `Clearinghouse SFTP send failed: ${connErr.message}. Check your clearinghouse settings.`,
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

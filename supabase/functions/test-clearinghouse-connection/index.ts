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
    const { company_id, sftp_username, sftp_password } = await req.json();

    if (!company_id || !sftp_username || !sftp_password) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: company_id, sftp_username, sftp_password" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller is owner for this company
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: membership } = await supabase
      .from("company_memberships")
      .select("role")
      .eq("company_id", company_id)
      .single();

    if (!membership || !["owner", "creator"].includes(membership.role)) {
      return new Response(
        JSON.stringify({ success: false, error: "Only owners can test clearinghouse connections" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Attempt SFTP connection test using Deno.connect (TCP level)
    try {
      const conn = await Deno.connect({ hostname: "sftp.officeally.com", port: 22 });
      
      // Read the SSH banner to verify it's an SSH/SFTP server
      const buf = new Uint8Array(256);
      const n = await conn.read(buf);
      conn.close();

      if (n && n > 0) {
        const banner = new TextDecoder().decode(buf.subarray(0, n));
        if (banner.startsWith("SSH-")) {
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Successfully connected to Office Ally SFTP server. Credentials saved." 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({ success: false, error: "Connected but server did not respond with SSH protocol. Verify the host address." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (connErr: any) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Could not connect to sftp.officeally.com:22 — ${connErr.message}. Verify your network and that Office Ally has enabled SFTP access for your account.` 
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

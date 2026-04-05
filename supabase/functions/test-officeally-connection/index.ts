import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OA_AUTH_URL = "https://www.officeally.com/OA_API/Auth/ValidateProvider";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { company_id, sftp_username, sftp_password } = await req.json();

    if (!company_id || !sftp_username || !sftp_password) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: company_id, username, password" }),
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
        JSON.stringify({ success: false, error: "Only owners can test Office Ally connections" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate credentials via Office Ally authentication endpoint
    try {
      const response = await fetch(OA_AUTH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Basic " + btoa(`${sftp_username}:${sftp_password}`),
        },
        body: JSON.stringify({
          username: sftp_username,
          password: sftp_password,
        }),
      });

      const responseText = await response.text();

      if (response.ok) {
        let result: any = {};
        try {
          result = JSON.parse(responseText);
        } catch {
          // If non-JSON 200, treat as success
          result = { valid: true };
        }

        if (result.valid !== false && result.error === undefined) {
          return new Response(
            JSON.stringify({
              success: true,
              message: "Successfully verified Office Ally credentials. Connection is active.",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          return new Response(
            JSON.stringify({
              success: false,
              error: result.error ?? result.message ?? "Invalid credentials. Check your Office Ally username and password.",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Office Ally returned HTTP ${response.status}. ${responseText.slice(0, 200)}. Verify your credentials.`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (fetchErr: any) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Could not reach Office Ally: ${fetchErr.message}. Check your internet connection and try again.`,
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

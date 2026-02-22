import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is system creator
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check system_creators
    const { data: sc } = await supabaseAdmin
      .from("system_creators")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!sc) {
      return new Response(JSON.stringify({ error: "Forbidden: System creator only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { companyId, action, reason } = await req.json();

    if (!companyId || !action) {
      return new Response(JSON.stringify({ error: "companyId and action required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "approve") {
      const { error: updateError } = await supabaseAdmin
        .from("companies")
        .update({
          onboarding_status: "active",
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        })
        .eq("id", companyId);

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Log onboarding event
      await supabaseAdmin.from("onboarding_events").insert({
        company_id: companyId,
        event_type: "company_approved",
        actor_user_id: user.id,
        actor_email: user.email,
        details: { approved_by: user.email },
      });

      return new Response(JSON.stringify({ success: true, status: "active" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reject") {
      const { error: updateError } = await supabaseAdmin
        .from("companies")
        .update({
          onboarding_status: "rejected",
          rejected_at: new Date().toISOString(),
          rejected_reason: reason || "No reason provided",
        })
        .eq("id", companyId);

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin.from("onboarding_events").insert({
        company_id: companyId,
        event_type: "company_rejected",
        actor_user_id: user.id,
        actor_email: user.email,
        details: { reason },
      });

      return new Response(JSON.stringify({ success: true, status: "rejected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("manage-company error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

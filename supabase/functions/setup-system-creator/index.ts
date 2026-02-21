import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Missing email or password" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if any system creator already exists — only allow one
    const { data: existing } = await supabaseAdmin
      .from("system_creators")
      .select("id")
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ error: "System creator already exists" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create auth user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert into system_creators
    const { error: scError } = await supabaseAdmin
      .from("system_creators")
      .insert({ user_id: newUser.user.id });

    if (scError) {
      // Cleanup
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({ error: "Failed to register system creator" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also give them admin role so they can access the system
    await supabaseAdmin.from("user_roles").insert({
      user_id: newUser.user.id,
      role: "admin",
    });

    // Create a minimal profile (no company — system-level)
    await supabaseAdmin.from("profiles").insert({
      user_id: newUser.user.id,
      full_name: "System Creator",
      sex: "M",
      cert_level: "EMT-B",
      company_id: null,
    });

    return new Response(
      JSON.stringify({ message: "System creator account created", user_id: newUser.user.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

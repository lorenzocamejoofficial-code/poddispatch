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

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: callerUser } = await callerClient.auth.getUser();
    if (!callerUser?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller has owner/creator role via company_memberships
    const { data: callerMembership } = await supabaseAdmin
      .from("company_memberships")
      .select("company_id, role")
      .eq("user_id", callerUser.user.id)
      .in("role", ["owner", "creator"])
      .maybeSingle();

    if (!callerMembership) {
      return new Response(JSON.stringify({ error: "Owner/Creator access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const company_id = callerMembership.company_id;

    const { email, password, full_name, role, sex, cert_level, phone_number,
      employment_type, max_safe_team_lift_lbs, stair_chair_trained,
      bariatric_trained, oxygen_handling_trained, lift_assist_ok, active } = await req.json();

    if (!email || !password || !full_name || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map incoming role to membership_role. Reject unknown roles instead of
    // silently downgrading to "crew" — that masked privilege bugs.
    const roleMap: Record<string, string> = {
      admin: "owner",
      owner: "owner",
      manager: "manager",
      dispatcher: "dispatcher",
      billing: "biller",
      biller: "biller",
      crew: "crew",
    };
    const membershipRole = roleMap[role];
    const allowedRoles = ["owner", "manager", "dispatcher", "biller", "crew"];
    if (!membershipRole || !allowedRoles.includes(membershipRole)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Guard 1: pending-invite check — block if this email is already a
    // placeholder profile attached to a live company (mirrors company-signup).
    const normalizedEmail = String(email).trim().toLowerCase();
    const { data: pendingProfiles } = await supabaseAdmin
      .from("profiles")
      .select("company_id, user_id")
      .eq("email", normalizedEmail)
      .is("user_id", null);

    if (pendingProfiles && pendingProfiles.length > 0) {
      const companyIds = pendingProfiles
        .map((p: { company_id: string | null }) => p.company_id)
        .filter((id): id is string => !!id);
      if (companyIds.length > 0) {
        const { data: liveCompanies } = await supabaseAdmin
          .from("companies")
          .select("id")
          .in("id", companyIds);
        if (liveCompanies && liveCompanies.length > 0) {
          return new Response(JSON.stringify({
            error: "This email already has a pending invite. Resend or accept that invite instead of creating a new user.",
          }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Guard 2: seat caps. Platform limits = 4 admin-class (owner/manager/
    // dispatcher/biller combined) + 30 crew per company.
    const ADMIN_ROLES = ["owner", "manager", "dispatcher", "biller"];
    const CREW_CAP = 30;
    const ADMIN_CAP = 4;
    const { data: currentMemberships } = await supabaseAdmin
      .from("company_memberships")
      .select("role")
      .eq("company_id", company_id);

    if (currentMemberships) {
      const adminCount = currentMemberships.filter(
        (m: { role: string }) => ADMIN_ROLES.includes(m.role),
      ).length;
      const crewCount = currentMemberships.filter(
        (m: { role: string }) => m.role === "crew",
      ).length;

      if (ADMIN_ROLES.includes(membershipRole) && adminCount >= ADMIN_CAP) {
        return new Response(JSON.stringify({
          error: `Admin seat cap reached (${ADMIN_CAP}). Remove or downgrade an existing Owner/Manager/Dispatcher/Biller before adding another.`,
        }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (membershipRole === "crew" && crewCount >= CREW_CAP) {
        return new Response(JSON.stringify({
          error: `Crew seat cap reached (${CREW_CAP}).`,
        }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log(`Admin ${callerUser.user.email} creating user: ${email} with role: ${membershipRole}, company: ${company_id}`);

    // Create auth user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      console.error("Error creating user:", createError);
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create company_membership
    const { error: membershipError } = await supabaseAdmin.from("company_memberships").insert({
      company_id,
      user_id: newUser.user.id,
      role: membershipRole,
    });

    if (membershipError) {
      console.error("Error creating membership:", membershipError);
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({ error: "Failed to create membership" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create profile
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      user_id: newUser.user.id,
      full_name,
      sex: sex || "M",
      cert_level: cert_level || "EMT-B",
      phone_number: phone_number || null,
      company_id,
      employment_type: employment_type || "full_time",
      max_safe_team_lift_lbs: max_safe_team_lift_lbs ?? 250,
      stair_chair_trained: stair_chair_trained ?? false,
      bariatric_trained: bariatric_trained ?? false,
      oxygen_handling_trained: oxygen_handling_trained ?? false,
      lift_assist_ok: lift_assist_ok ?? false,
      active: active ?? true,
    });

    if (profileError) {
      console.error("Error creating profile:", profileError);
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({ error: "Failed to create user profile" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Backward compat: also insert into user_roles
    const legacyRole = role === "biller" ? "billing" : (role === "owner" ? "admin" : role);
    const validLegacyRoles = ["admin", "crew", "dispatcher", "billing"];
    if (validLegacyRoles.includes(legacyRole)) {
      await supabaseAdmin.from("user_roles").insert({
        user_id: newUser.user.id,
        role: legacyRole,
      });
    }

    console.log(`User ${email} created successfully with role ${membershipRole} under company ${company_id}`);

    return new Response(
      JSON.stringify({ user: newUser.user, message: "User created successfully" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

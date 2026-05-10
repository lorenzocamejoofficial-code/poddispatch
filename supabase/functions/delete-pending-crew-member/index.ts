import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No auth header" }, 401);

    const caller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: callerUserData } = await caller.auth.getUser();
    const callerUser = callerUserData?.user;
    if (!callerUser) return json({ error: "Unauthorized" }, 401);

    const { data: callerMembership } = await admin
      .from("company_memberships")
      .select("company_id, role")
      .eq("user_id", callerUser.id)
      .in("role", ["owner", "creator", "manager"])
      .maybeSingle();
    if (!callerMembership) return json({ error: "Owner/Creator access required" }, 403);

    const company_id = callerMembership.company_id;

    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
    const target_user_id: string | undefined = body?.target_user_id;
    const target_email: string | undefined = body?.target_email;
    if (!target_user_id) return json({ error: "target_user_id required" }, 400);

    if (target_user_id === callerUser.id) {
      return json({ error: "You cannot delete yourself" }, 400);
    }

    // Verify target belongs to same company AND is not an owner
    const { data: targetMembership } = await admin
      .from("company_memberships")
      .select("role, company_id")
      .eq("user_id", target_user_id)
      .maybeSingle();

    if (!targetMembership) return json({ error: "Target user not found" }, 404);
    if (targetMembership.company_id !== company_id) {
      return json({ error: "Target belongs to a different company" }, 403);
    }
    if (targetMembership.role === "owner" || targetMembership.role === "creator") {
      return json({ error: "Cannot delete an owner or creator" }, 400);
    }

    // Delete profile, membership, user_roles, invites — explicit cleanup
    await admin.from("profiles").delete().eq("user_id", target_user_id);
    await admin.from("company_memberships").delete().eq("user_id", target_user_id);
    await admin.from("user_roles").delete().eq("user_id", target_user_id);

    if (target_email) {
      // Token-only invites are linked to a profile row that holds email + company.
      const { data: pendingProfiles } = await admin
        .from("profiles")
        .select("id")
        .eq("company_id", company_id)
        .ilike("email", target_email.trim());
      const ids = (pendingProfiles ?? []).map((p: any) => p.id);
      if (ids.length > 0) {
        // FK on company_invites.profile_id is ON DELETE CASCADE.
        await admin.from("profiles").delete().in("id", ids);
      }
    }

    // Finally delete auth user
    const { error: delErr } = await admin.auth.admin.deleteUser(target_user_id);
    if (delErr) {
      console.error("auth deleteUser failed:", delErr);
      return json({ error: "Failed to delete auth user: " + delErr.message }, 500);
    }

    await admin.from("admin_actions").insert({
      company_id,
      actor_user_id: callerUser.id,
      actor_email: callerUser.email ?? null,
      action: "crew_member_deleted",
      reason: `Deleted user ${target_email ?? target_user_id}`,
      before_snapshot: { target_user_id, target_email: target_email ?? null },
    } as any);

    return json({ ok: true });
  } catch (e) {
    console.error("delete-pending-crew-member error:", e);
    return json({ error: "Internal server error" }, 500);
  }
});
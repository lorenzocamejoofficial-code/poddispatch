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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Admin = ReturnType<typeof createClient>;

/** Local YYYY-MM-DD (UTC) used as the "today or later" boundary for shifts. */
const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * Counts a profile's crew seats dated today or later.
 * Past/completed shifts are never touched — they are historical records.
 */
async function countFutureAssignments(admin: Admin, profileId: string, companyId: string) {
  const { data, error } = await admin
    .from("crews")
    .select("id, truck_id, active_date, member1_id, member2_id, member3_id, member3_role, driver_member_id")
    .eq("company_id", companyId)
    .gte("active_date", todayISO());
  if (error) return { rows: [], error: error.message };
  const rows = (data ?? []).filter(
    (c: any) =>
      c.member1_id === profileId || c.member2_id === profileId || c.member3_id === profileId,
  );
  return { rows, error: undefined as string | undefined };
}

/**
 * Clears the archived person out of future crew seats.
 * The crew row is kept (never deleted) so the truck/day still appears on the
 * board — under minimum crew it simply renders as an incomplete shift.
 */
async function clearFutureAssignments(admin: Admin, profileId: string, rows: any[]) {
  let cleared = 0;
  const failures: string[] = [];
  for (const c of rows) {
    const patch: Record<string, unknown> = {};
    if (c.member1_id === profileId) patch.member1_id = null;
    if (c.member2_id === profileId) patch.member2_id = null;
    if (c.member3_id === profileId) { patch.member3_id = null; patch.member3_role = null; }
    if (c.driver_member_id === profileId) patch.driver_member_id = null;
    if (Object.keys(patch).length === 0) continue;
    const { error } = await admin.from("crews").update(patch).eq("id", c.id);
    if (error) failures.push(`${c.active_date}: ${error.message}`);
    else cleared++;
  }
  return { cleared, failures };
}

async function archiveOne(
  admin: Admin,
  opts: { profileId: string; companyId: string; actorUserId: string; actorEmail: string | null },
) {
  const { profileId, companyId, actorUserId, actorEmail } = opts;

  const { data: profile, error: pErr } = await admin
    .from("profiles")
    .select("id, user_id, full_name, company_id, active, archived_at")
    .eq("id", profileId)
    .maybeSingle();
  if (pErr) return { ok: false, error: pErr.message };
  if (!profile) return { ok: false, error: "Employee not found" };
  if ((profile as any).company_id !== companyId) {
    return { ok: false, error: "Employee belongs to a different company" };
  }
  const targetUserId = (profile as any).user_id as string | null;
  const name = (profile as any).full_name as string;

  if (targetUserId && targetUserId === actorUserId) {
    return { ok: false, error: "You cannot archive yourself" };
  }

  // Role they hold today — preserved so Reactivate can restore it exactly.
  let heldRole: string | null = null;
  if (targetUserId) {
    const { data: membership } = await admin
      .from("company_memberships")
      .select("role")
      .eq("user_id", targetUserId)
      .eq("company_id", companyId)
      .maybeSingle();
    heldRole = (membership as any)?.role ?? null;
    if (heldRole === "owner" || heldRole === "creator") {
      return { ok: false, error: `${name} is an owner or creator and cannot be archived` };
    }
  }

  // Already archived → idempotent no-op.
  if ((profile as any).archived_at) {
    return { ok: true, name, alreadyArchived: true, clearedShifts: 0 };
  }

  // 1. Clear FUTURE crew seats only.
  const { rows: futureRows, error: fErr } = await countFutureAssignments(admin, profileId, companyId);
  if (fErr) return { ok: false, error: `Couldn't read upcoming shifts: ${fErr}` };
  const { cleared, failures } = await clearFutureAssignments(admin, profileId, futureRows);
  if (failures.length > 0) {
    return { ok: false, error: `Couldn't clear upcoming shifts — ${failures[0]}` };
  }

  // 2. Revoke grants (permissions, not history).
  if (targetUserId) {
    const { error: mErr } = await admin
      .from("company_memberships")
      .delete()
      .eq("user_id", targetUserId)
      .eq("company_id", companyId);
    if (mErr) return { ok: false, error: `Couldn't revoke company access: ${mErr.message}` };
    await admin.from("user_roles").delete().eq("user_id", targetUserId);
  }

  // 3. Flag the profile as archived — the row itself is never deleted.
  const { error: upErr } = await admin
    .from("profiles")
    .update({
      active: false,
      invitation_status: "inactive",
      archived_at: new Date().toISOString(),
      archived_by: actorUserId,
      archived_role: heldRole,
      pending_role: null,
    } as any)
    .eq("id", profileId);
  if (upErr) return { ok: false, error: `Couldn't archive the profile: ${upErr.message}` };

  // 4. Block sign-in without deleting the login account.
  if (targetUserId) {
    const { error: banErr } = await admin.auth.admin.updateUserById(targetUserId, {
      ban_duration: "876000h", // ~100 years; lifted on reactivate
    } as any);
    if (banErr) {
      console.error("ban failed", banErr);
      return {
        ok: false,
        error: `Archived the record but couldn't block sign-in: ${banErr.message}`,
      };
    }
  }

  await admin.from("admin_actions").insert({
    company_id: companyId,
    actor_user_id: actorUserId,
    actor_email: actorEmail,
    action: "employee_archived",
    reason: `Archived ${name}${cleared ? ` and cleared ${cleared} upcoming shift(s)` : ""}`,
    before_snapshot: { profile_id: profileId, user_id: targetUserId, role: heldRole },
  } as any);

  return { ok: true, name, clearedShifts: cleared };
}

async function unarchiveOne(
  admin: Admin,
  opts: { profileId: string; companyId: string; actorUserId: string; actorEmail: string | null },
) {
  const { profileId, companyId, actorUserId, actorEmail } = opts;

  const { data: profile, error: pErr } = await admin
    .from("profiles")
    .select("id, user_id, full_name, company_id, archived_at, archived_role")
    .eq("id", profileId)
    .maybeSingle();
  if (pErr) return { ok: false, error: pErr.message };
  if (!profile) return { ok: false, error: "Employee not found" };
  if ((profile as any).company_id !== companyId) {
    return { ok: false, error: "Employee belongs to a different company" };
  }
  if (!(profile as any).archived_at) {
    return { ok: true, name: (profile as any).full_name, alreadyActive: true };
  }

  const targetUserId = (profile as any).user_id as string | null;
  const restoredRole = ((profile as any).archived_role as string | null) ?? "crew";

  if (targetUserId) {
    const { error: mErr } = await admin.from("company_memberships").upsert(
      { user_id: targetUserId, company_id: companyId, role: restoredRole } as any,
      { onConflict: "company_id,user_id" },
    );
    if (mErr) return { ok: false, error: `Couldn't restore company access: ${mErr.message}` };

    const appRole =
      restoredRole === "dispatcher" ? "dispatcher"
        : restoredRole === "biller" ? "billing"
        : restoredRole === "manager" ? "admin"
        : "crew";
    await admin.from("user_roles").upsert(
      { user_id: targetUserId, role: appRole } as any,
      { onConflict: "user_id,role" },
    );

    const { error: banErr } = await admin.auth.admin.updateUserById(targetUserId, {
      ban_duration: "none",
    } as any);
    if (banErr) return { ok: false, error: `Couldn't restore sign-in: ${banErr.message}` };
  }

  const { error: upErr } = await admin
    .from("profiles")
    .update({
      active: true,
      invitation_status: targetUserId ? "active" : "pending_invite",
      archived_at: null,
      archived_by: null,
      archived_role: null,
    } as any)
    .eq("id", profileId);
  if (upErr) return { ok: false, error: `Couldn't reactivate the profile: ${upErr.message}` };

  await admin.from("admin_actions").insert({
    company_id: companyId,
    actor_user_id: actorUserId,
    actor_email: actorEmail,
    action: "employee_reactivated",
    reason: `Reactivated ${(profile as any).full_name} as ${restoredRole}`,
    before_snapshot: { profile_id: profileId, user_id: targetUserId, restored_role: restoredRole },
  } as any);

  return { ok: true, name: (profile as any).full_name, restoredRole };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const caller = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: callerData } = await caller.auth.getUser();
    const callerUser = callerData?.user;
    if (!callerUser) return json({ error: "Unauthorized" }, 401);

    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

    const action: string = body?.action;
    if (!["archive", "unarchive", "preview", "archive_bulk"].includes(action)) {
      return json({ error: "Unknown action" }, 400);
    }

    const rawIds: string[] = action === "archive_bulk"
      ? (Array.isArray(body?.profile_ids) ? body.profile_ids : [])
      : [body?.profile_id];
    const profileIds = rawIds.filter((id) => typeof id === "string" && UUID_RE.test(id));
    if (profileIds.length === 0) return json({ error: "No valid employee selected" }, 400);
    if (profileIds.length > 100) return json({ error: "Too many employees selected" }, 400);

    // Caller must be owner/creator/manager of the company the targets belong to.
    const { data: callerMemberships } = await admin
      .from("company_memberships")
      .select("company_id, role")
      .eq("user_id", callerUser.id)
      .in("role", ["owner", "creator", "manager"]);
    if (!callerMemberships || callerMemberships.length === 0) {
      return json({ error: "Owner, creator or manager access required" }, 403);
    }

    // Resolve the company from the first target and verify the caller governs it.
    const { data: firstTarget } = await admin
      .from("profiles")
      .select("company_id")
      .eq("id", profileIds[0])
      .maybeSingle();
    const companyId = (firstTarget as any)?.company_id as string | undefined;
    if (!companyId) return json({ error: "Employee not found" }, 404);
    if (!callerMemberships.some((m: any) => m.company_id === companyId)) {
      return json({ error: "Employee belongs to a different company" }, 403);
    }

    if (action === "preview") {
      const { rows, error } = await countFutureAssignments(admin, profileIds[0], companyId);
      if (error) return json({ error }, 500);
      return json({ ok: true, upcoming_shifts: rows.length });
    }

    if (action === "unarchive") {
      // Reactivate is owner/creator only.
      if (!callerMemberships.some((m: any) => m.company_id === companyId && (m.role === "owner" || m.role === "creator"))) {
        return json({ error: "Only an owner or creator can reactivate an employee" }, 403);
      }
      const result = await unarchiveOne(admin, {
        profileId: profileIds[0],
        companyId,
        actorUserId: callerUser.id,
        actorEmail: callerUser.email ?? null,
      });
      return json(result, result.ok ? 200 : 400);
    }

    const results: any[] = [];
    for (const id of profileIds) {
      const r = await archiveOne(admin, {
        profileId: id,
        companyId,
        actorUserId: callerUser.id,
        actorEmail: callerUser.email ?? null,
      });
      results.push({ profile_id: id, ...r });
    }

    if (action === "archive") {
      const r = results[0];
      return json(r, r.ok ? 200 : 400);
    }

    return json({
      ok: results.every((r) => r.ok),
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    });
  } catch (e) {
    console.error("manage-employee error:", e);
    return json({ error: "Internal server error" }, 500);
  }
});

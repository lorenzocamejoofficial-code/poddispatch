import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "npm:bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
}

/**
 * Two-phase Creator Recovery
 *
 * Phase 1 — verify (sets new password, returns email so frontend can sign in):
 *   POST { slug, passphrase, new_password }
 *
 * Both slug and passphrase must match what was stored via setup-creator-recovery.
 * Rate limit: max 5 attempts per IP per hour. Each attempt logged to creator_recovery_attempts.
 *
 * On success: resets the System Creator's auth password to new_password and returns the
 * creator's email so the client can call supabase.auth.signInWithPassword().
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") || "unknown";

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const logAttempt = async (
    outcome: string,
    slugProvidedHash: string | null,
    notes?: string
  ) => {
    try {
      await supabaseAdmin.from("creator_recovery_attempts").insert({
        ip_address: ip,
        user_agent: userAgent,
        slug_provided_hash: slugProvidedHash,
        outcome,
        notes: notes ?? null,
      });
    } catch (e) {
      console.error("Failed to log recovery attempt:", e);
    }
  };

  try {
    // Rate limit: max 5 attempts per IP in last hour
    const { count: recentCount } = await supabaseAdmin
      .from("creator_recovery_attempts")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", ip)
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

    if ((recentCount ?? 0) >= 5) {
      await logAttempt("rate_limited", null, `count=${recentCount}`);
      return jsonResponse(
        { error: "Too many attempts. Try again in an hour." },
        429
      );
    }

    const body = await req.json().catch(() => null);
    const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
    const passphrase = typeof body?.passphrase === "string" ? body.passphrase : "";
    const newPassword = typeof body?.new_password === "string" ? body.new_password : "";

    if (!slug || !passphrase || !newPassword) {
      await logAttempt("error", null, "missing_fields");
      return jsonResponse({ error: "slug, passphrase, and new_password are required" }, 400);
    }
    if (newPassword.length < 10) {
      await logAttempt("error", null, "weak_password");
      return jsonResponse({ error: "New password must be at least 10 characters" }, 400);
    }

    const slugHash = await sha256Hex(slug);

    const { data: creators, error: scErr } = await supabaseAdmin
      .from("system_creators")
      .select("id, user_id, recovery_slug_hash, recovery_passphrase_hash, recovery_configured_at");
    if (scErr) throw scErr;

    if (!creators || creators.length === 0 || !creators[0].recovery_configured_at) {
      await logAttempt("no_creator_configured", slugHash);
      // Generic message to avoid leaking whether recovery is set up
      return jsonResponse({ error: "Invalid recovery credentials" }, 401);
    }

    const creator = creators[0];

    // Constant-time-ish slug check (compare hashes; SHA-256 hex strings are equal length)
    if (creator.recovery_slug_hash !== slugHash) {
      await logAttempt("slug_invalid", slugHash);
      return jsonResponse({ error: "Invalid recovery credentials" }, 401);
    }

    const passphraseOk = await bcrypt.compare(passphrase, creator.recovery_passphrase_hash || "");
    if (!passphraseOk) {
      await logAttempt("passphrase_invalid", slugHash);
      return jsonResponse({ error: "Invalid recovery credentials" }, 401);
    }

    // Both factors verified — reset the password
    const { data: userRes, error: getUserErr } = await supabaseAdmin.auth.admin.getUserById(
      creator.user_id
    );
    if (getUserErr || !userRes?.user) {
      await logAttempt("error", slugHash, "creator_user_not_found");
      return jsonResponse({ error: "Creator user not found" }, 500);
    }

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(creator.user_id, {
      password: newPassword,
    });
    if (updErr) {
      await logAttempt("error", slugHash, `update_failed: ${updErr.message}`);
      return jsonResponse({ error: updErr.message }, 500);
    }

    await logAttempt("success", slugHash);

    // Also write to global audit_logs for visibility on the creator console
    try {
      await supabaseAdmin.rpc("write_audit_log", {
        _actor_user_id: creator.user_id,
        _actor_email: userRes.user.email || "unknown",
        _action: "creator_password_recovery",
        _table_name: "system_creators",
        _record_id: creator.id,
        _notes: `IP: ${ip}`,
      });
    } catch (e) {
      console.error("audit log write failed:", e);
    }

    return jsonResponse({
      ok: true,
      email: userRes.user.email,
      message: "Password reset successful. You can now sign in.",
    });
  } catch (err: any) {
    console.error("creator-recovery-v2 error:", err);
    return jsonResponse({ error: err?.message || "Internal error" }, 500);
  }
});
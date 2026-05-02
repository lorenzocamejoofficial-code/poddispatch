import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "npm:bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-setup-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * One-time / re-runnable bootstrap for the System Creator recovery slug + passphrase.
 *
 * Auth: requires X-Setup-Secret header matching the SETUP_SECRET env var.
 *
 * Body: { slug: string, passphrase: string, force?: boolean }
 *  - slug:       32+ char random string (the secret URL fragment used in /sys-r/<slug>)
 *  - passphrase: 12+ char passphrase the creator will type to recover
 *  - force:      if true, allows overwriting an already-configured recovery
 *
 * Stores: SHA-256(slug) and bcrypt(passphrase) on the system_creators row.
 * Plain text never touches the DB.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const setupSecret = Deno.env.get("SETUP_SECRET");
    const providedSecret = req.headers.get("X-Setup-Secret");
    if (!setupSecret || !providedSecret || providedSecret !== setupSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized — invalid setup secret" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
    const passphrase = typeof body?.passphrase === "string" ? body.passphrase : "";
    const force = body?.force === true;

    if (slug.length < 32) {
      return new Response(
        JSON.stringify({ error: "slug must be at least 32 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (passphrase.length < 12) {
      return new Response(
        JSON.stringify({ error: "passphrase must be at least 12 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: creators, error: scErr } = await supabaseAdmin
      .from("system_creators")
      .select("id, recovery_configured_at");
    if (scErr) throw scErr;

    if (!creators || creators.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "No system_creators row exists. Run the original creator setup first, or use creator-recovery to bind a creator account.",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const creator = creators[0];

    if (creator.recovery_configured_at && !force) {
      return new Response(
        JSON.stringify({
          error:
            "Recovery is already configured. Pass {\"force\": true} to overwrite (this invalidates the old slug + passphrase).",
          configured_at: creator.recovery_configured_at,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const slugHash = await sha256Hex(slug);
    const passphraseHash = await bcrypt.hash(passphrase, 12);

    const { error: updErr } = await supabaseAdmin
      .from("system_creators")
      .update({
        recovery_slug_hash: slugHash,
        recovery_passphrase_hash: passphraseHash,
        recovery_configured_at: new Date().toISOString(),
      })
      .eq("id", creator.id);

    if (updErr) throw updErr;

    return new Response(
      JSON.stringify({
        ok: true,
        message:
          "Recovery configured. Save your slug + passphrase in a password manager — they cannot be retrieved later.",
        recovery_url_path: `/sys-r/${slug}`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("setup-creator-recovery error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ONE-SHOT bootstrap. Hardcoded slug + passphrase. Delete after use.
const SLUG = "UMfM0yc7ju9mzzl4jahWKi01aYLRQN3zhqdTOM12CGPp8S2m";
const PASSPHRASE = "LorenzoBuiltThisIn2026!";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
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
        JSON.stringify({ error: "No system_creators row exists." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const creator = creators[0];
    const slugHash = await sha256Hex(SLUG);
    const passphraseHash = await bcrypt.hash(PASSPHRASE, 12);

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
        message: "Recovery configured. Now visit /sys-r/" + SLUG,
        recovery_url: "https://thepoddispatch.com/sys-r/" + SLUG,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
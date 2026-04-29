import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendViaResend, renderActionEmail } from "../_shared/send-via-resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-setup-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    const { email, redirect_to } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const normalizedEmail = email.trim().toLowerCase();

    // Find existing system creator (there should be exactly one row, possibly orphaned)
    const { data: creators, error: scErr } = await supabaseAdmin
      .from("system_creators")
      .select("id, user_id");
    if (scErr) throw scErr;

    let creatorUserId: string | null = null;

    // Try to find an existing auth user with this email
    const { data: usersList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const matchingUser = usersList?.users?.find(
      (u: any) => (u.email || "").toLowerCase() === normalizedEmail
    );

    if (matchingUser) {
      creatorUserId = matchingUser.id;
    } else {
      // Create a fresh auth user with a strong random password
      const tempPassword = crypto.randomUUID() + "Aa1!";
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: tempPassword,
        email_confirm: true,
      });
      if (createErr || !created?.user) {
        return new Response(JSON.stringify({ error: createErr?.message || "Failed to create user" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      creatorUserId = created.user.id;

      // Make sure a profile exists
      await supabaseAdmin.from("profiles").upsert(
        {
          user_id: creatorUserId,
          full_name: "System Creator",
          sex: "M",
          cert_level: "EMT-B",
          company_id: null,
        },
        { onConflict: "user_id" }
      );
    }

    // Reconcile system_creators table: ensure exactly one row pointing at creatorUserId
    if (!creators || creators.length === 0) {
      await supabaseAdmin.from("system_creators").insert({ user_id: creatorUserId });
    } else {
      // Update first row, delete any extras
      const [first, ...extras] = creators;
      if (first.user_id !== creatorUserId) {
        await supabaseAdmin
          .from("system_creators")
          .update({ user_id: creatorUserId })
          .eq("id", first.id);
      }
      for (const extra of extras) {
        await supabaseAdmin.from("system_creators").delete().eq("id", extra.id);
      }
    }

    // Generate a recovery link the user can click to set a new password
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: {
        redirectTo: redirect_to || `${new URL(req.url).origin}/reset-password`,
      },
    });

    if (linkErr) {
      return new Response(JSON.stringify({ error: linkErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const actionUrl = linkData?.properties?.action_link ?? null;
    let delivery: { ok: boolean; error?: string } = { ok: false, error: "no_action_link" };
    if (actionUrl) {
      const { html, text } = renderActionEmail({
        heading: "Reset your PodDispatch system creator password",
        intro:
          "A recovery link was generated for your system creator account. Click the button below to set a new password. This link expires soon.",
        actionLabel: "Reset password",
        actionUrl,
        footer:
          "If you didn't request this, you can safely ignore this email.",
      });
      delivery = await sendViaResend({
        to: normalizedEmail,
        subject: "PodDispatch — system creator password reset",
        html,
        text,
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        email: normalizedEmail,
        user_id: creatorUserId,
        action_link: actionUrl,
        email_delivered: delivery.ok,
        email_error: delivery.ok ? undefined : delivery.error,
        message:
          "Creator account is ready. Email delivery attempted via Resend; action_link is also returned for manual fallback.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("creator-recovery error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

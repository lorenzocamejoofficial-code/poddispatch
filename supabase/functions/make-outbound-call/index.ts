import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

// Fix 10: This edge function intentionally calls the Twilio REST API directly
// using HTTP Basic Auth (TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN) rather than
// going through a connector / gateway abstraction. This is the current intended
// implementation — keeping the integration explicit makes Twilio errors easier
// to surface to comms_events and avoids an extra hop. Do not refactor this to
// a connector pattern without an explicit product decision.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RATE_LIMIT_PER_HOUR = 60;
const FUNCTION_NAME = "make-outbound-call";

interface RequestBody {
  comms_event_id: string;
  to_number: string;
  script: string;
  from_number_override?: string | null;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}

function buildTwiml(script: string): string {
  const safeScript = escapeXml(script);
  // Say message, then if no human picks up live we still left the message via TTS.
  // Record verb captures any response/voicemail-style reply for later review.
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${safeScript}</Say>
  <Pause length="1"/>
  <Say voice="alice">If you have any questions, please call us back. Goodbye.</Say>
  <Record maxLength="60" playBeep="true" timeout="5"/>
</Response>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  // Require authenticated dispatcher/admin caller
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const anonClient = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userErr } = await anonClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const callerUserId = userData.user.id;

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { comms_event_id, to_number, script, from_number_override } = body;

  if (!comms_event_id || !to_number || !script) {
    return new Response(
      JSON.stringify({ error: "comms_event_id, to_number, and script are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Validate to_number is E.164 format
  if (!/^\+[1-9]\d{6,14}$/.test(to_number)) {
    return new Response(JSON.stringify({ error: "to_number must be E.164 format (e.g. +15555551234)" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify caller is dispatcher/admin/owner in the company that owns the comms_event
  const { data: ev } = await admin
    .from("comms_events")
    .select("company_id")
    .eq("id", comms_event_id)
    .maybeSingle();
  const eventCompanyId = (ev as { company_id?: string } | null)?.company_id ?? null;
  if (!eventCompanyId) {
    return new Response(JSON.stringify({ error: "comms_event not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: membership } = await admin
    .from("company_memberships")
    .select("role")
    .eq("user_id", callerUserId)
    .eq("company_id", eventCompanyId)
    .maybeSingle();
  const allowedRoles = ["dispatcher", "manager", "owner", "creator", "admin"];
  if (!membership || !allowedRoles.includes(String((membership as { role?: string }).role))) {
    return new Response(JSON.stringify({ error: "Not authorized to place calls for this company" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
  const AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
  const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

  if (!ACCOUNT_SID || !AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    const msg = "Twilio credentials not configured";
    await admin
      .from("comms_events")
      .update({ status: "failed", error_message: msg })
      .eq("id", comms_event_id);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const fromNumber = (from_number_override && from_number_override.trim().length > 0)
    ? from_number_override.trim()
    : TWILIO_PHONE_NUMBER;

  // ---- Per-company rate limit (60 / hour) ----
  const companyId: string | null = eventCompanyId;

  if (companyId) {
    try {
      const { data: existing } = await admin
        .from("edge_function_rate_limits")
        .select("id, request_count, window_start")
        .eq("function_name", FUNCTION_NAME)
        .eq("identifier", companyId)
        .maybeSingle();

      const nowMs = Date.now();
      const windowMs = 60 * 60 * 1000;
      const inWindow = existing && nowMs - new Date(existing.window_start).getTime() < windowMs;

      if (inWindow && existing!.request_count >= RATE_LIMIT_PER_HOUR) {
        const msg = "Rate limit exceeded";
        await admin
          .from("comms_events")
          .update({ status: "failed", error_message: msg })
          .eq("id", comms_event_id);
        return new Response(
          "Rate limit exceeded — maximum 60 calls per hour",
          { status: 429, headers: { ...corsHeaders, "Content-Type": "text/plain" } },
        );
      }

      if (inWindow) {
        await admin
          .from("edge_function_rate_limits")
          .update({ request_count: existing!.request_count + 1 })
          .eq("id", existing!.id);
      } else {
        await admin
          .from("edge_function_rate_limits")
          .upsert(
            {
              function_name: FUNCTION_NAME,
              identifier: companyId,
              window_start: new Date().toISOString(),
              request_count: 1,
            },
            { onConflict: "function_name,identifier" },
          );
      }
    } catch (err) {
      console.error("make-outbound-call rate-limit check failed (allowing request):", err);
    }
  }

  const twiml = buildTwiml(script);
  const statusCallback = `${supabaseUrl}/functions/v1/twilio-call-status-webhook`;

  const formData = new URLSearchParams();
  formData.append("To", to_number);
  formData.append("From", fromNumber);
  formData.append("Twiml", twiml);
  formData.append("StatusCallback", statusCallback);
  formData.append("StatusCallbackMethod", "POST");
  formData.append("StatusCallbackEvent", "initiated");
  formData.append("StatusCallbackEvent", "ringing");
  formData.append("StatusCallbackEvent", "answered");
  formData.append("StatusCallbackEvent", "completed");
  // Twilio sends a separate POST to this same callback URL when a recording finishes.
  formData.append("RecordingStatusCallback", statusCallback);
  formData.append("RecordingStatusCallbackMethod", "POST");

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Calls.json`;
  const basicAuth = btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`);

  try {
    const twilioRes = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      const errMsg = twilioData?.message ?? `Twilio error ${twilioRes.status}`;
      await admin
        .from("comms_events")
        .update({
          status: "failed",
          error_message: errMsg,
          from_number: fromNumber,
        })
        .eq("id", comms_event_id);
      return new Response(
        JSON.stringify({ ok: false, error: errMsg, twilio: twilioData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await admin
      .from("comms_events")
      .update({
        status: "sent",
        twilio_call_sid: twilioData.sid,
        called_at: new Date().toISOString(),
        call_status: twilioData.status ?? "initiated",
        from_number: fromNumber,
      })
      .eq("id", comms_event_id);

    return new Response(
      JSON.stringify({ ok: true, call_sid: twilioData.sid, status: twilioData.status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await admin
      .from("comms_events")
      .update({ status: "failed", error_message: msg })
      .eq("id", comms_event_id);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

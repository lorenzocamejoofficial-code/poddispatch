import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

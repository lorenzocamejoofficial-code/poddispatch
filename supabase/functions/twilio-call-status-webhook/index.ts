import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const emptyTwiml = `<?xml version="1.0" encoding="UTF-8"?><Response/>`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const contentType = req.headers.get("content-type") ?? "";
    let callSid: string | null = null;
    let callStatus: string | null = null;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      callSid = params.get("CallSid");
      callStatus = params.get("CallStatus");
    } else {
      const body = await req.json().catch(() => ({}));
      callSid = body.CallSid ?? body.callSid ?? null;
      callStatus = body.CallStatus ?? body.callStatus ?? null;
    }

    if (callSid && callStatus) {
      const update: Record<string, unknown> = { call_status: callStatus };
      if (callStatus === "completed") {
        update.completed_at = new Date().toISOString();
      }
      if (callStatus === "failed" || callStatus === "no-answer" || callStatus === "busy" || callStatus === "canceled") {
        update.status = "failed";
      }
      if (callStatus === "completed") {
        update.status = "sent";
      }

      await admin
        .from("comms_events")
        .update(update)
        .eq("twilio_call_sid", callSid);
    }
  } catch (err) {
    console.error("twilio-call-status-webhook error:", err);
  }

  return new Response(emptyTwiml, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
});

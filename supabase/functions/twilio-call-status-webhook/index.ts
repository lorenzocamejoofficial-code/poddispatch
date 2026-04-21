import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const emptyTwiml = `<?xml version="1.0" encoding="UTF-8"?><Response/>`;

const RATE_LIMIT_PER_HOUR = 200;
const FUNCTION_NAME = "twilio-call-status-webhook";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/**
 * Compute Twilio webhook signature per
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 * HMAC-SHA1(authToken, fullUrl + sortedKey1 + value1 + sortedKey2 + value2 + ...)
 * then base64.
 */
async function computeTwilioSignature(
  authToken: string,
  fullUrl: string,
  bodyParams: URLSearchParams,
): Promise<string> {
  const keys = [...new Set([...bodyParams.keys()])].sort();
  let data = fullUrl;
  for (const k of keys) {
    // If a key has multiple values, concatenate them in order Twilio sent them.
    for (const v of bodyParams.getAll(k)) {
      data += k + v;
    }
  }
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return bytesToBase64(new Uint8Array(sig));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  // ---- Twilio signature verification (must run before reading the body) ----
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!authToken) {
    console.warn("twilio-call-status-webhook: TWILIO_AUTH_TOKEN is not configured; rejecting request");
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  const twilioSig = req.headers.get("x-twilio-signature") ?? "";
  // Twilio signs the URL it POSTed to. Behind Supabase's proxy req.url is the
  // public function URL, which is what Twilio used when configuring the webhook.
  const fullUrl = req.url;
  const rawBody = await req.text();
  const bodyParams = new URLSearchParams(rawBody);

  let expectedSig = "";
  try {
    expectedSig = await computeTwilioSignature(authToken, fullUrl, bodyParams);
  } catch (err) {
    console.error("twilio-call-status-webhook: signature compute failed", err);
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  if (!twilioSig || !timingSafeEqual(twilioSig, expectedSig)) {
    console.warn("twilio-call-status-webhook: signature mismatch");
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  // ---- Per-IP rate limit (200 / hour) ----
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const clientIp = (fwd.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim();
  try {
    const { data: existing } = await admin
      .from("edge_function_rate_limits")
      .select("id, request_count, window_start")
      .eq("function_name", FUNCTION_NAME)
      .eq("identifier", clientIp)
      .maybeSingle();

    const nowMs = Date.now();
    const windowMs = 60 * 60 * 1000;
    if (existing && nowMs - new Date(existing.window_start).getTime() < windowMs) {
      if (existing.request_count >= RATE_LIMIT_PER_HOUR) {
        console.warn(`twilio-call-status-webhook: rate limit exceeded for IP ${clientIp}`);
        return new Response(null, { status: 429, headers: corsHeaders });
      }
      await admin
        .from("edge_function_rate_limits")
        .update({ request_count: existing.request_count + 1 })
        .eq("id", existing.id);
    } else {
      await admin
        .from("edge_function_rate_limits")
        .upsert(
          {
            function_name: FUNCTION_NAME,
            identifier: clientIp,
            window_start: new Date().toISOString(),
            request_count: 1,
          },
          { onConflict: "function_name,identifier" },
        );
    }
  } catch (err) {
    console.error("twilio-call-status-webhook rate-limit check failed (allowing request):", err);
  }

  try {
    // Body was already consumed for signature verification.
    const contentType = req.headers.get("content-type") ?? "";
    let callSid: string | null = null;
    let callStatus: string | null = null;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      callSid = bodyParams.get("CallSid");
      callStatus = bodyParams.get("CallStatus");
    } else {
      try {
        const json = JSON.parse(rawBody);
        callSid = json.CallSid ?? json.callSid ?? null;
        callStatus = json.CallStatus ?? json.callStatus ?? null;
      } catch {
        callSid = bodyParams.get("CallSid");
        callStatus = bodyParams.get("CallStatus");
      }
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

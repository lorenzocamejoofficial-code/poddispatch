import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

/**
 * Inbound voice webhook. Configure this URL in Twilio console as the
 * "A CALL COMES IN" webhook for the platform Twilio number.
 *
 * Goal: when a patient/facility calls back the shared platform Twilio number,
 * play a short TTS message telling them to call the actual transport company
 * (using that company's verified_caller_id) and log the inbound attempt to
 * comms_events so the dispatcher sees it.
 *
 * Tenant lookup: the shared number can't be reverse-mapped to a tenant on its
 * own. We match the caller's From number against the most recent outbound call
 * placed TO that same number within the last 14 days. If we find one, we know
 * which company called them last and route the callback message accordingly.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

async function computeTwilioSignature(
  authToken: string,
  fullUrl: string,
  bodyParams: URLSearchParams,
): Promise<string> {
  const keys = [...new Set([...bodyParams.keys()])].sort();
  let data = fullUrl;
  for (const k of keys) {
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

function spellPhone(num: string): string {
  // Make TTS pronounce digit-by-digit ("4-0-4 5-5-5 1-2-1-2") for clarity.
  return num.replace(/\D/g, "").split("").join(" ");
}

function genericTwiml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">You have reached an automated outbound line. This number cannot accept incoming calls. Please call your transport provider directly. Goodbye.</Say>
  <Hangup/>
</Response>`;
}

function companyTwiml(companyName: string, callbackNumber: string | null): string {
  const spoken = callbackNumber
    ? `You have reached an automated outbound line for ${escapeXml(companyName)}. This line does not accept incoming calls. Please call ${escapeXml(companyName)} directly at ${spellPhone(callbackNumber)}. Goodbye.`
    : `You have reached an automated outbound line for ${escapeXml(companyName)}. This line does not accept incoming calls. Please call ${escapeXml(companyName)} directly using the number on file. Goodbye.`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${spoken}</Say>
  <Hangup/>
</Response>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!authToken) {
    console.warn("twilio-inbound-voice: TWILIO_AUTH_TOKEN not configured");
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  const rawBody = await req.text();
  const bodyParams = new URLSearchParams(rawBody);
  const twilioSig = req.headers.get("x-twilio-signature") ?? "";
  let expected = "";
  try {
    expected = await computeTwilioSignature(authToken, req.url, bodyParams);
  } catch {
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }
  if (!twilioSig || !timingSafeEqual(twilioSig, expected)) {
    console.warn("twilio-inbound-voice: signature mismatch");
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  const fromNumber = bodyParams.get("From") ?? "";
  const toNumber = bodyParams.get("To") ?? "";
  const callSid = bodyParams.get("CallSid") ?? "";

  // Find which company most recently called this number
  let companyName: string | null = null;
  let callbackNumber: string | null = null;
  let companyId: string | null = null;
  let originalTripId: string | null = null;
  let originalTruckId: string | null = null;

  if (fromNumber) {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await admin
      .from("comms_events")
      .select("company_id, trip_id, truck_id")
      .eq("to_number", fromNumber)
      .eq("direction", "outbound")
      .gte("created_at", fourteenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent?.company_id) {
      companyId = recent.company_id as string;
      originalTripId = (recent.trip_id as string | null) ?? null;
      originalTruckId = (recent.truck_id as string | null) ?? null;

      const [{ data: company }, { data: settings }] = await Promise.all([
        admin.from("companies").select("company_name").eq("id", companyId).maybeSingle(),
        admin.from("company_settings").select("verified_caller_id").eq("company_id", companyId).maybeSingle(),
      ]);
      companyName = (company as { company_name?: string } | null)?.company_name ?? null;
      callbackNumber = (settings as { verified_caller_id?: string } | null)?.verified_caller_id ?? null;
    }
  }

  // Log the inbound attempt so dispatchers see callbacks in the call history
  if (companyId) {
    try {
      await admin.from("comms_events").insert({
        company_id: companyId,
        trip_id: originalTripId,
        truck_id: originalTruckId,
        event_type: "inbound_callback",
        direction: "inbound",
        status: "sent",
        call_status: "completed",
        twilio_call_sid: callSid || null,
        from_number: fromNumber,
        to_number: toNumber,
        called_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        payload: {
          target_name: "Inbound callback",
          target_phone: fromNumber,
          message: `Patient/facility called the platform line back. Directed to ${companyName ?? "transport provider"} at ${callbackNumber ?? "(no callback number on file)"}.`,
        },
        message_text: callbackNumber
          ? `Played callback message directing caller to ${callbackNumber}.`
          : "Played generic callback message (no verified_caller_id configured for this tenant).",
      } as any);
    } catch (err) {
      console.error("twilio-inbound-voice: failed to log inbound event", err);
    }
  }

  const twiml = companyName ? companyTwiml(companyName, callbackNumber) : genericTwiml();
  return new Response(twiml, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
});
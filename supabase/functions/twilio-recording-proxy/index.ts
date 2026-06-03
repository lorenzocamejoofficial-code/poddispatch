import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

/**
 * Authenticated proxy for Twilio call recordings.
 *
 * Twilio recording URLs require HTTP Basic Auth (Account SID + Auth Token).
 * We can't expose those credentials to the browser, so the browser hits this
 * function with the comms_event_id, we RLS-check that the caller is allowed
 * to read that event (i.e. belongs to that company), then we stream the
 * audio back from Twilio.
 *
 * Usage from the client:
 *   <audio src={`${SUPABASE_URL}/functions/v1/twilio-recording-proxy?id=${id}`}
 *          + Authorization header — use fetch+blob URL pattern, see UI code.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  // Verify caller is authenticated
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return new Response("Missing id", { status: 400, headers: corsHeaders });
  }

  // Read the event through the user client so RLS is enforced
  const { data: ev, error: evErr } = await userClient
    .from("comms_events")
    .select("id, recording_url, company_id")
    .eq("id", id)
    .maybeSingle();
  if (evErr || !ev) {
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }
  const recordingUrl = (ev as { recording_url?: string | null }).recording_url;
  if (!recordingUrl) {
    return new Response("No recording", { status: 404, headers: corsHeaders });
  }

  const SID = Deno.env.get("TWILIO_ACCOUNT_SID");
  const TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!SID || !TOKEN) {
    return new Response("Twilio not configured", { status: 500, headers: corsHeaders });
  }

  // Twilio recording URL — request mp3 format
  const fetchUrl = recordingUrl.endsWith(".mp3") ? recordingUrl : `${recordingUrl}.mp3`;
  const basic = btoa(`${SID}:${TOKEN}`);
  const twilioRes = await fetch(fetchUrl, {
    headers: { Authorization: `Basic ${basic}` },
  });
  if (!twilioRes.ok || !twilioRes.body) {
    const txt = await twilioRes.text().catch(() => "");
    return new Response(`Twilio fetch failed: ${twilioRes.status} ${txt}`, {
      status: 502, headers: corsHeaders,
    });
  }

  return new Response(twilioRes.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": twilioRes.headers.get("content-type") ?? "audio/mpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
});
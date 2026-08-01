
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * sftp-test-connection — SFTP POC result: FAILED
 *
 * Finding: Supabase Edge Functions (Deno Deploy) do NOT support outbound
 * raw TCP connections. Deno.connect() hangs silently — no error, no timeout,
 * just blocks until the edge function request times out.
 *
 * This means SSH/SFTP cannot run inside edge functions regardless of library
 * (jsr:@ein/ssh2-ts, npm:ssh2-sftp-client, npm:ssh2 — all need raw TCP).
 *
 * ARCHITECTURE OPTIONS for 837P SFTP submission:
 *   A) External Node.js worker (Cloud Run, Railway, Fly.io, VPS) running
 *      ssh2-sftp-client, polled by a cron or triggered by edge function
 *      via HTTP webhook.
 *   B) Third-party SFTP-as-a-service gateway (e.g. Couchdrop, SFTP Gateway)
 *      that exposes an HTTP API in front of SFTP — edge function POSTs the
 *      file via HTTP, gateway PUTs it via SFTP.
 *   C) Cloudflare Worker with cloudflare:sockets API (supports raw TCP).
 *
 * This function is preserved as documentation. It returns the POC result
 * without attempting any connection.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      success: false,
      poc_result: "FAILED",
      reason: "Supabase Edge Functions do not support outbound raw TCP connections. Deno.connect() hangs silently until request timeout.",
      tested_at: "2026-04-30",
      library_tested: "jsr:@ein/ssh2-ts",
      architecture_options: [
        "A: External Node.js worker (Cloud Run / Railway / Fly.io) with ssh2-sftp-client, triggered via HTTP from edge function",
        "B: SFTP-as-a-service gateway (Couchdrop, SFTP Gateway) exposing HTTP→SFTP bridge",
        "C: Cloudflare Worker with cloudflare:sockets API (supports raw TCP)",
      ],
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

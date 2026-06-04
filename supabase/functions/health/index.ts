import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Status = "ok" | "degraded" | "down" | "unknown";
interface Check { name: string; status: Status; latency_ms: number; detail?: string }

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T | null; latency_ms: number; error: string | null }> {
  const t0 = Date.now();
  try {
    const value = await fn();
    return { value, latency_ms: Date.now() - t0, error: null };
  } catch (e) {
    return { value: null, latency_ms: Date.now() - t0, error: (e as Error).message ?? String(e) };
  }
}

async function checkDb(): Promise<Check> {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { latency_ms, error } = await timed(async () => {
    const { error } = await admin.from("companies").select("id", { head: true, count: "exact" }).limit(1);
    if (error) throw new Error(error.message);
    return true;
  });
  return { name: "database", status: error ? "down" : "ok", latency_ms, detail: error ?? undefined };
}

async function checkStripe(): Promise<Check> {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) return { name: "stripe", status: "unknown", latency_ms: 0, detail: "STRIPE_SECRET_KEY not set" };
  const { latency_ms, error, value } = await timed(async () => {
    const r = await fetch("https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${key}` } });
    return r.status;
  });
  if (error) return { name: "stripe", status: "down", latency_ms, detail: error };
  return { name: "stripe", status: value === 200 ? "ok" : "degraded", latency_ms, detail: `http ${value}` };
}

async function checkTwilio(): Promise<Check> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!sid || !token) return { name: "twilio", status: "unknown", latency_ms: 0, detail: "credentials not set" };
  const { latency_ms, error, value } = await timed(async () => {
    const auth = btoa(`${sid}:${token}`);
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, { headers: { Authorization: `Basic ${auth}` } });
    return r.status;
  });
  if (error) return { name: "twilio", status: "down", latency_ms, detail: error };
  return { name: "twilio", status: value === 200 ? "ok" : "degraded", latency_ms, detail: `http ${value}` };
}

async function checkResend(): Promise<Check> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { name: "resend", status: "unknown", latency_ms: 0, detail: "RESEND_API_KEY not set" };
  const { latency_ms, error, value } = await timed(async () => {
    const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` } });
    return r.status;
  });
  if (error) return { name: "resend", status: "down", latency_ms, detail: error };
  return { name: "resend", status: value === 200 ? "ok" : "degraded", latency_ms, detail: `http ${value}` };
}

function checkOfficeAlly(): Check {
  // Office Ally creds are per-tenant (stored in clearinghouse_settings) so we
  // can only report whether the integration is wired at the platform level.
  const sftpPwd = Deno.env.get("SFTP_PASSWORD");
  return {
    name: "office_ally",
    status: sftpPwd ? "ok" : "unknown",
    latency_ms: 0,
    detail: sftpPwd ? "platform secret set; per-tenant creds checked on submit" : "SFTP_PASSWORD not set",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const [db, stripe, twilio, resend] = await Promise.all([
    checkDb(), checkStripe(), checkTwilio(), checkResend(),
  ]);
  const officeAlly = checkOfficeAlly();
  const checks = [db, stripe, twilio, resend, officeAlly];
  const worst: Status = checks.some(c => c.status === "down")
    ? "down"
    : checks.some(c => c.status === "degraded")
      ? "degraded"
      : checks.every(c => c.status === "ok") ? "ok" : "degraded";
  return new Response(
    JSON.stringify({ status: worst, checked_at: new Date().toISOString(), checks }, null, 2),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
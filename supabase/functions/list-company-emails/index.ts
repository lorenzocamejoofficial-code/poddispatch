import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);
    const actor = userData.user;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Caller must belong to a company (any role). Returns emails only for members of caller's company.
    const { data: actorMembership } = await admin
      .from("company_memberships")
      .select("company_id, role")
      .eq("user_id", actor.id)
      .maybeSingle();

    if (!actorMembership) return json({ error: "No company membership" }, 403);

    const { data: members } = await admin
      .from("company_memberships")
      .select("user_id")
      .eq("company_id", actorMembership.company_id);

    const ids = (members ?? []).map((m: any) => m.user_id);
    const emails: Record<string, string | null> = {};

    // Look up each user's email via auth admin API
    await Promise.all(
      ids.map(async (id: string) => {
        try {
          const { data } = await admin.auth.admin.getUserById(id);
          emails[id] = data?.user?.email ?? null;
        } catch {
          emails[id] = null;
        }
      }),
    );

    return json({ emails });
  } catch (e) {
    console.error("list-company-emails error", e);
    return json({ error: (e as Error).message ?? "Unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
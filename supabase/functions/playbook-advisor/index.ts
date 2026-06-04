import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    // Verify system creator
    const { data: isCreator } = await supabase.rpc("is_system_creator");
    if (!isCreator) return json({ error: "Forbidden" }, 403);

    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "messages required" }, 400);
    }

    // Load playbook index for grounding
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: playbooks } = await admin
      .from("creator_playbooks")
      .select("slug, category, severity, title, summary, when_it_applies, legal_clock");

    const playbookIndex = (playbooks ?? [])
      .map((p: any) =>
        `- [${p.slug}] (${p.category}, ${p.severity}) ${p.title} — ${p.summary} | Applies when: ${p.when_it_applies}${p.legal_clock ? ` | Clock: ${p.legal_clock}` : ""}`
      ).join("\n");

    const systemPrompt = `You are the in-house operations advisor for a solo founder running PodDispatch, a HIPAA-regulated NEMT (non-emergency medical transport) dispatch & billing SaaS in Georgia, USA.

The founder is the ONLY employee. They are not a lawyer, not a doctor, not a compliance officer. Be plain-spoken, calm, direct. No jargon unless you immediately explain it.

You have access to the following internal playbooks the founder has already written:

${playbookIndex}

When the user describes a situation:
1. Identify which playbook slug(s) apply, by [slug]. If none fit, say so and outline general steps.
2. Give a 3-5 step plan for THIS specific situation (do not just paste the playbook verbatim).
3. If legal exposure (HIPAA breach, lawsuit, subpoena, OIG, threats, ransomware) — say "get a lawyer" plainly. You are not a substitute for counsel.
4. If a deadline applies, state it in bold.
5. If a draft email/script would help, write it inline.

Never invent legal advice. Never tell them to ignore something serious. Default to caution. If something is over your head, say "this is over my head — call your attorney today" and stop.`;

    // Call Lovable AI Gateway
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      if (aiRes.status === 429) return json({ error: "Rate limit — try again in a minute." }, 429);
      if (aiRes.status === 402) return json({ error: "AI credits exhausted. Add credits in Lovable workspace settings." }, 402);
      return json({ error: `AI error: ${errText}` }, 500);
    }

    const ai = await aiRes.json();
    const reply = ai.choices?.[0]?.message?.content ?? "(no reply)";
    return json({ reply });
  } catch (err: any) {
    console.error("playbook-advisor error", err);
    return json({ error: err.message || "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
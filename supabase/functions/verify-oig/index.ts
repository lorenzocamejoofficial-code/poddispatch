import { requireSystemCreator, UUID_RE } from "../_shared/creator-gate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const gate = await requireSystemCreator(req);
    if (gate.error) {
      return new Response(JSON.stringify({ status: "pending", error: gate.error }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: gate.status });
    }
    const { name, state, company_id } = await req.json();
    if (company_id !== undefined && (typeof company_id !== "string" || !UUID_RE.test(company_id))) {
      return new Response(JSON.stringify({ status: "pending", error: "company_id must be a valid uuid" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    }
    if (!name) return new Response(JSON.stringify({ status: "pending", error: "No company name provided" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const params = new URLSearchParams({ name });
    if (state) params.set("state", state);
    const resp = await fetch(`https://ofisapi.oig.hhs.gov/api/exclusions/search?${params.toString()}`);

    if (!resp.ok) {
      return new Response(JSON.stringify({ status: "pending", error: "OIG API unavailable. Use the OIG LEIE Search link below to confirm manually." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const results = data.results || data || [];
    
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const nn = normalize(name);
    
    let result: { status: string; details?: string } = { status: "not_excluded" };
    
    if (Array.isArray(results) && results.length > 0) {
      const match = results.find((r: any) => {
        const rName = (r.busname || r.lastname || "").toLowerCase();
        const rn = normalize(rName);
        return rn.includes(nn) || nn.includes(rn) || rn === nn;
      });
      if (match) {
        result = {
          status: "excluded",
          details: `Excluded: ${match.busname || match.lastname} — ${match.excltype || "Unknown type"} (${match.excldate || "Date unknown"})`,
        };
      }
    }

    if (company_id) {
      await gate.admin.from("companies").update({
        oig_excluded: result.status === "excluded",
        oig_exclusion_details: result.details || null,
        verification_checked_at: new Date().toISOString(),
      }).eq("id", company_id);
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (_err) {
    return new Response(
      JSON.stringify({
        status: "pending",
        error: "OIG LEIE has no public API reachable from our servers. Use the OIG LEIE Search link below to verify manually.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { name, state, company_id } = await req.json();
    if (!name) return new Response(JSON.stringify({ status: "pending", error: "No company name provided" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const params = new URLSearchParams({ name });
    if (state) params.set("state", state);
    const resp = await fetch(`https://ofisapi.oig.hhs.gov/api/exclusions/search?${params.toString()}`);

    if (!resp.ok) {
      return new Response(JSON.stringify({ status: "pending", error: "OIG API unavailable — manual check recommended" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await supabase.from("companies").update({
        oig_excluded: result.status === "excluded",
        oig_exclusion_details: result.details || null,
        verification_checked_at: new Date().toISOString(),
      }).eq("id", company_id);
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ status: "pending", error: err.message || "OIG lookup failed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

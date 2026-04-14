import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { npi, company_id } = await req.json();
    if (!npi) return new Response(JSON.stringify({ status: "not_enrolled", error: "No NPI provided" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const resp = await fetch("https://data.cms.gov/provider-data/api/1/datastore/query/mj5m-pzi6/0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conditions: [{ property: "npi", value: npi, operator: "=" }], limit: 5 }),
    });
    if (!resp.ok) throw new Error(`Medicare API returned ${resp.status}`);
    const data = await resp.json();
    const results = data.results || [];

    if (results.length === 0) {
      return new Response(JSON.stringify({ status: "not_enrolled" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const specialties = results.map((r: any) => r.provider_type || r.pri_spec || "").filter(Boolean);
    const isAmbulance = specialties.some((s: string) => s.toLowerCase().includes("ambulance") || s.toLowerCase().includes("emergency medical"));
    const result = { status: isAmbulance ? "enrolled" : "different_specialty", specialty: specialties[0] || "Unknown" };

    if (company_id) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await supabase.from("companies").update({
        medicare_enrolled: result.status === "enrolled",
        medicare_specialty: result.specialty,
        verification_checked_at: new Date().toISOString(),
      }).eq("id", company_id);
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ status: "not_enrolled", error: err.message || "Medicare lookup failed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

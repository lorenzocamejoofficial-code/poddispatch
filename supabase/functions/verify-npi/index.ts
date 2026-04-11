import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { npi, company_name, company_id } = await req.json();
    if (!npi) return new Response(JSON.stringify({ status: "not_found", error: "No NPI provided" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });

    const resp = await fetch(`https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`);
    if (!resp.ok) throw new Error(`NPI API returned ${resp.status}`);
    const data = await resp.json();

    if (!data.results || data.results.length === 0) {
      return new Response(JSON.stringify({ status: "not_found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const r = data.results[0];
    const basic = r.basic || {};
    const registeredName = basic.organization_name || `${basic.first_name || ""} ${basic.last_name || ""}`.trim();
    const addr = r.addresses?.[0] || {};
    const address = [addr.address_1, addr.city, addr.state, addr.postal_code].filter(Boolean).join(", ");

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const na = normalize(registeredName);
    const nb = normalize(company_name || "");
    const matched = na.includes(nb) || nb.includes(na) || na === nb;

    const result = {
      status: matched ? "verified" : "mismatch",
      registeredName,
      address,
      state: addr.state || "",
      entityType: basic.enumeration_type === "NPI-2" ? "Organization" : "Individual",
    };

    // Store to DB
    if (company_id) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await supabase.from("companies").update({
        npi_verified: result.status === "verified",
        npi_registered_name: result.registeredName,
        verification_checked_at: new Date().toISOString(),
      }).eq("id", company_id);
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ status: "not_found", error: err.message || "NPI lookup failed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

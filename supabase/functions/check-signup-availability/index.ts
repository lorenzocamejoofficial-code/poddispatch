import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function ok(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, npi } = await req.json().catch(() => ({}));

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let emailExists = false;
    let npiExists = false;

    // ---- Email check ----
    if (typeof email === "string" && email.trim()) {
      const normalized = email.trim().toLowerCase();
      try {
        // Page through auth users (SDK filter support varies). Small pages,
        // early exit on match. Signup volume is low so this is fine.
        for (let page = 1; page <= 20; page++) {
          const { data, error } = await admin.auth.admin.listUsers({
            page,
            perPage: 200,
          });
          if (error) break;
          const users = data?.users ?? [];
          if (users.some((u: any) => (u.email ?? "").toLowerCase() === normalized)) {
            emailExists = true;
            break;
          }
          if (users.length < 200) break;
        }
      } catch (_) { /* ignore */ }

      if (!emailExists) {
        // Pending-invite parity with company-signup: profile row exists with
        // no user, tied to a live (non-deleted) company.
        const { data: pending } = await admin
          .from("profiles")
          .select("company_id")
          .eq("email", normalized)
          .is("user_id", null);
        const companyIds = (pending ?? [])
          .map((p: any) => p.company_id)
          .filter(Boolean);
        if (companyIds.length > 0) {
          const { data: live } = await admin
            .from("companies")
            .select("id")
            .in("id", companyIds)
            .is("deleted_at", null);
          if (live && live.length > 0) emailExists = true;
        }
      }
    }

    // ---- NPI check ----
    if (typeof npi === "string") {
      const digits = npi.replace(/\D/g, "");
      if (digits.length === 10) {
        const { data: rows } = await admin
          .from("companies")
          .select("id")
          .eq("npi_number", digits)
          .is("deleted_at", null)
          .limit(1);
        if (rows && rows.length > 0) npiExists = true;
      }
    }

    return ok({ emailExists, npiExists });
  } catch (err) {
    console.error("check-signup-availability error", err);
    // Graceful: never hard-block signup on our outage.
    return ok({ emailExists: false, npiExists: false });
  }
});
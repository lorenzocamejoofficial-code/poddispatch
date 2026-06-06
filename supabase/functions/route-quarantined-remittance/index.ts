import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Creator-only action: take a quarantined 835 line and hand the original
// remittance file off to the company that actually owns the claim.
// We copy the source remittance_files row into the target company's books
// so it appears in their Remittance History and they can import/post it
// through the normal owner-side flow.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate caller and require system_creator
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isCreator } = await admin.rpc("is_system_creator_for", { _user_id: userId } as any).catch(() => ({ data: null } as any));
    // Fallback: check role directly
    let allowed = !!isCreator;
    if (!allowed) {
      const { data: roles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      allowed = (roles ?? []).some((r: any) => r.role === "system_creator");
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden — system creator only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const quarantineId = body?.quarantine_id as string | undefined;
    const targetCompanyId = body?.target_company_id as string | undefined;
    const notes = (body?.notes as string | undefined) ?? "";
    if (!quarantineId || !targetCompanyId) {
      return new Response(JSON.stringify({ error: "quarantine_id and target_company_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load quarantine row
    const { data: q, error: qErr } = await admin
      .from("remittance_quarantine")
      .select("*")
      .eq("id", quarantineId)
      .single();
    if (qErr || !q) {
      return new Response(JSON.stringify({ error: "Quarantine record not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (q.status !== "pending_review") {
      return new Response(JSON.stringify({ error: "Already resolved" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Confirm target company exists and is a real tenant
    const { data: tgt, error: tgtErr } = await admin
      .from("companies")
      .select("id, name, deleted_at, is_sandbox, creator_test_tenant")
      .eq("id", targetCompanyId)
      .single();
    if (tgtErr || !tgt) {
      return new Response(JSON.stringify({ error: "Target company not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (tgt.deleted_at) {
      return new Response(JSON.stringify({ error: "Target company is archived" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull source remittance file (raw 835) if present
    let sourceFile: any = null;
    if (q.remittance_file_id) {
      const { data: src } = await admin
        .from("remittance_files")
        .select("*")
        .eq("id", q.remittance_file_id)
        .single();
      sourceFile = src;
    }

    // Compose new file row for the target company. If we don't have the
    // full envelope, fall back to the raw CLP segment so the owner at least
    // has a record they can act on.
    const fileContent =
      sourceFile?.file_content ??
      q.raw_clp_segment ??
      "";
    const fileName = `routed-${q.file_name ?? "remittance"}-${quarantineId.slice(0, 8)}.txt`;

    const { data: newFile, error: insErr } = await admin
      .from("remittance_files")
      .insert({
        company_id: targetCompanyId,
        file_name: fileName,
        file_content: fileContent,
        status: "routed_pending",
        payer_name: sourceFile?.payer_name ?? null,
        eft_trace_number: sourceFile?.eft_trace_number ?? null,
        payment_date: sourceFile?.payment_date ?? null,
        bpr_total_paid: q.paid_amount ?? null,
        total_paid: 0,
        claims_matched: 0,
        claims_updated: 0,
        reconciled: false,
        reconciliation_variance: 0,
        imported_by: userId,
        is_simulated: false,
      })
      .select()
      .single();
    if (insErr) {
      return new Response(JSON.stringify({ error: "Failed to route: " + insErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark quarantine resolved-routed
    await admin
      .from("remittance_quarantine")
      .update({
        status: "resolved_routed",
        matched_company_id: targetCompanyId,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        resolution_notes:
          `Routed to ${tgt.name}. New remittance_files id: ${newFile.id}.` +
          (notes ? ` Notes: ${notes}` : ""),
      })
      .eq("id", quarantineId);

    return new Response(
      JSON.stringify({ ok: true, routed_to: tgt.name, remittance_file_id: newFile.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
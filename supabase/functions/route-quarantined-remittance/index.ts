import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Minimal 835 segment splitter — mirrors src/lib/edi-835-parser.ts so we can
// pull a single claim's loop out of the importer's full file. We do NOT want
// to ship the importer's whole multi-company envelope to the target company.
// ---------------------------------------------------------------------------
function splitSegments(raw: string): { segments: string[] } {
  const trimmed = raw.trim();
  let terminator = "~";
  if (trimmed.startsWith("ISA")) {
    const elementSep = trimmed[3];
    let count = 0;
    for (let i = 0; i < trimmed.length; i++) {
      if (trimmed[i] === elementSep) {
        count++;
        if (count === 16) {
          const idx = i + 2; // skip ISA16 sub-element separator
          if (idx < trimmed.length) {
            terminator = trimmed[idx];
            if (terminator === "\r" || terminator === "\n") terminator = "~";
          }
          break;
        }
      }
    }
  }
  const segments = trimmed
    .split(terminator)
    .map((s) => s.replace(/[\r\n]/g, "").trim())
    .filter((s) => s.length > 0);
  return { segments };
}

/**
 * Extract a single claim from a full 835 and wrap it in a minimal, valid
 * envelope. The returned file passes isValid835() and reconciles cleanly:
 * BPR total == the single claim's CLP04 paid amount, no PLB, no other CLPs.
 * Returns null if the targeted CLP01 isn't found in the source.
 */
function buildSingleClaim835(
  sourceContent: string,
  targetPcn: string,
  paidAmount: number,
): string | null {
  const { segments } = splitSegments(sourceContent);

  // Walk segments collecting envelope context, then locate the target CLP.
  let bprPaymentDate = "";
  let bprPaymentMethod = "ACH";
  let trnTrace = "";
  let mostRecentNm1Pr: string | null = null;
  let mostRecentNm185: string | null = null;
  let clpIdx = -1;

  for (let i = 0; i < segments.length; i++) {
    const els = segments[i].split("*");
    const id = els[0];
    if (id === "BPR") {
      bprPaymentMethod = els[4] || "ACH";
      bprPaymentDate = els[16] || "";
    } else if (id === "TRN" && !trnTrace) {
      trnTrace = els[2] || "";
    } else if (id === "NM1" && els[1] === "PR") {
      mostRecentNm1Pr = segments[i];
    } else if (id === "NM1" && (els[1] === "85" || els[1] === "PE")) {
      mostRecentNm185 = segments[i];
    } else if (id === "CLP" && els[1] === targetPcn) {
      clpIdx = i;
      break;
    }
  }

  if (clpIdx === -1) return null;

  // Claim loop runs from this CLP up to (but not including) the next
  // CLP, PLB, SE, or LX segment. NM1/DTM/CAS/SVC/AMT for this claim live
  // inside that range.
  const claimSegments: string[] = [];
  for (let i = clpIdx; i < segments.length; i++) {
    const segId = segments[i].split("*")[0];
    if (i > clpIdx && (segId === "CLP" || segId === "PLB" || segId === "SE" || segId === "LX")) break;
    claimSegments.push(segments[i]);
  }

  // Build envelope. Control numbers are arbitrary but must be internally
  // consistent (SE matches ST, IEA matches ISA).
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const ccyymmdd = `${yyyy}${mm}${dd}`;
  const yymmdd = `${String(yyyy).slice(-2)}${mm}${dd}`;
  const hhmm = String(now.getUTCHours()).padStart(2, "0") + String(now.getUTCMinutes()).padStart(2, "0");
  const ctrl = String(Date.now()).slice(-9).padStart(9, "0");
  const paidStr = (Math.round(paidAmount * 100) / 100).toFixed(2);

  const out: string[] = [];
  out.push(
    `ISA*00*          *00*          *ZZ*PODROUTED      *ZZ*OWNERIMPORT    *${yymmdd}*${hhmm}*^*00501*${ctrl}*0*P*:`,
  );
  out.push(`GS*HP*PODROUTED*OWNERIMPORT*${ccyymmdd}*${hhmm}*1*X*005010X221A1`);
  // ST starts the transaction set; track its position so we can compute SE count.
  const stIndex = out.length;
  out.push(`ST*835*0001`);
  out.push(`BPR*I*${paidStr}*C*${bprPaymentMethod}*****************${bprPaymentDate || ccyymmdd}`);
  out.push(`TRN*1*${trnTrace || ctrl}*1999999999`);
  if (mostRecentNm1Pr) out.push(mostRecentNm1Pr);
  if (mostRecentNm185) out.push(mostRecentNm185);
  out.push(`LX*1`);
  for (const s of claimSegments) out.push(s);
  // SE count = number of segments from ST through SE inclusive.
  const seCount = out.length - stIndex + 1;
  out.push(`SE*${seCount}*0001`);
  out.push(`GE*1*1`);
  out.push(`IEA*1*${ctrl}`);

  return out.join("~") + "~";
}

// Creator-only action: take a quarantined 835 line and hand the original
// remittance file off to the company that actually owns the claim.
// We build a CLEAN single-claim 835 (just their one claim, BPR = their paid
// amount) and drop it into their books as a remittance_files row they can
// import through the normal owner-side flow.
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

    // Build a clean single-claim 835 the owner can import normally.
    // - If we have the full source envelope AND can locate the target CLP,
    //   produce an importable file (status routed_pending).
    // - Otherwise (only raw_clp_segment, or CLP not found): store what we
    //   have view-only (status routed_view_only); the owner can't import.
    let fileContent = "";
    let routedStatus: "routed_pending" | "routed_view_only" = "routed_view_only";
    const paidAmount = Number(q.paid_amount ?? 0);

    if (sourceFile?.file_content && q.patient_control_number) {
      const rebuilt = buildSingleClaim835(
        sourceFile.file_content as string,
        q.patient_control_number as string,
        paidAmount,
      );
      if (rebuilt) {
        fileContent = rebuilt;
        routedStatus = "routed_pending";
      }
    }
    if (!fileContent) {
      // Fallback: keep something on file for audit, but mark view-only —
      // a bare CLP segment can't be parsed by the owner's import pipeline.
      fileContent = (q.raw_clp_segment as string) ?? "";
      routedStatus = "routed_view_only";
    }
    const fileName = `routed-${q.file_name ?? "remittance"}-${quarantineId.slice(0, 8)}.txt`;

    const { data: newFile, error: insErr } = await admin
      .from("remittance_files")
      .insert({
        company_id: targetCompanyId,
        file_name: fileName,
        file_content: fileContent,
        status: routedStatus,
        payer_name: sourceFile?.payer_name ?? null,
        eft_trace_number: sourceFile?.eft_trace_number ?? null,
        payment_date: sourceFile?.payment_date ?? null,
        bpr_total_paid: routedStatus === "routed_pending" ? paidAmount : (q.paid_amount ?? null),
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
          `Routed to ${tgt.name} as ${routedStatus}. New remittance_files id: ${newFile.id}.` +
          (notes ? ` Notes: ${notes}` : ""),
      })
      .eq("id", quarantineId);

    // Audit trail — mirrors the client-side logAuditEvent shape so the routing
    // event shows up alongside the owner-side import in the same audit log.
    // actor_email is best-effort (creator's auth email).
    const actorEmail = userRes?.user?.email ?? null;
    await admin.from("audit_logs").insert({
      action: "remittance_routed",
      actor_user_id: userId,
      actor_email: actorEmail,
      company_id: targetCompanyId,
      table_name: "remittance_files",
      record_id: newFile.id,
      new_data: {
        quarantine_id: quarantineId,
        target_company_id: targetCompanyId,
        target_company_name: tgt.name,
        source_remittance_file_id: q.remittance_file_id ?? null,
        source_file_name: q.file_name ?? null,
        patient_control_number: q.patient_control_number ?? null,
        paid_amount: paidAmount,
        routed_status: routedStatus,
        new_remittance_file_id: newFile.id,
      },
      notes:
        `Creator routed quarantined remittance ${quarantineId} to ${tgt.name} ` +
        `(${routedStatus}). New remittance_files id: ${newFile.id}.` +
        (notes ? ` Notes: ${notes}` : ""),
    });

    return new Response(
      JSON.stringify({ ok: true, routed_to: tgt.name, remittance_file_id: newFile.id, routed_status: routedStatus }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ack-shared-secret",
};

/* ----------------------- shared X12 utils ----------------------- */
function splitSegments(raw: string) {
  const trimmed = raw.trim();
  let terminator = "~";
  let subSep = ":";
  if (/^ISA/.test(trimmed)) {
    const elSep = trimmed[3];
    let count = 0;
    for (let i = 0; i < trimmed.length; i++) {
      if (trimmed[i] === elSep) {
        count++;
        if (count === 16) {
          if (i + 1 < trimmed.length) {
            const c = trimmed[i + 1];
            if (c && c !== "\r" && c !== "\n") subSep = c;
          }
          const idx = i + 2;
          if (idx < trimmed.length) {
            terminator = trimmed[idx];
            if (terminator === "\r" || terminator === "\n") terminator = "~";
          }
          break;
        }
      }
    }
  }
  const segments = trimmed.split(terminator).map((s) => s.replace(/[\r\n]/g, "").trim()).filter((s) => s.length > 0);
  return { segments, subSep };
}
const els = (s: string) => s.split("*");
const toInt = (v?: string) => { const n = parseInt(v ?? "", 10); return isNaN(n) ? 0 : n; };

/* ------------------------- 999 parser --------------------------- */
interface Parsed999 {
  control_number: string;
  ak9_overall_status: string;
  ak9_label: string;
  groups_received: number; groups_accepted: number;
  transactions_received: number; transactions_accepted: number;
  segment_errors: Array<{ segment_id_code: string; segment_position: string; loop_id: string; syntax_error_code: string; element_errors: string[] }>;
  raw_codes: string[];
}
const AK9_LABEL: Record<string,string> = { A: "Accepted", E: "Accepted with Errors", P: "Partially Accepted", R: "Rejected", X: "Rejected — Decryption Error" };
function parse999(raw: string): Parsed999 {
  const { segments } = splitSegments(raw);
  let controlNumber = "", ak9 = "", gR = 0, gA = 0, tR = 0, tA = 0;
  const segErr: Parsed999["segment_errors"] = [];
  let cur: Parsed999["segment_errors"][number] | null = null;
  for (const s of segments) {
    const e = els(s); const id = e[0];
    if (id === "AK1") controlNumber = e[2] || "";
    else if (id === "AK3" || id === "IK3") {
      cur = { segment_id_code: e[1] || "", segment_position: e[2] || "", loop_id: e[3] || "", syntax_error_code: e[4] || "", element_errors: [] };
      segErr.push(cur);
    } else if (id === "AK4" || id === "IK4") {
      const code = e[3] || e[4] || ""; if (code && cur) cur.element_errors.push(code);
    } else if (id === "AK9" || id === "IK5") {
      ak9 = e[1] || ak9;
      if (id === "AK9") { gR = toInt(e[2]); gA = toInt(e[3]); tR = toInt(e[4]); tA = toInt(e[5]); }
    } else if (id === "SE" || id === "GE" || id === "IEA") cur = null;
  }
  const raw_codes: string[] = [];
  segErr.forEach((x) => { if (x.syntax_error_code) raw_codes.push(`SEG-${x.syntax_error_code}`); x.element_errors.forEach((c) => raw_codes.push(`ELE-${c}`)); });
  return { control_number: controlNumber, ak9_overall_status: ak9, ak9_label: AK9_LABEL[ak9] || `Unknown (${ak9})`, groups_received: gR, groups_accepted: gA, transactions_received: tR, transactions_accepted: tA, segment_errors: segErr, raw_codes: [...new Set(raw_codes)] };
}
const map999Outcome = (s: string): "accepted" | "rejected" => (s === "R" || s === "X" ? "rejected" : "accepted");

/* ------------------------ 277CA parser -------------------------- */
interface Parsed277Claim {
  patient_control_number: string; payer_claim_control_number: string;
  status_category_code: string; status_code: string; entity_identifier: string;
  status_label: string; free_text: string; charge_amount: number;
  outcome: "accepted" | "rejected" | "forwarded"; raw_codes: string[]; patient_name: string; raw_segment: string;
}
const CAT_LABEL: Record<string,string> = {
  A0: "Forwarded", A1: "Receipt acknowledged", A2: "Accepted into adjudication",
  A3: "Returned as unprocessable", A4: "Not Found", A5: "Split Claim",
  A6: "Rejected — missing information", A7: "Rejected — invalid information", A8: "Rejected — relational error",
};
const catOutcome = (c: string): Parsed277Claim["outcome"] => (c === "A0" ? "forwarded" : (c === "A1" || c === "A2" || c === "A5") ? "accepted" : "rejected");
function parse277(raw: string) {
  const { segments, subSep } = splitSegments(raw);
  let payer = "", receiver = ""; const trace: string[] = []; const claims: Parsed277Claim[] = [];
  let cur: Parsed277Claim | null = null; let inClaim = false;
  const flush = () => {
    if (cur) { cur.outcome = catOutcome(cur.status_category_code); cur.status_label = CAT_LABEL[cur.status_category_code] || `Unknown (${cur.status_category_code})`; claims.push(cur); }
    cur = null;
  };
  for (const seg of segments) {
    const e = els(seg); const id = e[0];
    if (id === "NM1") {
      const ent = e[1];
      if (ent === "PR") payer = e[3] || payer;
      else if (ent === "41") receiver = e[3] || receiver;
      else if (ent === "QC" && cur) cur.patient_name = `${e[3] || ""}, ${e[4] || ""}`.trim();
    } else if (id === "TRN") {
      const t = e[2] || "";
      if (!inClaim) { if (t) trace.push(t); }
      else if (cur && !cur.patient_control_number) cur.patient_control_number = t;
    } else if (id === "STC") {
      flush();
      const c = (e[1] || "").split(subSep);
      cur = { patient_control_number: "", payer_claim_control_number: "", status_category_code: c[0] || "", status_code: c[1] || "", entity_identifier: c[2] || "", status_label: "", free_text: e[3] || "", charge_amount: parseFloat(e[4] || "0") || 0, outcome: "accepted", raw_codes: c[0] && c[1] ? [`${c[0]}:${c[1]}`] : [], patient_name: "", raw_segment: seg };
      inClaim = true;
    } else if (id === "REF" && cur) {
      const q = e[1]; const v = e[2] || "";
      if (q === "1K") cur.payer_claim_control_number = v;
      if ((q === "EJ" || q === "D9" || q === "BLT") && !cur.patient_control_number) cur.patient_control_number = v;
    } else if (id === "SE") { flush(); inClaim = false; }
  }
  flush();
  return { payer_name: payer, receiver_name: receiver, trace_numbers: trace, claims };
}

/* --------------------- file-type detection ---------------------- */
type FileType = "999" | "277ca" | "277ca_summary";
function detectFileType(filename: string, content: string): FileType | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".999")) return "999";
  if (lower.endsWith(".277") || /_277(ca)?\.277$/i.test(filename)) return "277ca";
  if (/_277(ca)?\.txt$/i.test(filename)) return "277ca_summary";
  // Defensive content sniff
  if (content.includes("ST*999") || content.includes("ST*997")) return "999";
  if (content.includes("ST*277") || content.includes("BHT*0085")) return "277ca";
  return null;
}
function parseSourceMeta(filename: string) {
  // OA convention: <FILEID>_<SubmittedFileName>_999.999 etc.
  const m = filename.match(/^([^_]+)_(.+?)_(?:999|277|277CA)\.(?:999|277|txt)$/i);
  if (!m) return { source_file_id: null as string | null, submitted_filename: null as string | null };
  return { source_file_id: m[1], submitted_filename: m[2] };
}

/* PCN reverse-match: YYMMDD-XXXXXXXX → claim by run_date + id prefix */
function parsePCN(pcn: string): { runDate: string; idPrefix: string } | null {
  const m = pcn.match(/^(\d{6})-([A-Fa-f0-9]{8})$/);
  if (!m) return null;
  const yy = m[1].slice(0, 2); const mm = m[1].slice(2, 4); const dd = m[1].slice(4, 6);
  const yearPrefix = parseInt(yy, 10) >= 70 ? "19" : "20";
  return { runDate: `${yearPrefix}${yy}-${mm}-${dd}`, idPrefix: m[2].toLowerCase() };
}

/* --------------------- core matching pipeline ------------------- */
/**
 * Run the matching/update logic for a single ack file row that already exists
 * in clearinghouse_ack_files. Used both by the live ingest path and by the
 * reprocess_unmatched backfill path.
 */
async function matchAndApply(
  supabase: any,
  ackFile: { id: string; filename: string; submitted_filename: string | null },
  fileType: FileType,
  content: string,
) {
  const filename = ackFile.filename;
  const submitted = ackFile.submitted_filename ?? parseSourceMeta(filename).submitted_filename;
  let matched = 0, updated = 0, unmatched = 0;
  const summary: any = { file_type: fileType };

  if (fileType === "999") {
    const parsed = parse999(content);
    summary.parsed = { ak9: parsed.ak9_overall_status, label: parsed.ak9_label, groups: { received: parsed.groups_received, accepted: parsed.groups_accepted }, transactions: { received: parsed.transactions_received, accepted: parsed.transactions_accepted }, errors: parsed.segment_errors.length, raw_codes: parsed.raw_codes };

    let claimIds: string[] = [];
    let companyId: string | null = null;
    if (submitted) {
      const candidates = [submitted, `${submitted}.837`, `${submitted}.txt`];
      const inList = candidates.map((c) => `"${c}"`).join(",");
      const { data: q } = await supabase.from("claim_submission_queue")
        .select("claim_ids, company_id, filename")
        .filter("filename", "in", `(${inList})`)
        .limit(1).maybeSingle();
      if (q) { claimIds = (q.claim_ids as string[]) ?? []; companyId = (q.company_id as string) ?? null; }
      if (claimIds.length === 0) {
        const { data: a } = await supabase.from("claim_submission_artifacts")
          .select("claim_ids, company_id, filename")
          .filter("filename", "in", `(${inList})`)
          .order("generated_at", { ascending: false })
          .limit(1).maybeSingle();
        if (a) { claimIds = (a.claim_ids as string[]) ?? []; companyId = (a.company_id as string) ?? null; }
      }
    }
    const outcome = map999Outcome(parsed.ak9_overall_status);
    matched = claimIds.length;

    if (claimIds.length === 0) {
      unmatched = 1;
      // Avoid duplicate quarantine rows on reprocess
      const { data: existingQ } = await supabase.from("remittance_quarantine").select("id").eq("file_name", filename).limit(1).maybeSingle();
      if (!existingQ) {
        await supabase.from("remittance_quarantine").insert({
          file_name: filename, file_type: "999",
          quarantine_reason: `999 ${parsed.ak9_label} could not be matched to a submitted batch (control # ${parsed.control_number})`,
          status: "pending_review",
        });
      }
    } else {
      const ackStatus = outcome === "rejected" ? "rejected_999" : "accepted_999";
      const updateBody: any = {
        acknowledgment_status: ackStatus,
        acknowledged_at: new Date().toISOString(),
        edi_acknowledgment_code: parsed.ak9_overall_status,
        updated_at: new Date().toISOString(),
      };
      if (outcome === "rejected") {
        updateBody.status = "needs_correction";
        updateBody.rejection_codes = parsed.raw_codes;
        updateBody.rejection_reason = `999 ${parsed.ak9_label}`;
        updateBody.clearinghouse_status = "rejected";
      } else {
        updateBody.clearinghouse_status = "accepted";
      }
      const { error: updErr } = await supabase.from("claim_records").update(updateBody).in("id", claimIds);
      if (!updErr) updated = claimIds.length;

      const ackRows = claimIds.map((cid) => ({
        claim_record_id: cid, ack_file_id: ackFile.id, company_id: companyId, file_type: "999",
        outcome, rejection_codes: outcome === "rejected" ? parsed.raw_codes : null,
        rejection_reason: outcome === "rejected" ? `999 ${parsed.ak9_label}` : null,
        raw_segment: JSON.stringify(parsed.segment_errors).slice(0, 4000),
      }));
      if (ackRows.length) await supabase.from("claim_acknowledgments").insert(ackRows);

      // If we just rescued this ack from quarantine, mark it resolved
      await supabase.from("remittance_quarantine")
        .update({ status: "resolved", reviewed_at: new Date().toISOString(), resolution_notes: `Auto-matched on reprocess to ${claimIds.length} claim(s)` })
        .eq("file_name", filename).eq("status", "pending_review");
    }
  } else {
    // 277ca
    const parsed = parse277(content);
    summary.parsed = { payer: parsed.payer_name, claims: parsed.claims.length, traces: parsed.trace_numbers };

    for (const c of parsed.claims) {
      const pcn = c.patient_control_number;
      if (!pcn) {
        unmatched++;
        await supabase.from("remittance_quarantine").insert({
          file_name: filename, file_type: "277ca",
          patient_control_number: null,
          payer_claim_control_number: c.payer_claim_control_number || null,
          claim_status_code: `${c.status_category_code}:${c.status_code}`,
          quarantine_reason: `277CA line missing patient control number — outcome ${c.outcome}`,
          raw_clp_segment: c.raw_segment,
          status: "pending_review",
        });
        continue;
      }
      const parts = parsePCN(pcn);
      let claim: { id: string; company_id: string | null } | null = null;
      if (parts) {
        const { data: rows } = await supabase
          .from("claim_records")
          .select("id, company_id")
          .eq("run_date", parts.runDate)
          .ilike("id", `${parts.idPrefix}%`)
          .limit(1);
        if (rows && rows.length) claim = rows[0] as any;
      }
      if (!claim && c.payer_claim_control_number) {
        const { data: byPayer } = await supabase.from("claim_records").select("id, company_id").eq("payer_claim_control_number", c.payer_claim_control_number).limit(1);
        if (byPayer && byPayer.length) claim = byPayer[0] as any;
      }
      if (!claim) {
        unmatched++;
        await supabase.from("remittance_quarantine").insert({
          file_name: filename, file_type: "277ca",
          patient_control_number: pcn,
          payer_claim_control_number: c.payer_claim_control_number || null,
          claim_status_code: `${c.status_category_code}:${c.status_code}`,
          quarantine_reason: `277CA referenced unknown patient control number ${pcn}`,
          raw_clp_segment: c.raw_segment,
          status: "pending_review",
        });
        continue;
      }
      matched++;
      const ackStatus =
        c.outcome === "rejected" ? "rejected_277ca" :
        c.outcome === "forwarded" ? "forwarded_to_payer" :
        "accepted_277ca";
      const updateBody: any = {
        acknowledgment_status: ackStatus,
        acknowledged_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        clearinghouse_status: c.outcome,
      };
      if (c.payer_claim_control_number) updateBody.payer_claim_control_number = c.payer_claim_control_number;
      if (c.outcome === "rejected") {
        updateBody.status = "needs_correction";
        updateBody.rejection_codes = c.raw_codes;
        updateBody.rejection_reason = `277CA ${c.status_label}${c.free_text ? ` — ${c.free_text}` : ""}`.slice(0, 500);
      }
      const { error: updErr } = await supabase.from("claim_records").update(updateBody).eq("id", claim.id);
      if (!updErr) updated++;
      await supabase.from("claim_acknowledgments").insert({
        claim_record_id: claim.id, ack_file_id: ackFile.id, company_id: claim.company_id, file_type: "277ca",
        outcome: c.outcome, patient_control_number: pcn,
        payer_claim_control_number: c.payer_claim_control_number || null,
        rejection_codes: c.outcome === "rejected" ? c.raw_codes : null,
        rejection_reason: c.outcome === "rejected" ? `277CA ${c.status_label}${c.free_text ? ` — ${c.free_text}` : ""}`.slice(0, 500) : null,
        raw_segment: c.raw_segment,
      });
    }
  }

  await supabase.from("clearinghouse_ack_files").update({
    parsed_summary: summary, claims_matched: matched, claims_updated: updated,
    unmatched_count: unmatched, processed_at: new Date().toISOString(), parse_error: null,
  }).eq("id", ackFile.id);

  return { matched, updated, unmatched, summary };
}

/* ---------------------------- handler --------------------------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sharedSecret = Deno.env.get("ACK_INGEST_SHARED_SECRET");
  const provided = req.headers.get("x-ack-shared-secret");
  const authHeader = req.headers.get("Authorization");
  const isWorkerCall = !!sharedSecret && provided === sharedSecret;

  // Manual uploads must come from an authenticated system creator. The presence
  // of an Authorization header alone is NOT sufficient (the anon publishable key
  // is shipped to all browsers).
  let isCreatorCall = false;
  if (!isWorkerCall && authHeader?.startsWith("Bearer ")) {
    try {
      const anon = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: userData } = await anon.auth.getUser();
      if (userData?.user) {
        const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { data: creatorRow } = await admin
          .from("system_creators")
          .select("user_id")
          .eq("user_id", userData.user.id)
          .maybeSingle();
        isCreatorCall = !!creatorRow;
      }
    } catch (err) {
      console.error("ingest-acks auth check failed:", err);
    }
  }

  if (!isWorkerCall && !isCreatorCall) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let body: any;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  /* ---- Backfill mode: re-run matching against all unmatched ack files ---- */
  if (body?.reprocess_unmatched === true) {
    const { data: rows, error } = await supabase
      .from("clearinghouse_ack_files")
      .select("id, filename, file_type, submitted_filename, raw_content, claims_matched")
      .in("file_type", ["999", "277ca"])
      .or("claims_matched.is.null,claims_matched.eq.0")
      .order("created_at", { ascending: true });
    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const results: any[] = [];
    for (const r of rows ?? []) {
      try {
        const out = await matchAndApply(supabase, { id: r.id, filename: r.filename, submitted_filename: r.submitted_filename }, r.file_type as FileType, r.raw_content as string);
        results.push({ filename: r.filename, ...out });
      } catch (err) {
        results.push({ filename: r.filename, error: (err as Error).message });
      }
    }
    return new Response(JSON.stringify({ ok: true, reprocessed: results.length, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const filename: string = body?.filename || "";
  const contentB64: string = body?.content_base64 || "";
  const contentRaw: string | undefined = body?.content;
  if (!filename || (!contentB64 && !contentRaw)) {
    return new Response(JSON.stringify({ ok: false, error: "filename and content required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const content = contentRaw ?? new TextDecoder().decode(Uint8Array.from(atob(contentB64), (c) => c.charCodeAt(0)));
  const fileType = (body?.file_type as FileType | undefined) ?? detectFileType(filename, content);
  if (!fileType) {
    return new Response(JSON.stringify({ ok: false, error: "Could not detect file type", filename }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Idempotent insert (UNIQUE filename). If duplicate, skip.
  const meta = parseSourceMeta(filename);
  const { data: ackFile, error: ackErr } = await supabase
    .from("clearinghouse_ack_files")
    .insert({
      filename,
      file_type: fileType,
      source_file_id: meta.source_file_id,
      submitted_filename: meta.submitted_filename,
      raw_content: content,
      parsed_summary: {},
    })
    .select()
    .single();

  if (ackErr) {
    if ((ackErr as any).code === "23505") {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "duplicate_filename", filename }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: false, error: ackErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // 277CA summary: just log, no claim updates
  if (fileType === "277ca_summary") {
    await supabase.from("clearinghouse_ack_files").update({ parsed_summary: { note: "summary text file logged" }, processed_at: new Date().toISOString() }).eq("id", ackFile.id);
    return new Response(JSON.stringify({ ok: true, filename, file_type: fileType, note: "summary logged" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { matched, updated, unmatched, summary } = await matchAndApply(
      supabase,
      { id: ackFile.id, filename, submitted_filename: meta.submitted_filename },
      fileType,
      content,
    );
    return new Response(JSON.stringify({ ok: true, filename, file_type: fileType, matched, updated, unmatched, summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = (err as Error).message;
    await supabase.from("clearinghouse_ack_files").update({ parse_error: msg, processed_at: new Date().toISOString() }).eq("id", ackFile.id);
    return new Response(JSON.stringify({ ok: false, error: msg, filename }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
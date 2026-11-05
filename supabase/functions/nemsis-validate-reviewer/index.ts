/**
 * nemsis-validate-reviewer — ADDITIVE, isolated validation with a reviewer-supplied
 * Schematron (.sch). Creator-only; certification records only (buildCertRecordXml
 * guard). Compiles the raw .sch at request time (ISO skeleton SEFs → XSLT) and runs it
 * with SaxonJS. Never touches the bundled rule sets or the nemsis-validate function.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import SaxonJS from "npm:saxon-js@2.7.0";
import { parseSvrl } from "../_shared/nemsis/validation.ts";
import { buildCertRecordXml, CertGuardError } from "../_shared/nemsis/cert-records.ts";
import { SKELETON_SEF } from "./skeleton.generated.ts";

const Body = z.object({
  record_id: z.string().uuid(),
  dem_sch: z.string().max(8_000_000).optional(),
  ems_sch: z.string().max(8_000_000).optional(),
  dem_name: z.string().max(200).optional(),
  ems_name: z.string().max(200).optional(),
});

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function gunzip(b64: string): Promise<string> {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}
const sef = new Map<string, unknown>();
async function step(name: string, text: string, params: Record<string, string> = {}): Promise<string> {
  if (!sef.has(name)) sef.set(name, JSON.parse(await gunzip(SKELETON_SEF[name])));
  // deno-lint-ignore no-explicit-any
  return (SaxonJS as any).transform({ stylesheetInternal: sef.get(name), sourceText: text, destination: "serialized", stylesheetParams: params }, "sync").principalResult;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: u, error: uErr } = await admin.auth.getUser(auth.replace("Bearer ", ""));
  if (uErr || !u?.user) return json({ error: "Unauthorized" }, 401);
  const { data: cr } = await admin.from("system_creators").select("user_id").eq("user_id", u.user.id).maybeSingle();
  if (!cr) return json({ error: "Forbidden — system creators only" }, 403);

  let raw: unknown;
  try { raw = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const body = parsed.data;

  const { data: rec } = await admin.from("nemsis_cert_records")
    .select("id, company_id, kind, case_key, payload, updated_at").eq("id", body.record_id).maybeSingle();
  if (!rec) return json({ error: "Record not found" }, 404);
  const { data: co } = await admin.from("companies")
    .select("id, is_sandbox, creator_test_tenant, nemsis_certification, deleted_at").eq("id", rec.company_id).maybeSingle();
  let built;
  try { built = buildCertRecordXml(rec, co); } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, e instanceof CertGuardError ? 403 : 422);
  }
  const sch = built.dataset === "DEM" ? body.dem_sch : body.ems_sch;
  const name = (built.dataset === "DEM" ? body.dem_name : body.ems_name) ?? `${built.dataset} reviewer file`;
  if (!sch) return json({ dataset: built.dataset, skipped: true, findings: [] });

  const t0 = performance.now();
  let xsl: string;
  try {
    let s: string;
    try { s = await step("iso_dsdl_include", sch); } catch { s = sch; } // external includes unsupported; large files overflow → use as-is
    s = await step("iso_abstract_expand", s);
    xsl = await step("iso_svrl_for_xslt2", s, { "allow-foreign": "true" });
  } catch (e) {
    return json({ error: `Could not compile the reviewer Schematron: ${e instanceof Error ? e.message : String(e)}` }, 422);
  }
  const t1 = performance.now();
  let svrl: string;
  try {
    // deno-lint-ignore no-explicit-any
    svrl = String((SaxonJS as any).XPath.evaluate(
      "transform(map{'stylesheet-text': $s, 'source-node': parse-xml($x), 'delivery-format': 'serialized'})?output",
      [], { params: { s: xsl, x: built.xml } },
    ));
  } catch (e) {
    return json({ error: `Reviewer Schematron failed to run: ${e instanceof Error ? e.message : String(e)}` }, 422);
  }
  const version = /schemaVersion="([^"]*)"/.exec(sch)?.[1] ?? null;
  const source = `Reviewer: ${name}`;
  const findings = parseSvrl(svrl, source).map((f) => ({ ...f, enforced: true }));
  return json({
    dataset: built.dataset, skipped: false, findings,
    rule_set: { id: `reviewer-${built.dataset.toLowerCase()}`, source, version, enforced: true },
    ms: { compile: Math.round(t1 - t0), run: Math.round(performance.now() - t1) },
  });
});

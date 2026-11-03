/**
 * In-app NEMSIS validation engine (Deno edge runtime).
 * - XSD: libxml2 compiled to WebAssembly (npm:xmllint-wasm) against the 3.5.1 XSD set.
 * - Schematron: SaxonJS running precompiled SEF of every configured file
 *   (national + Georgia + 2026 compliance) — see scripts/nemsis/build-validation-assets.mjs.
 * Never calls the CTA.
 */
import SaxonJS from "npm:saxon-js@2.7.0";
import { validateXML } from "npm:xmllint-wasm@4.0.2";
import { SCHEMATRON_ASSETS, XSD_BUNDLE } from "./assets.generated.ts";
import { parseSvrl, summarize, xsdFindings, type ValidationFinding, type ValidationResult } from "../validation.ts";

async function gunzipB64(b64: string): Promise<string> {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

let xsdCache: { fileName: string; contents: string }[] | null = null;
const sefCache = new Map<string, unknown>();

async function xsdFiles() {
  if (!xsdCache) {
    const map = JSON.parse(await gunzipB64(XSD_BUNDLE)) as Record<string, string>;
    xsdCache = Object.entries(map).map(([fileName, contents]) => ({ fileName, contents }));
  }
  return xsdCache;
}

async function sef(id: string, b64: string) {
  if (!sefCache.has(id)) sefCache.set(id, JSON.parse(await gunzipB64(b64)));
  return sefCache.get(id);
}

export async function validateNemsisXml(xml: string, dataset: "DEM" | "EMS"): Promise<ValidationResult> {
  const findings: ValidationFinding[] = [];
  const files = await xsdFiles();
  const root = `${dataset}DataSet_v3.xsd`;
  const xsd = await validateXML({
    xml: [{ fileName: `${dataset}.xml`, contents: xml }],
    schema: files.filter((f) => f.fileName === root),
    preload: files.filter((f) => f.fileName !== root),
  });
  findings.push(...xsdFindings(xsd.errors));

  const sets = SCHEMATRON_ASSETS.filter((a) => a.dataset === dataset);
  // Schematron needs well-formed XML; if XSD parsing failed outright, report that alone.
  const malformed = xsd.errors.some((e) => /parser error|not well-formed|Document is empty/i.test(e.rawMessage ?? e.message ?? ""));
  if (!malformed) {
    for (const a of sets) {
      try {
        const out = SaxonJS.transform({ stylesheetInternal: await sef(a.id, a.sef), sourceText: xml, destination: "serialized" }, "sync");
        findings.push(...parseSvrl(String(out.principalResult ?? ""), a.source));
      } catch (e) {
        findings.push({ level: "ERROR", source: a.source, message: `Rule file could not run: ${e instanceof Error ? e.message : String(e)}`, location: null, elements: [], rule_id: null });
      }
    }
  }
  return summarize(dataset, findings, sets.map((a) => ({ id: a.id, source: a.source, version: a.version })));
}

/**
 * In-app NEMSIS validation engine (Deno edge runtime).
 * - XSD: libxml2 compiled to WebAssembly (vendored xmllint-wasm, run in-thread) against the 3.5.1 XSD set.
 * - Schematron: SaxonJS running precompiled SEF of every configured file
 *   (national + Georgia + 2026 compliance) — see scripts/nemsis/build-validation-assets.mjs.
 * Never calls the CTA.
 */
import SaxonJS from "npm:saxon-js@2.7.0";
import { XmllintModule, XMLLINT_WASM_GZ_B64 } from "./xmllint-vendor.generated.ts";
import { SCHEMATRON_ASSETS, XSD_BUNDLE } from "./assets.generated.ts";
import { parseSvrl, summarize, xsdFindings, type ValidationFinding, type ValidationResult } from "../validation.ts";

async function gunzipB64Bytes(b64: string): Promise<Uint8Array> {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
const gunzipB64 = async (b64: string) => new TextDecoder().decode(await gunzipB64Bytes(b64));

let wasmBinary: Uint8Array | null = null;
type XsdError = { message: string; rawMessage: string; loc: { lineNumber: number } | null };

/** Runs `xmllint --schema <root> --noout <xml>` in-thread; returns parsed stderr errors. */
async function runXsd(xml: string, root: string, files: { fileName: string; contents: string }[]): Promise<XsdError[]> {
  wasmBinary ??= await gunzipB64Bytes(XMLLINT_WASM_GZ_B64);
  const stderr: number[] = [];
  const exitCode: number = await new Promise((resolve, reject) => {
    XmllintModule({
      inputFiles: [{ fileName: "record.xml", contents: xml }, ...files],
      arguments: ["--schema", root, "--noout", "record.xml"],
      stdout: () => {},
      stderr: (b: number) => stderr.push(b),
      onExit: resolve,
      wasmBinary,
      wasmMemory: new WebAssembly.Memory({ initial: 256, maximum: 1024 }),
      print: () => {},
      printErr: () => {},
    }).catch(reject);
  });
  const out = new TextDecoder().decode(Uint8Array.from(stderr));
  if (exitCode === 0) return [];
  if (exitCode !== 3 && exitCode !== 4) {
    return [{ message: `Schema check could not run (xmllint exit ${exitCode}): ${out.trim()}`, rawMessage: out, loc: null }];
  }
  return out.split("\n").filter((l) => l.trim() && !l.trim().endsWith(" validates") && !/fails to validate$/.test(l.trim()))
    .map((line) => {
      const [, ln, ...rest] = line.split(":");
      const n = Number(ln);
      return Number.isFinite(n) && rest.length
        ? { message: rest.join(":").trim(), rawMessage: line, loc: { lineNumber: n } }
        : { message: line, rawMessage: line, loc: null };
    });
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
  const xsdErrors = await runXsd(xml, root, files);
  findings.push(...xsdFindings(xsdErrors));

  const sets = SCHEMATRON_ASSETS.filter((a) => a.dataset === dataset);
  // Schematron needs well-formed XML; if XSD parsing failed outright, report that alone.
  const malformed = xsdErrors.some((e) => /parser error|not well-formed|Document is empty/i.test(e.rawMessage ?? e.message ?? ""));
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

/**
 * In-app NEMSIS validation engine (Deno edge runtime). Never calls the CTA.
 * - XSD: libxml2 compiled to WebAssembly (vendored xmllint-wasm, run in-thread)
 *   against the bundled 3.5.1 XSD set.
 * - Schematron: SaxonJS running precompiled SEF of every configured file
 *   (national + Georgia + 2026 compliance) — scripts/nemsis/build-validation-assets.mjs.
 *
 * Work is split into "units" (XSD, then one per Schematron file/part) so each
 * unit fits the edge runtime's per-request CPU budget; nemsis-validate runs
 * the units as parallel sub-requests and merges them with `mergeUnits`.
 */
import SaxonJS from "npm:saxon-js@2.7.0";
import { XmllintModule, XMLLINT_WASM_GZ_B64 } from "./xmllint-vendor.generated.ts";
import { SCHEMATRON_ASSETS, XSD_BUNDLE } from "./assets.generated.ts";
import { isSetEnforced, parseSvrl, summarize, xsdFindings, type ValidationFinding, type ValidationResult } from "../validation.ts";

async function gunzipB64Bytes(b64: string): Promise<Uint8Array> {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
const gunzipB64 = async (b64: string) => new TextDecoder().decode(await gunzipB64Bytes(b64));

let wasmBinary: Uint8Array | null = null;
const sefCache = new Map<string, unknown>();
let xsdCache: { fileName: string; contents: string }[] | null = null;
type XsdError = { message: string; rawMessage: string; loc: { lineNumber: number } | null };

/** Runs `xmllint --schema <root> --noout record.xml` in-thread. */
async function runXsd(xml: string, dataset: "DEM" | "EMS"): Promise<XsdError[]> {
  wasmBinary ??= await gunzipB64Bytes(XMLLINT_WASM_GZ_B64);
  xsdCache ??= Object.entries(JSON.parse(await gunzipB64(XSD_BUNDLE)) as Record<string, string>)
    .map(([fileName, contents]) => ({ fileName, contents }));
  const root = `${dataset}DataSet_v3.xsd`;
  const stderr: number[] = [];
  const exitCode: number = await new Promise((resolve, reject) => {
    XmllintModule({
      inputFiles: [{ fileName: "record.xml", contents: xml }, ...xsdCache!],
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

/** Unit ids for a dataset: "xsd" plus one per Schematron file/part. */
export function validationUnits(dataset: "DEM" | "EMS"): string[] {
  return ["xsd", ...SCHEMATRON_ASSETS.filter((a) => a.dataset === dataset).map((a) => a.id)];
}

export function ruleSets(dataset: "DEM" | "EMS"): ValidationResult["rule_sets"] {
  const seen = new Map<string, ValidationResult["rule_sets"][number]>();
  for (const a of SCHEMATRON_ASSETS) if (a.dataset === dataset && !seen.has(a.set_id)) seen.set(a.set_id, { id: a.set_id, source: a.source, version: a.version, enforced: isSetEnforced(a.set_id, a.version) });
  return [...seen.values()];
}

export interface UnitResult { unit: string; ok: boolean; findings: ValidationFinding[]; error?: string }

/** Runs one unit. XML that is not well-formed is reported once, by the XSD unit. */
export async function runUnit(xml: string, dataset: "DEM" | "EMS", unit: string): Promise<UnitResult> {
  try {
    if (unit === "xsd") return { unit, ok: true, findings: xsdFindings(await runXsd(xml, dataset)) };
    const a = SCHEMATRON_ASSETS.find((x) => x.id === unit && x.dataset === dataset);
    if (!a) return { unit, ok: false, findings: [], error: `Unknown rule unit ${unit}` };
    let out;
    try {
      out = SaxonJS.transform({ stylesheetInternal: sefCache.get(a.id) ?? sefCache.set(a.id, JSON.parse(await gunzipB64(a.sef))).get(a.id), sourceText: xml, destination: "serialized" }, "sync");
    } catch (e) {
      // Parse failures of the record itself are already reported by the XSD unit.
      if (/SXXP0003|not well-formed|XML parsing/i.test(String(e))) return { unit, ok: true, findings: [] };
      throw e;
    }
    const enforced = isSetEnforced(a.set_id, a.version);
    const findings = parseSvrl(String(out.principalResult ?? ""), a.source);
    return { unit, ok: true, findings: enforced ? findings : findings.map((f) => ({ ...f, enforced: false })) };
  } catch (e) {
    return { unit, ok: false, findings: [], error: e instanceof Error ? e.message : String(e) };
  }
}

function unitEnforced(unit: string): boolean {
  const a = SCHEMATRON_ASSETS.find((x) => x.id === unit);
  return !a || isSetEnforced(a.set_id, a.version);
}

/** Merges unit results. A unit that failed to run is an ERROR, so nothing passes silently. */
export function mergeUnits(dataset: "DEM" | "EMS", results: UnitResult[]): ValidationResult {
  const findings = results.flatMap((r) => r.ok ? r.findings : [{
    level: "ERROR" as const, source: r.unit === "xsd" ? "XSD" : "Validation service",
    message: `Validation step "${r.unit}" could not complete: ${r.error ?? "unknown error"}. Finalization stays blocked until it runs.`,
    location: null, elements: [], rule_id: null,
    // A failed informational (state) unit is shown but cannot block; enforced units block.
    ...(unitEnforced(r.unit) ? {} : { enforced: false }),
  }]);
  return summarize(dataset, findings, ruleSets(dataset));
}

/** All units in one process — for tests/offline use (exceeds the edge CPU budget). */
export async function validateNemsisXml(xml: string, dataset: "DEM" | "EMS"): Promise<ValidationResult> {
  const results: UnitResult[] = [];
  for (const u of validationUnits(dataset)) results.push(await runUnit(xml, dataset, u));
  return mergeUnits(dataset, results);
}

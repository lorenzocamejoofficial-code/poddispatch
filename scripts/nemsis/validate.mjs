#!/usr/bin/env node
/**
 * NEMSIS 3.5.1 validation harness (dev/test only — not part of the app).
 *
 * Usage: node scripts/nemsis/validate.mjs <file.xml> [more.xml ...]
 *
 *  1. Detects root element (EMSDataSet | DEMDataSet) and picks the root XSD
 *     from tests/nemsis/xsd (3.5.1.251001CP2, fully offline).
 *  2. XSD validation via system `xmllint`.
 *  3. Schematron via SaxonJS (xslt3 npm) + ISO skeleton (XSLT2):
 *     .sch -> include -> abstract-expand -> svrl stylesheet -> run -> SVRL.
 *     Prints every failed-assert and successful-report (warnings).
 * Exit code 1 if any file fails XSD or has any Schematron error (warnings are printed but do not fail).
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const XSD_DIR = join(ROOT, "tests/nemsis/xsd");
const SCH_DIR = join(ROOT, "tests/nemsis/schematron");
const SKEL = join(SCH_DIR, "iso-skeleton");
const CACHE = "/tmp/nemsis-validate-cache";
const XSLT3 = join(ROOT, "node_modules/xslt3/xslt3.js");

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw r.error;
  return r;
}

function xslt(xsl, src, out, params = []) {
  const r = run(process.execPath, [XSLT3, `-xsl:${xsl}`, `-s:${src}`, `-o:${out}`, ...params]);
  if (r.status !== 0) throw new Error(`XSLT failed (${basename(xsl)}): ${r.stderr || r.stdout}`);
}

/** Compile a .sch into a runnable SVRL-producing XSLT (cached per dataset). */
function compileSchematron(dataset) {
  mkdirSync(CACHE, { recursive: true });
  const sch = join(SCH_DIR, `${dataset}.sch`);
  const s1 = join(CACHE, `${dataset}.1.sch`);
  const s2 = join(CACHE, `${dataset}.2.sch`);
  const out = join(CACHE, `${dataset}.svrl.xsl`);
  xslt(join(SKEL, "iso_dsdl_include.xsl"), sch, s1);
  xslt(join(SKEL, "iso_abstract_expand.xsl"), s1, s2);
  xslt(join(SKEL, "iso_svrl_for_xslt2.xsl"), s2, out);
  return out;
}

function rootElement(xml) {
  const body = xml.replace(/<\?[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  return body.match(/<\s*(?:[\w-]+:)?([\w-]+)/)?.[1] ?? null;
}

function parseSvrl(svrl) {
  const findings = [];
  const re = /<svrl:(failed-assert|successful-report)\b([^>]*)>([\s\S]*?)<\/svrl:\1>/g;
  let m;
  while ((m = re.exec(svrl))) {
    const attr = (n) => m[2].match(new RegExp(`${n}="([^"]*)"`))?.[1] ?? "";
    const text = (m[3].match(/<svrl:text>([\s\S]*?)<\/svrl:text>/)?.[1] ?? "")
      .replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    findings.push({ kind: m[1], role: attr("role") || "(none)", id: attr("id"), location: attr("location"), text });
  }
  return findings;
}

const compiled = {};
let anyFail = false;
const files = process.argv.slice(2);
if (!files.length) { console.error("usage: nemsis:validate <file.xml> [...]"); process.exit(2); }
if (!existsSync(XSLT3)) { console.error("xslt3 not installed (bun add -d xslt3)"); process.exit(2); }

for (const f of files) {
  const path = resolve(f);
  console.log(`\n=== ${basename(path)} ===`);
  const root = rootElement(readFileSync(path, "utf8"));
  if (root !== "EMSDataSet" && root !== "DEMDataSet") {
    console.log(`  FAIL: unsupported root element <${root}>`); anyFail = true; continue;
  }
  console.log(`  root: ${root}`);

  // XSD
  const x = run("xmllint", ["--noout", "--nonet", "--schema", join(XSD_DIR, `${root}_v3.xsd`), path]);
  const xsdOk = x.status === 0;
  console.log(`  XSD (${root}_v3.xsd): ${xsdOk ? "PASS" : "FAIL"}`);
  if (!xsdOk) { console.log((x.stderr || "").split("\n").map((l) => "    " + l).join("\n")); anyFail = true; }

  // Schematron
  compiled[root] ??= compileSchematron(root);
  const svrlOut = join(CACHE, `${basename(path)}.svrl.xml`);
  xslt(compiled[root], path, svrlOut);
  const findings = parseSvrl(readFileSync(svrlOut, "utf8"));
  const errors = findings.filter((x) => x.kind === "failed-assert" && !/warn/i.test(x.role));
  const warnings = findings.filter((x) => !errors.includes(x));
  console.log(`  Schematron (${root}.sch): ${errors.length} error(s), ${warnings.length} warning(s)`);
  for (const x of findings) {
    console.log(`    [${x.kind} role=${x.role}${x.id ? " id=" + x.id : ""}] ${x.text}\n      at ${x.location}`);
  }
  if (errors.length) anyFail = true;
  console.log(`  RESULT: ${xsdOk && !errors.length ? (warnings.length ? "PASS (with warnings)" : "PASS") : "FAIL"}`);
}
process.exit(anyFail ? 1 : 0);

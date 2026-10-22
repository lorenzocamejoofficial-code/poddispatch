#!/usr/bin/env bun
/** Lossless DEM-1 correction; original submission and EMS references stay untouched. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const values = new Map([
  ["P149752", "541368330183"], ["I325541", null], ["E014925", "384451433277"],
  ["P355418", "969467142250"], ["P480510", "495613765812"],
]);
const source = readFileSync(join(ROOT, "src/lib/nemsis/fixtures/dem1-submission.xml"), "utf8");
if (/<dCustomResults\b|\bCorrelationID=/.test(source)) throw new Error("Source already has custom results/correlation keys");
const seen = new Set();
const results = [];
const corrected = source.replace(/<dPersonnel\.PersonnelGroup\b[^>]*>[\s\S]*?<\/dPersonnel\.PersonnelGroup>/g, (group) => {
  const licenses = [...group.matchAll(/<dPersonnel\.23>([^<]*)<\/dPersonnel\.23>/g)].map((m) => m[1]);
  const matches = licenses.filter((license) => values.has(license));
  if (matches.length !== 1) throw new Error(`Expected one target GA license: ${licenses.join(", ")}`);
  const license = matches[0];
  if (seen.has(license)) throw new Error(`Duplicate target license ${license}`);
  seen.add(license);
  const id = `personnel-${license}`;
  const value = values.get(license);
  results.push([
    "      <dCustomResults.ResultsGroup>",
    value === null ? '        <dCustomResults.01 xsi:nil="true" NV="7701001"/>' : `        <dCustomResults.01>${value}</dCustomResults.01>`,
    "        <dCustomResults.02>dPersonnel.901</dCustomResults.02>",
    `        <dCustomResults.03>${id}</dCustomResults.03>`,
    "      </dCustomResults.ResultsGroup>",
  ].join("\n"));
  return group.replace(/^(<dPersonnel\.PersonnelGroup\b[^>]*)(>)/, `$1 CorrelationID="${id}"$2`);
});
if (seen.size !== values.size) throw new Error(`Expected ${values.size} personnel, found ${seen.size}`);
if ((corrected.match(/    <\/dFacility>/g) ?? []).length !== 1) throw new Error("Expected one final dFacility section");
const xml = corrected.replace("    </dFacility>", `    </dFacility>\n    <dCustomResults>\n${results.join("\n")}\n    </dCustomResults>`);
const out = join(ROOT, "tests/nemsis/reference/live/2026-DEM-1_v351.xml");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, xml);
console.log(`wrote ${out}`);
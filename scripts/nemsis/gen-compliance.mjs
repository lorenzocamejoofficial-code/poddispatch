#!/usr/bin/env bun
/**
 * Generate NEMSIS compliance files from dev fixtures via the real exporter.
 * Run with bun (imports TypeScript): bun scripts/nemsis/gen-compliance.mjs
 * Output: tests/nemsis/out/DEM-1.xml, tests/nemsis/out/EMS-1.xml … EMS-5.xml
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDemDataSet, buildEmsDataSet } from "../../src/lib/nemsis/exporter.ts";
import { DEM1_PROFILE } from "../../tests/nemsis/fixtures/dem1.ts";
import { EMS1_INPUT, EMS1_CTX } from "../../tests/nemsis/fixtures/ems1.ts";
import { EMS2_INPUT, EMS2_CTX } from "../../tests/nemsis/fixtures/ems2.ts";
import { EMS3_INPUT, EMS3_CTX } from "../../tests/nemsis/fixtures/ems3.ts";
import { EMS4_INPUT, EMS4_CTX } from "../../tests/nemsis/fixtures/ems4.ts";
import { EMS5_INPUT, EMS5_CTX } from "../../tests/nemsis/fixtures/ems5.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = join(ROOT, "tests/nemsis/out");
mkdirSync(OUT, { recursive: true });

/** NEMSIS dateTime with local offset, e.g. 2026-10-15T02:20:00-04:00 */
function nemsisNow(d = new Date()) {
  const p = (n) => String(Math.abs(n)).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` +
    `${sign}${p(Math.trunc(off / 60))}:${p(off % 60)}`;
}

const xml = buildDemDataSet({ ...DEM1_PROFILE, timeStamp: nemsisNow() });
const file = join(OUT, "DEM-1.xml");
writeFileSync(file, xml);
console.log(`wrote ${file} (${xml.length} bytes)`);

const EMS = [[EMS1_INPUT, EMS1_CTX], [EMS2_INPUT, EMS2_CTX], [EMS3_INPUT, EMS3_CTX], [EMS4_INPUT, EMS4_CTX], [EMS5_INPUT, EMS5_CTX]];
EMS.forEach(([input, ctx], i) => {
  const out = buildEmsDataSet(input, ctx);
  const f = join(OUT, `EMS-${i + 1}.xml`);
  writeFileSync(f, out);
  console.log(`wrote ${f} (${out.length} bytes)`);
});

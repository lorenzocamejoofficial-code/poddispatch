#!/usr/bin/env bun
/** Regenerate live EMS references from the corrected submission source of truth.
 * Corrections are already baked into source XML; NEVER insert them again.
 * Historical additions remain auditable in version history of this script.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = join(ROOT, "src/lib/nemsis/fixtures");
const OUT = join(ROOT, "tests/nemsis/reference/live");
const CASES = [
  ["ems1-submission.xml", "2026-EMS-1-Crash_v351.xml"],
  ["ems2-submission.xml", "2026-EMS-2-Stroke_v351.xml"],
  ["ems3-submission.xml", "2026-EMS-3-CHF_v351.xml"],
  ["ems4-submission.xml", "2026-EMS-4-Seizure_v351.xml"],
  ["ems5-submission.xml", "2026-EMS-5-Delirium_v351.xml"],
];
mkdirSync(OUT, { recursive: true });
for (const [source, output] of CASES) {
  const xml = readFileSync(join(SRC, source), "utf8");
  writeFileSync(join(OUT, output), xml);
  console.log(`copied corrected ${source} to ${output} (no insertions)`);
}

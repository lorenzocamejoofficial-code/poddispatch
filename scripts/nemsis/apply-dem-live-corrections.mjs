#!/usr/bin/env bun
/** Regenerate the live DEM reference from corrected submission XML, verbatim.
 * Personnel CorrelationIDs and dCustomResults are already present in source;
 * NEVER insert them again. Historical additions remain in version history.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = join(ROOT, "src/lib/nemsis/fixtures/dem1-submission.xml");
const out = join(ROOT, "tests/nemsis/reference/live/2026-DEM-1_v351.xml");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, readFileSync(source, "utf8"));
console.log(`copied corrected DEM submission to ${out} (no insertions)`);

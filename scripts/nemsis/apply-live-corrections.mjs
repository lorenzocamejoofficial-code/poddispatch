#!/usr/bin/env bun
/**
 * Build the 5 live-case EMS references (Crash, Stroke, CHF, Seizure, Delirium)
 * from the Oct-4 submission files plus the corrections NEMSIS flagged as missing.
 * Output: tests/nemsis/reference/live/*.xml. Fails loudly if any anchor is missing.
 * Run: bun scripts/nemsis/apply-live-corrections.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = join(ROOT, "src/lib/nemsis/fixtures");
const OUT = join(ROOT, "tests/nemsis/reference/live");
mkdirSync(OUT, { recursive: true });

/** Insert after the n-th (1-based; default last) line matching `re`, optionally
 *  only counting matches after the `scopeN`-th line matching `scope`. */
function insertAfter(lines, { re, n, scope, scopeN = 1 }, items) {
  let start = 0;
  if (scope) {
    let seen = 0;
    start = lines.findIndex((l) => scope.test(l) && ++seen === scopeN);
    if (start < 0) throw new Error(`scope not found: ${scope} #${scopeN}`);
  }
  const hits = [];
  for (let i = start; i < lines.length; i++) {
    if (scope && i > start && scope.test(lines[i])) break; // stay inside scope
    if (re.test(lines[i])) hits.push(i);
  }
  const idx = n ? hits[n - 1] : hits[hits.length - 1];
  if (idx === undefined) throw new Error(`anchor not found: ${re} (scope ${scope ?? "-"} #${scopeN})`);
  const indent = lines[idx].match(/^\s*/)[0];
  lines.splice(idx + 1, 0, ...items.map((s) => indent + s));
}

const leaf = (tag, v, attrs = "") => `<${tag}${attrs}>${v}</${tag}>`;
const many = (tag, vals) => vals.map((v) => leaf(tag, v));
const R = (tag) => new RegExp(`<${tag.replace(/\./g, "\\.")}[ >/]`);
const CREW = /<eCrew\.CrewGroup>/;

/** Add CorrelationIDs (first group c2, second c1) and the eCustomResults block. */
function crewCustom(lines, values /* [crew1, crew2]; null = nil */) {
  const ids = ["c2", "c1"];
  let k = 0;
  for (let i = 0; i < lines.length; i++) {
    if (CREW.test(lines[i])) lines[i] = lines[i].replace("<eCrew.CrewGroup>", `<eCrew.CrewGroup CorrelationID="${ids[k++]}">`);
  }
  if (k !== 2) throw new Error(`expected 2 crew groups, found ${k}`);
  const end = lines.findIndex((l) => /<\/eOutcome>/.test(l));
  if (end < 0) throw new Error("no </eOutcome>");
  const ind = lines[end].match(/^\s*/)[0];
  const block = [`${ind}<eCustomResults>`];
  values.forEach((v, i) => {
    block.push(`${ind}  <eCustomResults.ResultsGroup>`);
    block.push(v == null
      ? `${ind}    <eCustomResults.01 xsi:nil="true" NV="7701001"/>`
      : `${ind}    <eCustomResults.01>${v}</eCustomResults.01>`);
    block.push(`${ind}    <eCustomResults.02>eCrew.901</eCustomResults.02>`);
    block.push(`${ind}    <eCustomResults.03>${ids[i]}</eCustomResults.03>`);
    block.push(`${ind}  </eCustomResults.ResultsGroup>`);
  });
  block.push(`${ind}</eCustomResults>`);
  lines.splice(end + 1, 0, ...block);
}

const crewScope = (n) => ({ scope: CREW, scopeN: n });

const CASES = [
  {
    src: "ems1-submission.xml", out: "2026-EMS-1-Crash_v351.xml",
    apply(L) { insertAfter(L, { re: R("eArrest.03") }, many("eArrest.03", ["3003005"])); },
  },
  {
    src: "ems2-submission.xml", out: "2026-EMS-2-Stroke_v351.xml",
    apply(L) {
      insertAfter(L, { re: R("eResponse.24") }, many("eResponse.24", ["2224011", "2224019"]));
      insertAfter(L, { re: R("eCrew.03"), ...crewScope(1) }, many("eCrew.03", ["2403007"]));
      insertAfter(L, { re: R("ePatient.14") }, many("ePatient.14", ["2514011"]));
      insertAfter(L, { re: R("eSituation.10") }, many("eSituation.10", ["R41.0", "R53.1"]));
      insertAfter(L, { re: R("eHistory.08") }, many("eHistory.08", ["I10", "I49.01", "Z84.19"]));
      insertAfter(L, { re: R("eHistory.09") }, many("eHistory.09", ["3109005"]));
      insertAfter(L, { re: R("eExam.16") }, many("eExam.16", ["3516083"]));
      insertAfter(L, { re: R("eExam.20") }, [
        leaf("eExam.20", "3520009", ' PN="8801005"'), leaf("eExam.20", "3520011", ' PN="8801005"'),
        ...many("eExam.20", ["3520019", "3520029", "3520031", "3520041", "3520045", "3520053"]),
      ]);
      insertAfter(L, { re: R("eOutcome.13") }, many("eOutcome.13", ["I63.131", "I63.332", "I74.0"]));
      crewCustom(L, ["384451433277", "541368330183"]);
    },
  },
  {
    src: "ems3-submission.xml", out: "2026-EMS-3-CHF_v351.xml",
    apply(L) {
      insertAfter(L, { re: R("ePatient.14") }, many("ePatient.14", ["2514011"]));
      insertAfter(L, { re: R("eHistory.06") }, [leaf("eHistory.06", "Z88.7", ' CodeType="9924001"')]);
      insertAfter(L, { re: R("eHistory.08") }, many("eHistory.08", ["02HA4QZ", "02UW3LZ", "I10", "I50.22"]));
      insertAfter(L, { re: R("eExam.09") }, many("eExam.09", ["3509021"]));
      insertAfter(L, { re: R("eDisposition.26") }, many("eDisposition.26", ["4226007"]));
      crewCustom(L, ["969467142250", "495613765812"]);
    },
  },
  {
    src: "ems4-submission.xml", out: "2026-EMS-4-Seizure_v351.xml",
    apply(L) {
      insertAfter(L, { re: R("eCrew.03"), ...crewScope(1) }, many("eCrew.03", ["2403003", "2403007"]));
      insertAfter(L, { re: R("eCrew.03"), ...crewScope(2) }, many("eCrew.03", ["2403013"]));
      insertAfter(L, { re: R("ePatient.14") }, many("ePatient.14", ["2514013"]));
      insertAfter(L, { re: R("ePatient.24") }, many("ePatient.24", ["yid"]));
      insertAfter(L, { re: R("ePayment.59") }, [leaf("ePayment.59", "+14046564508", ' PhoneNumberType="9913001"')]);
      insertAfter(L, { re: R("ePayment.44") }, many("ePayment.44", ["B"]));
      insertAfter(L, { re: R("eSituation.10") }, many("eSituation.10", ["R06", "R40.20"]));
      insertAfter(L, { re: R("eExam.18") }, many("eExam.18", ["3518037"]));
      insertAfter(L, { re: R("eDisposition.14") }, many("eDisposition.14", ["4214021"]));
      insertAfter(L, { re: R("eDisposition.15") }, many("eDisposition.15", ["9909015"]));
      insertAfter(L, { re: R("eDisposition.20") }, many("eDisposition.20", ["4220017"]));
      crewCustom(L, [null, "541368330183"]);
    },
  },
  {
    src: "ems5-submission.xml", out: "2026-EMS-5-Delirium_v351.xml",
    apply(L) {
      insertAfter(L, { re: R("eCrew.03"), ...crewScope(1) }, many("eCrew.03", ["2403003", "2403007"]));
      insertAfter(L, { re: R("eCrew.03"), ...crewScope(2) }, many("eCrew.03", ["2403013"]));
      insertAfter(L, { re: R("ePatient.14") }, many("ePatient.14", ["2514011"]));
      insertAfter(L, { re: R("eSituation.10") }, many("eSituation.10", ["R46.2", "R50.9"]));
      insertAfter(L, { re: R("eHistory.01") }, many("eHistory.01", ["3101031"]));
      insertAfter(L, { re: R("eHistory.08") }, many("eHistory.08", ["Z87.440"]));
      const AG = /<eExam\.AssessmentGroup>/;
      insertAfter(L, { re: R("eExam.19"), scope: AG, scopeN: 1 }, many("eExam.19", ["3519023", "3519047"]));
      insertAfter(L, { re: R("eExam.19"), scope: AG, scopeN: 2 }, many("eExam.19", ["3519013"]));
      insertAfter(L, { re: R("eDisposition.18") }, many("eDisposition.18", ["4218015"]));
      const OG = /<eOther\.EMSCrewMemberGroup>/;
      insertAfter(L, { re: R("eOther.06"), scope: OG, scopeN: 1 }, many("eOther.06", ["4506033", "4506035"]));
      insertAfter(L, { re: R("eOther.06"), scope: OG, scopeN: 2 }, many("eOther.06", ["4506033", "4506035"]));
      insertAfter(L, { re: R("eOther.13") }, many("eOther.13", ["4513019"]));
      crewCustom(L, ["384451433277", "969467142250"]);
    },
  },
];

for (const c of CASES) {
  const L = readFileSync(join(SRC, c.src), "utf8").split("\n");
  c.apply(L);
  const f = join(OUT, c.out);
  writeFileSync(f, L.join("\n"));
  console.log(`wrote ${f}`);
}

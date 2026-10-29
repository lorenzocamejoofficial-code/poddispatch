import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { DEM1_SUBMISSION_XML } from "../../../supabase/functions/_shared/nemsis/fixtures/dem1-submission";
import { EMS1_SUBMISSION_XML } from "../../../supabase/functions/_shared/nemsis/fixtures/ems1-submission";
import { EMS2_SUBMISSION_XML } from "../../../supabase/functions/_shared/nemsis/fixtures/ems2-submission";
import { EMS3_SUBMISSION_XML } from "../../../supabase/functions/_shared/nemsis/fixtures/ems3-submission";
import { EMS4_SUBMISSION_XML } from "../../../supabase/functions/_shared/nemsis/fixtures/ems4-submission";
import { EMS5_SUBMISSION_XML } from "../../../supabase/functions/_shared/nemsis/fixtures/ems5-submission";

const cases = [
  ["dem1", "2026-DEM-1_v351.xml", DEM1_SUBMISSION_XML],
  ["ems1", "2026-EMS-1-Crash_v351.xml", EMS1_SUBMISSION_XML],
  ["ems2", "2026-EMS-2-Stroke_v351.xml", EMS2_SUBMISSION_XML],
  ["ems3", "2026-EMS-3-CHF_v351.xml", EMS3_SUBMISSION_XML],
  ["ems4", "2026-EMS-4-Seizure_v351.xml", EMS4_SUBMISSION_XML],
  ["ems5", "2026-EMS-5-Delirium_v351.xml", EMS5_SUBMISSION_XML],
] as const;
const parse = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");
const values = (parent: Document | Element, tag: string) =>
  Array.from(parent.getElementsByTagName(tag)).map((e) => e.textContent);

describe("corrected CTA fixture wiring", () => {
  for (const [key, name, payload] of cases) {
    it(`${key} edge constant and XML match the corrected reference byte-for-byte`, () => {
      const reference = readFileSync(`tests/nemsis/reference/live/${name}`, "utf8");
      expect(payload).toBe(reference);
      expect(readFileSync(`src/lib/nemsis/fixtures/${key}-submission.xml`, "utf8")).toBe(reference);
      expect(readFileSync(`supabase/functions/_shared/nemsis/fixtures/${key}-submission.xml`, "utf8")).toBe(reference);
    });
    it(`${key} retains original PodDispatch / PodDispatch / 1.0 identity`, () => {
      const doc = parse(payload);
      const tags = key === "dem1" ? ["dRecord.01", "dRecord.02", "dRecord.03"] : ["eRecord.02", "eRecord.03", "eRecord.04"];
      expect(tags.map((tag) => values(doc, tag))).toEqual([["PodDispatch"], ["PodDispatch"], ["1.0"]]);
    });
  }

  it("EMS1 retains all three arrest values in order", () => {
    // The corrected live Crash case carries three eArrest.03 values; the
    // pre-correction submission had only two.
    expect(values(parse(EMS1_SUBMISSION_XML), "eArrest.03")).toEqual(["3003001", "3003003", "3003005"]);
  });
  it("EMS2 retains all three response values and linked crew custom results", () => {
    const doc = parse(EMS2_SUBMISSION_XML);
    expect(values(doc, "eResponse.24")).toEqual(["2224005", "2224011", "2224019"]);
    expect(Array.from(doc.getElementsByTagName("eCrew.CrewGroup")).map((g) => g.getAttribute("CorrelationID"))).toEqual(["c2", "c1"]);
    expect(values(doc, "eCustomResults.02")).toEqual(["eCrew.901", "eCrew.901"]);
    expect(values(doc, "eCustomResults.03")).toEqual(["c2", "c1"]);
    expect(values(doc, "eCustomResults.01")).toEqual(["384451433277", "541368330183"]);
  });
  const ids = [
    ["P149752", "541368330183"], ["I325541", null], ["E014925", "384451433277"],
    ["P355418", "969467142250"], ["P480510", "495613765812"],
  ] as const;
  for (const [license, expected] of ids) {
    it(`DEM1 sends the linked ${license} National EMS ID`, () => {
      const doc = parse(DEM1_SUBMISSION_XML);
      const personnel = Array.from(doc.getElementsByTagName("dPersonnel.PersonnelGroup")).find((g) => values(g, "dPersonnel.23").includes(license));
      expect(personnel).toBeDefined();
      const key = personnel?.getAttribute("CorrelationID");
      expect(key).toBeTruthy();
      const results = Array.from(doc.getElementsByTagName("dCustomResults.ResultsGroup"));
      expect(results).toHaveLength(5);
      const linked = results.filter((g) => values(g, "dCustomResults.03")[0] === key);
      expect(linked).toHaveLength(1);
      expect(values(linked[0], "dCustomResults.02")).toEqual(["dPersonnel.901"]);
      const value = linked[0].getElementsByTagName("dCustomResults.01")[0];
      if (expected === null) {
        expect(value.getAttribute("xsi:nil")).toBe("true");
        expect(value.getAttribute("NV")).toBe("7701001");
      } else expect(value.textContent).toBe(expected);
    });
  }
  it("EMS5 does not reintroduce either corrected duplicate", () => {
    const groups = parse(EMS5_SUBMISSION_XML).getElementsByTagName("eExam.AssessmentGroup");
    expect(values(groups[0], "eExam.20")).toEqual(["3520021"]);
    expect(values(groups[0], "eExam.19")).toEqual(["3519001", "3519023", "3519047"]);
    expect(values(groups[1], "eExam.19")).toEqual(["3519011", "3519013"]);
  });
  it("running both former insertion scripts twice preserves all six references exactly", () => {
    for (let i = 0; i < 2; i++) {
      execFileSync("bun", ["scripts/nemsis/apply-live-corrections.mjs"]);
      execFileSync("bun", ["scripts/nemsis/apply-dem-live-corrections.mjs"]);
    }
    for (const [, name, payload] of cases) {
      expect(readFileSync(`tests/nemsis/reference/live/${name}`, "utf8")).toBe(payload);
    }
  });
});
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDemDataSet } from "./exporter";
import { DEM1_PROFILE } from "../../../tests/nemsis/fixtures/dem1";

const reference = DEM1_PROFILE.raw_reference ?? "";
const parse = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");
const elements = (doc: Document, tag: string) => Array.from(doc.getElementsByTagName(tag));

describe("DEM lossless compliance", () => {
  it("changes only software identity, leaving timestamps and all other bytes untouched", () => {
    const software = { creator: "Ignored", name: "Test & Vendor", version: "2.0" };
    const expected = reference.replace(/<dRecord\.0([123])>[^<]*<\/dRecord\.0\1>/g,
      (_match, digit: string) => `<dRecord.0${digit}>${digit === "3" ? "2.0" : "Test &amp; Vendor"}</dRecord.0${digit}>`);
    expect(buildDemDataSet({ ...DEM1_PROFILE, software, timeStamp: "ignored" })).toBe(expected);
  });

  for (const tag of ["dRecord.01", "dRecord.02", "dRecord.03"]) {
    it(`rejects missing ${tag}`, () => {
      const raw_reference = reference.replace(new RegExp(`<${tag.replace(".", "\\.")}>[^<]*</${tag.replace(".", "\\.")}>`), "");
      expect(() => buildDemDataSet({ ...DEM1_PROFILE, raw_reference })).toThrow("expected dRecord.01/.02/.03");
    });
  }

  const expectedIds = [
    ["P149752", "541368330183"], ["I325541", null], ["E014925", "384451433277"],
    ["P355418", "969467142250"], ["P480510", "495613765812"],
  ] as const;
  for (const [license, expected] of expectedIds) {
    it(`links ${license} to its exact National EMS ID`, () => {
      const doc = parse(buildDemDataSet(DEM1_PROFILE));
      const personnel = elements(doc, "dPersonnel.PersonnelGroup").filter((g) =>
        Array.from(g.getElementsByTagName("dPersonnel.23")).some((l) => l.textContent === license));
      expect(personnel).toHaveLength(1);
      const key = personnel[0]?.getAttribute("CorrelationID");
      expect(key).toBeTruthy();
      const results = elements(doc, "dCustomResults.ResultsGroup").filter((g) =>
        g.getElementsByTagName("dCustomResults.03")[0]?.textContent === key);
      expect(results).toHaveLength(1);
      expect(results[0]?.getElementsByTagName("dCustomResults.02")[0]?.textContent).toBe("dPersonnel.901");
      const value = results[0]?.getElementsByTagName("dCustomResults.01")[0];
      if (expected === null) {
        expect(value?.getAttribute("xsi:nil")).toBe("true");
        expect(value?.getAttribute("NV")).toBe("7701001");
      } else expect(value?.textContent).toBe(expected);
    });
  }

  it("matches the corrected submission source including both additive custom changes", () => {
    const submission = readFileSync("src/lib/nemsis/fixtures/dem1-submission.xml", "utf8");
    expect(reference).toBe(submission);
    expect(reference).not.toContain("<dCustomConfiguration");
    expect(elements(parse(reference), "dCustomResults.ResultsGroup")).toHaveLength(5);
  });

  it("keeps ordinary structured DEM callers working without raw_reference", () => {
    const xml = buildDemDataSet({ ...DEM1_PROFILE, raw_reference: undefined });
    expect(xml).toContain("<DEMDataSet");
    expect(xml).toContain("<dAgency.01>04568</dAgency.01>");
    expect(xml).not.toContain("dCustomResults");
  });
});
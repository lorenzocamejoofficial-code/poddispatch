import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { stampDemographicReportTimeStamp, extractCtaValidationErrors, parseTotalErrorCount, nemsisNow } from "../../../supabase/functions/_shared/nemsis/cta-soap";

const xml = readFileSync("src/lib/nemsis/fixtures/dem1-submission.xml", "utf8");

describe("DEM 1 submit", () => {
  it("only the timeStamp changes", () => {
    const ts = nemsisNow(new Date("2026-10-03T02:00:00Z"));
    expect(ts).toBe("2026-10-03T02:00:00+00:00");
    const out = stampDemographicReportTimeStamp(xml, ts);
    expect(out.replace(ts, "2026-01-15T08:00:00-05:00")).toBe(xml);
  });
  it("extracts schema and schematron errors", () => {
    const r = `<totalErrorCount>2</totalErrorCount><xmlError><desc>bad value</desc><lineNumber>12</lineNumber><xpath>/DEMDataSet/dAgency/dAgency.04</xpath></xmlError><svrl:failed-assert id="nemSch_x" role="[ERROR]" location="/DEMDataSet/dVehicle"><svrl:text>Vehicle missing</svrl:text></svrl:failed-assert>`;
    expect(parseTotalErrorCount(r)).toBe(2);
    const e = extractCtaValidationErrors(r);
    expect(e).toHaveLength(2);
    expect(e[0]).toMatchObject({ kind: "schema", path: "/DEMDataSet/dAgency/dAgency.04", line: 12, message: "bad value" });
    expect(e[1]).toMatchObject({ kind: "rule", path: "/DEMDataSet/dVehicle", rule: "nemSch_x", message: "Vehicle missing" });
  });
});

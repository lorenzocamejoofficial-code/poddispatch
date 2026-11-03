import { describe, expect, it } from "vitest";
import { decideFinalization, findingsKey, parseSvrl, roleToLevel, summarize, xsdFindings, type ValidationFinding } from "./validation";

const f = (level: "ERROR" | "WARNING", msg = "m"): ValidationFinding =>
  ({ level, source: "National", message: msg, location: null, elements: [], rule_id: msg });

describe("finalization gate", () => {
  it("an ERROR blocks finalization, even after acknowledgement", () => {
    const r = summarize("DEM", [f("ERROR"), f("WARNING")], []);
    expect(r.can_finalize).toBe(false);
    expect(decideFinalization(r, true)).toBe("block");
  });
  it("a WARNING is shown first, then allows finalization once acknowledged", () => {
    const r = summarize("EMS", [f("WARNING")], []);
    expect(r.can_finalize).toBe(true);
    expect(decideFinalization(r, false)).toBe("confirm_warnings");
    expect(decideFinalization(r, true)).toBe("proceed");
  });
  it("no findings finalizes immediately", () => {
    expect(decideFinalization(summarize("EMS", [], []), false)).toBe("proceed");
  });
  it("an acknowledgement covers only the exact warnings seen", () => {
    expect(findingsKey(summarize("EMS", [f("WARNING", "a")], []))).not.toBe(findingsKey(summarize("EMS", [f("WARNING", "b")], [])));
  });
});

describe("result parsing", () => {
  it("maps Schematron roles to levels; unknown roles count as errors", () => {
    expect(roleToLevel("[WARNING]")).toBe("WARNING");
    expect(roleToLevel("[ERROR]")).toBe("ERROR");
    expect(roleToLevel("[FATAL]")).toBe("ERROR");
    expect(roleToLevel(null)).toBe("ERROR");
  });
  it("parses SVRL into level, natural-language message and element location", () => {
    const svrl = `<svrl:failed-assert test="x" id="r1" role="[WARNING]" location="/*:EMSDataSet[namespace-uri()='http://www.nemsis.org'][1]/*:Header[namespace-uri()='http://www.nemsis.org'][1]/*:eVitals.VitalGroup[namespace-uri()='http://www.nemsis.org'][2]"><svrl:text>
      Advance Directives &amp; more should be recorded.</svrl:text></svrl:failed-assert>`;
    expect(parseSvrl(svrl, "Georgia")).toEqual([{
      level: "WARNING", source: "Georgia", message: "Advance Directives & more should be recorded.",
      location: "EMSDataSet/Header/eVitals.VitalGroup[2]", elements: [], rule_id: "r1",
    }]);
  });
  it("XSD errors are always ERROR with the element named", () => {
    const [x] = xsdFindings([{ message: "element eRecord.99: Schemas validity error : Element '{http://www.nemsis.org}eRecord.99': This element is not expected.", loc: { lineNumber: 11 } }]);
    expect(x.level).toBe("ERROR");
    expect(x.message).toBe("Element 'eRecord.99': This element is not expected.");
    expect(x.location).toBe("eRecord.99 (line 11)");
  });
});

// Certification EMS case records (parsed from EMS-1..5) rendered by the generated path,
// then run through the in-app engine: XSD + national + compliance + Georgia Schematron.
import { assertEquals } from "jsr:@std/assert@1";
import { validateNemsisXml } from "../_shared/nemsis/validation/engine.ts";
import { parseEmsXml, renderEmsDataSet } from "../_shared/nemsis/ems-tree.ts";
import { EMS1_SUBMISSION_XML } from "../_shared/nemsis/fixtures/ems1-submission.ts";
import { EMS2_SUBMISSION_XML } from "../_shared/nemsis/fixtures/ems2-submission.ts";
import { EMS3_SUBMISSION_XML } from "../_shared/nemsis/fixtures/ems3-submission.ts";
import { EMS4_SUBMISSION_XML } from "../_shared/nemsis/fixtures/ems4-submission.ts";
import { EMS5_SUBMISSION_XML } from "../_shared/nemsis/fixtures/ems5-submission.ts";

const SW = { creator: "PodDispatch", name: "PodDispatch", version: "1.0" };
const CASES = [EMS1_SUBMISSION_XML, EMS2_SUBMISSION_XML, EMS3_SUBMISSION_XML, EMS4_SUBMISSION_XML, EMS5_SUBMISSION_XML];

// Georgia-state errors present in the reference data itself (the stored records match the references exactly).
const GA_ERRORS: Record<number, string[]> = {
  1: [], 2: ["RestrictByDestinationCode"], 3: ["Rule_3659", "Rule_3659", "Rule_3659"], 4: ["RestrictByDestinationCode"], 5: [],
};

CASES.forEach((ref, i) => {
  const n = i + 1;
  Deno.test(`EMS-${n} from stored records: XSD valid, 0 national/compliance errors, gate follows Georgia errors`, async () => {
    const r = await validateNemsisXml(renderEmsDataSet(parseEmsXml(ref), { software: SW }), "EMS");
    console.log(`EMS-${n}`, JSON.stringify(r.findings.map((f) => [f.level, f.source, f.rule_id])));
    assertEquals(r.findings.filter((f) => f.source === "XSD").length, 0);
    assertEquals(r.findings.filter((f) => f.level === "ERROR" && f.source !== "Georgia").length, 0);
    assertEquals(r.findings.filter((f) => f.level === "ERROR").map((f) => f.rule_id), GA_ERRORS[n]);
    assertEquals(r.can_finalize, GA_ERRORS[n].length === 0);
  });
});

Deno.test("EMS error blocks: an invalid medication code on a stored case cannot finalize", async () => {
  const nodes = parseEmsXml(EMS2_SUBMISSION_XML).map((n) => n.values["eMedications.03"]
    ? { ...n, values: { ...n.values, "eMedications.03": [{ v: "999999999", attrs: { CodeType: "9924003" } }] } } : n);
  const r = await validateNemsisXml(renderEmsDataSet(nodes, { software: SW }), "EMS");
  console.log("mutated", r.error_count);
  assertEquals(r.can_finalize, false);
});

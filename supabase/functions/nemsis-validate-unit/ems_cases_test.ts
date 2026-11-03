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

CASES.forEach((ref, i) => {
  Deno.test(`EMS-${i + 1} from stored records: XSD valid, no Schematron errors → can finalize`, async () => {
    const r = await validateNemsisXml(renderEmsDataSet(parseEmsXml(ref), { software: SW }), "EMS");
    console.log(`EMS-${i + 1}`, JSON.stringify({ errors: r.error_count, warnings: r.findings.filter((f) => f.level === "WARNING").map((f) => [f.source, f.rule_id]) }));
    assertEquals(r.findings.filter((f) => f.source === "XSD").length, 0);
    assertEquals(r.error_count, 0);
    assertEquals(r.can_finalize, true);
  });
});

Deno.test("EMS error blocks: an invalid medication code on a stored case cannot finalize", async () => {
  const nodes = parseEmsXml(EMS2_SUBMISSION_XML).map((n) => n.values["eMedications.03"]
    ? { ...n, values: { ...n.values, "eMedications.03": [{ v: "999999999", attrs: { CodeType: "9924003" } }] } } : n);
  const r = await validateNemsisXml(renderEmsDataSet(nodes, { software: SW }), "EMS");
  console.log("mutated", r.error_count);
  assertEquals(r.can_finalize, false);
});

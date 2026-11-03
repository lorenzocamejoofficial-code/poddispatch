// Certification EMS case records (parsed from EMS-1..5) rendered by the generated path,
// then run through the in-app engine: XSD + national + compliance + Georgia Schematron.
import { assertEquals } from "jsr:@std/assert@1";
import { decideFinalization } from "../_shared/nemsis/validation.ts";
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
  Deno.test(`EMS-${n} from stored records: XSD valid, 0 national/compliance errors, Georgia shown as informational, case finalizes`, async () => {
    const r = await validateNemsisXml(renderEmsDataSet(parseEmsXml(ref), { software: SW }), "EMS");
    console.log(`EMS-${n}`, JSON.stringify(r.findings.map((f) => [f.level, f.source, f.rule_id])));
    assertEquals(r.findings.filter((f) => f.source === "XSD").length, 0);
    assertEquals(r.findings.filter((f) => f.level === "ERROR" && f.source !== "Georgia").length, 0);
    assertEquals(r.findings.filter((f) => f.level === "ERROR").map((f) => f.rule_id), GA_ERRORS[n]);
    const ga = r.findings.filter((f) => f.source === "Georgia");
    assertEquals(ga.length > 0, true); // Georgia ran and its findings are returned for display
    assertEquals(ga.every((f) => f.enforced === false), true);
    assertEquals(r.rule_sets.find((s) => s.id === "state-ga-ems")?.enforced, false);
    assertEquals(r.error_count, 0);
    assertEquals(r.can_finalize, true);
    assertEquals(decideFinalization(r, true), "proceed");
  });
});

Deno.test("EMS error blocks: an invalid medication code on a stored case cannot finalize", async () => {
  const nodes = parseEmsXml(EMS2_SUBMISSION_XML).map((n) => n.values["eMedications.03"]
    ? { ...n, values: { ...n.values, "eMedications.03": [{ v: "999999999", attrs: { CodeType: "9924003" } }] } } : n);
  const r = await validateNemsisXml(renderEmsDataSet(nodes, { software: SW }), "EMS");
  console.log("mutated", r.error_count);
  assertEquals(r.can_finalize, false);
});

Deno.test("State enforcement is configuration-driven: an enforced Georgia set would block EMS-2", async () => {
  const { isSetEnforced } = await import("../_shared/nemsis/validation.ts");
  const ga = { "state-ga-ems": { kind: "state" as const, state: "GA", enforcement: "auto" as const } };
  assertEquals(isSetEnforced("state-ga-ems", "3.5.0.251001CP6_GA260904", ga), false);
  assertEquals(isSetEnforced("state-ga-ems", "3.5.1.251001CP2_GA", ga), true);
  assertEquals(isSetEnforced("state-ga-ems", "3.5.0.x", { "state-ga-ems": { kind: "state", enforcement: "enforce" } }), true);
  assertEquals(isSetEnforced("national-ems", "3.5.1.251001CP2"), true);
});

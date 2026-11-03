// The four certification scenarios, run through the real engine (libxml2 XSD +
// SaxonJS Schematron, all configured national/Georgia/compliance files):
// DEM error blocks, DEM warning allows, EMS error blocks, EMS warning allows.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { validateNemsisXml } from "../_shared/nemsis/validation/engine.ts";
import { DEM1_SUBMISSION_XML } from "../_shared/nemsis/fixtures/dem1-submission.ts";
import { EMS5_SUBMISSION_XML } from "../_shared/nemsis/fixtures/ems5-submission.ts";

const ruleIds = (r: { findings: { rule_id: string | null }[] }) => r.findings.map((f) => f.rule_id);

// DEM with every agency contact phone typed as mobile clears the compliance ERROR,
// leaving only the vehicle-cost WARNING.
const DEM_WARNING_ONLY = DEM1_SUBMISSION_XML.replace(/(<dContact\.10 PhoneNumberType=")\d+(")/g, "$19913005$2");
// EMS-5 with an invalid RxNorm medication code breaks a national [ERROR] rule.
const EMS_WITH_ERROR = EMS5_SUBMISSION_XML.replace(/(<eMedications\.03 CodeType="9924003">)[^<]*/, "$1NOTACODE");

Deno.test("DEM error is shown and blocks finalization", async () => {
  const r = await validateNemsisXml(DEM1_SUBMISSION_XML, "DEM");
  assert(r.error_count > 0);
  assert(ruleIds(r).includes("compliance_contact_phone_assert"));
  const f = r.findings.find((x) => x.rule_id === "compliance_contact_phone_assert")!;
  assertEquals(f.level, "ERROR");
  assert(f.message.includes("mobile phone number"));
  assert(f.location?.includes("dContact"));
  assertEquals(r.can_finalize, false);
});

Deno.test("DEM warning is shown and allows finalization", async () => {
  const r = await validateNemsisXml(DEM_WARNING_ONLY, "DEM");
  assertEquals(r.error_count, 0);
  assert(r.warning_count > 0);
  assert(ruleIds(r).includes("compliance_ambulance_cost_assert"));
  assertEquals(r.can_finalize, true);
});

Deno.test("EMS error is shown and blocks finalization", async () => {
  const r = await validateNemsisXml(EMS_WITH_ERROR, "EMS");
  const err = r.findings.find((f) => f.level === "ERROR" && f.source === "National");
  assert(err, "expected a national Schematron ERROR");
  assert(err.message.length > 10);
  assertEquals(r.can_finalize, false);
});

Deno.test("EMS warning is shown and allows finalization", async () => {
  const r = await validateNemsisXml(EMS5_SUBMISSION_XML, "EMS");
  assertEquals(r.error_count, 0);
  assert(ruleIds(r).includes("compliance_directives_assert"));
  assertEquals(r.can_finalize, true);
});

Deno.test("national and Georgia rule files both run for EMS; XSD errors block", async () => {
  const r = await validateNemsisXml(EMS5_SUBMISSION_XML.replace("<eRecord.01>", "<eRecord.99>x</eRecord.99><eRecord.01>"), "EMS");
  assertEquals(r.rule_sets.map((s) => s.id).sort(), ["compliance-ems", "national-ems", "state-ga-ems"]);
  assert(r.findings.some((f) => f.source === "Georgia"));
  assert(r.findings.some((f) => f.source === "XSD" && f.level === "ERROR"));
  assertEquals(r.can_finalize, false);
});

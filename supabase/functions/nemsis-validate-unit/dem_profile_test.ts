// Agency NEMSIS Profile records (parsed from DEM-1) rendered by the generated path,
// then run through the in-app engine: XSD + national + compliance Schematron.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { validateNemsisXml } from "../_shared/nemsis/validation/engine.ts";
import { DEM1_SUBMISSION_XML } from "../_shared/nemsis/fixtures/dem1-submission.ts";
import { parseDemXml, renderDemDataSet } from "../_shared/nemsis/dem-tree.ts";

const SW = { creator: "PodDispatch", name: "PodDispatch", version: "1.0" };
const nodes = parseDemXml(DEM1_SUBMISSION_XML);

Deno.test("generated DEM from stored profile: XSD valid; only the 2026 mobile-contact rule errors", async () => {
  const r = await validateNemsisXml(renderDemDataSet(nodes, { software: SW }), "DEM");
  console.log(JSON.stringify(r.findings.map((f) => [f.level, f.source, f.rule_id])));
  assertEquals(r.findings.filter((f) => f.source === "XSD").length, 0);
  const errs = r.findings.filter((f) => f.level === "ERROR");
  assert(errs.length > 0 && errs.every((f) => f.rule_id === "compliance_contact_phone_assert"));
  assertEquals(r.can_finalize, false);
});

Deno.test("marking a phone Mobile on each contact clears the errors (warning only → can finalize)", async () => {
  const fixed = nodes.map((n) => n.tag === "dContact.ContactInfoGroup"
    ? { ...n, values: { ...n.values, "dContact.10": (n.values["dContact.10"] ?? []).map((p) => ({ ...p, attrs: { ...(p.attrs ?? {}), PhoneNumberType: "9913005" } })) } }
    : n);
  const r = await validateNemsisXml(renderDemDataSet(fixed, { software: SW }), "DEM");
  console.log(JSON.stringify(r.findings.map((f) => [f.level, f.source, f.rule_id])));
  assertEquals(r.error_count, 0);
  assertEquals(r.can_finalize, true);
});

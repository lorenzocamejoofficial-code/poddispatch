import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDemXml, renderDemDataSet } from "./dem-tree";
import { DEM_LISTS, NATIONAL_EMS_ID, findSpec, type DemFieldSpec, type DemNode } from "./dem-schema";
import { buildCertRecordXml, CertGuardError } from "./cert-records";

const REF = readFileSync(join(__dirname, "fixtures/dem1-submission.xml"), "utf8");
const SW = { creator: "PodDispatch", name: "PodDispatch", version: "1.0" };

/** Same normalization as scripts/nemsis/diff-reference.mjs: UUIDs, timestamp, dRecord, comments, whitespace. */
function normalize(xml: string): string {
  return xml
    .replace(/<\?[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s(xmlns(:\w+)?|xsi:schemaLocation)="[^"]*"/g, "")
    .replace(/UUID="[^"]*"/g, 'UUID=""').replace(/timeStamp="[^"]*"/g, 'timeStamp=""')
    .replace(/<dRecord>[\s\S]*?<\/dRecord>/, "")
    .replace(/<dCustomConfiguration>[\s\S]*?<\/dCustomConfiguration>/, "")
    .replace(/>\s+</g, "><").replace(/>\s+([^<\s])/g, ">$1").replace(/([^>\s])\s+</g, "$1<").trim();
}

describe("Agency NEMSIS Profile → DEMDataSet", () => {
  const nodes = parseDemXml(REF);
  const xml = renderDemDataSet(nodes, { software: SW, timeStamp: "2026-01-15T08:00:00-05:00" });

  it("entered DEM-1 records reproduce the DEM-1 reference", () => {
    expect(normalize(xml)).toBe(normalize(REF));
  });

  it("declares dPersonnel.901 in dCustomConfiguration and exports each National EMS ID", () => {
    expect(xml).toContain('<dCustomConfiguration.CustomGroup CustomElementID="dPersonnel.901">');
    expect(xml).toContain("<dCustomResults.01>541368330183</dCustomResults.01>");
    expect(xml).toContain("<dCustomResults.03>personnel-P149752</dCustomResults.03>");
    expect(xml.match(/<dCustomResults\.ResultsGroup>/g)).toHaveLength(5);
  });

  it("an edited National EMS ID appears in the export", () => {
    const edited = nodes.map((n) => n.correlation_id === "personnel-P149752"
      ? { ...n, values: { ...n.values, [NATIONAL_EMS_ID]: [{ v: "111122223333" }] } } : n);
    const out = renderDemDataSet(edited, { software: SW });
    expect(out).toContain("<dCustomResults.01>111122223333</dCustomResults.01>");
    expect(out).not.toContain("541368330183");
  });

  it("contact phone type uses the NEMSIS PhoneNumberType list, which includes Mobile", () => {
    const phone = findSpec("dContact.10") as DemFieldSpec;
    const attr = phone.attrs?.find((a) => a.name === "PhoneNumberType");
    expect(attr?.list).toBe("PhoneNumberType");
    expect(DEM_LISTS.PhoneNumberType.find(([c]) => c === "9913005")?.[1]).toBe("Mobile");
    const contact = nodes.find((n) => n.tag === "dContact.ContactInfoGroup")!;
    const marked = nodes.map((n) => n.id === contact.id
      ? { ...n, values: { ...n.values, "dContact.10": [{ v: "706-376-0010", attrs: { PhoneNumberType: "9913005" } }] } } : n);
    expect(renderDemDataSet(marked, { software: SW })).toContain('<dContact.10 PhoneNumberType="9913005">706-376-0010</dContact.10>');
  });

  it("orders fields by the XSD regardless of entry order", () => {
    const agency = nodes.find((n) => n.tag === "dAgency")!;
    const shuffled: DemNode[] = nodes.map((n) => n.id === agency.id
      ? { ...n, values: Object.fromEntries(Object.entries(n.values).reverse()) } : n);
    expect(normalize(renderDemDataSet(shuffled, { software: SW }))).toBe(normalize(REF));
  });

  it("cert records build from stored profile only on the certification company", () => {
    const cert = { id: "c1", is_sandbox: true, nemsis_certification: true };
    const rec = { id: "r1", company_id: "c1", kind: "DEM", case_key: "DEM1", payload: { dem_nodes: nodes } };
    const built = buildCertRecordXml(rec, cert, { timeStamp: "2026-01-15T08:00:00-05:00" });
    expect(normalize(built.xml)).toBe(normalize(REF));
    expect(() => buildCertRecordXml({ ...rec, company_id: "c2" }, { id: "c2", nemsis_certification: true }))
      .toThrow(CertGuardError);
  });
});

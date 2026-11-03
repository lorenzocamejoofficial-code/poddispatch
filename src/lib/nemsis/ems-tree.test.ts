import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { codesOutsideDemConfiguration, parseEmsXml, renderEmsDataSet } from "./ems-tree";
import { buildCertRecordXml, CertGuardError } from "./cert-records";
import { parseDemXml } from "./dem-tree";

const SW = { creator: "PodDispatch", name: "PodDispatch", version: "1.0" };
const ref = (i: number) => readFileSync(join(__dirname, `fixtures/ems${i}-submission.xml`), "utf8");

/** Ordered (path, sorted attrs, text) entries — same normalization as scripts/nemsis/diff-reference.mjs. */
function entries(xml: string): string[] {
  const src = xml.replace(/<\?[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  const out: string[] = [];
  const stack: { name: string; i: number; leaf: boolean }[] = [];
  const re = /<(\/?)([A-Za-z_][\w.:-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  let text = "";
  while ((m = re.exec(src))) {
    if (m[5] !== undefined) { text += m[5]; continue; }
    const [, close, name, raw, self] = m;
    if (close) {
      const top = stack.pop()!;
      if (top.leaf && top.i >= 0 && text.trim()) out[top.i] += ` = ${text.trim()}`;
      if (stack.length) stack[stack.length - 1].leaf = false;
      text = ""; continue;
    }
    if (stack.length) stack[stack.length - 1].leaf = false;
    text = "";
    const attrs = [...raw.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
      .filter(([, k]) => !k.startsWith("xmlns") && k !== "xsi:schemaLocation")
      .map(([, k, d, q]) => `${k}=${k === "UUID" ? "<uuid>" : (d ?? q).replace(/&quot;/g, '"')}`).sort();
    const path = [...stack.map((s) => s.name), name].join("/");
    const skip = /(^|\/)eRecord\.(SoftwareApplicationGroup|0[234])(\/|$)/.test(path);
    const i = skip ? -1 : out.push(`${path}${attrs.length ? ` [${attrs.join(" ")}]` : ""}`) - 1;
    if (!self) stack.push({ name, i, leaf: true });
  }
  return out;
}

describe("certification EMS cases → EMSDataSet", () => {
  for (const i of [1, 2, 3, 4, 5]) {
    it(`EMS-${i}: entered records reproduce the reference (0 differences)`, () => {
      const nodes = parseEmsXml(ref(i));
      const xml = renderEmsDataSet(nodes, { software: SW, declareCustomConfiguration: false });
      expect(entries(xml)).toEqual(entries(ref(i)));
    });
  }

  it("declares eCrew.901 in eCustomConfiguration and exports each crew member's National EMS ID", () => {
    const xml = renderEmsDataSet(parseEmsXml(ref(1)), { software: SW });
    expect(xml).toContain('<eCustomConfiguration.CustomGroup CustomElementID="eCrew.901">');
    expect(xml).toContain('<eCustomConfiguration.CustomGroup CustomElementID="eMedications.905">');
    expect(xml.indexOf("<eCustomConfiguration>")).toBeLessThan(xml.indexOf("<PatientCareReport"));
    expect(xml).toContain("<eCustomResults.01>541368330183</eCustomResults.01><eCustomResults.02>eCrew.901</eCustomResults.02><eCustomResults.03>c1</eCustomResults.03>");
  });

  it("an edited crew National EMS ID appears in the export", () => {
    const nodes = parseEmsXml(ref(2)).map((n) => n.tag === "eCrew.CrewGroup" && n.correlation_id === "c1"
      ? { ...n, values: { ...n.values, "eCrew.901": [{ v: "111122223333" }] } } : n);
    const xml = renderEmsDataSet(nodes, { software: SW });
    expect(xml).toContain("<eCustomResults.01>111122223333</eCustomResults.01><eCustomResults.02>eCrew.901</eCustomResults.02><eCustomResults.03>c1</eCustomResults.03>");
  });

  it("a newly entered crew member gets a fresh CorrelationID linking their National EMS ID", () => {
    const nodes = parseEmsXml(ref(2));
    const crewRoot = nodes.find((n) => n.tag === "eCrew")!;
    nodes.push({ id: "new", section: "eCrew", parent_id: crewRoot.id, tag: "eCrew.CrewGroup", position: 9, uuid: null, correlation_id: null,
      values: { "eCrew.01": [{ v: "P999999" }], "eCrew.901": [{ v: "123412341234" }] } });
    const xml = renderEmsDataSet(nodes, { software: SW });
    expect(xml).toContain('<eCrew.CrewGroup CorrelationID="c3"><eCrew.01>P999999</eCrew.01>');
    expect(xml).toContain("<eCustomResults.01>123412341234</eCustomResults.01><eCustomResults.02>eCrew.901</eCustomResults.02><eCustomResults.03>c3</eCustomResults.03>");
  });

  it("every procedure and medication in the five cases is offered by the DEM-1 configuration", () => {
    const dem = parseDemXml(readFileSync(join(__dirname, "fixtures/dem1-submission.xml"), "utf8"));
    for (const i of [1, 2, 3, 4, 5]) expect(codesOutsideDemConfiguration(parseEmsXml(ref(i)), dem)).toEqual([]);
  });

  it("cert records build EMS from stored case records only on the certification company", () => {
    const nodes = parseEmsXml(ref(3));
    const cert = { id: "c1", is_sandbox: true, nemsis_certification: true };
    const rec = { id: "r1", company_id: "c1", kind: "EMS", case_key: "EMS3", payload: { ems_nodes: nodes } };
    const built = buildCertRecordXml(rec, cert);
    expect(built.dataset).toBe("EMS");
    expect(entries(built.xml).filter((e) => !e.includes("eCustomConfiguration"))).toEqual(entries(ref(3)));
    expect(() => buildCertRecordXml(rec, { id: "c1", nemsis_certification: true })).toThrow(CertGuardError);
    expect(() => buildCertRecordXml({ ...rec, payload: { raw_reference: "<x/>" } }, cert)).toThrow(CertGuardError);
  });
});

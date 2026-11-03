/**
 * DEM node tree ⇄ DEMDataSet XML.
 *
 * renderDemDataSet: stored agency records → DEMDataSet XML, in XSD order from
 * the generated specs. The custom Crew Member National EMS ID (dPersonnel.901)
 * stored on each personnel record is exported as dCustomResults linked by the
 * personnel group's CorrelationID, and declared once in dCustomConfiguration.
 *
 * parseDemXml: DEMDataSet XML → node tree. Used by tests (round-trip proof) and
 * by the one-time seeding script; the app's screens edit the stored nodes.
 */
import { DEM_SECTIONS, NATIONAL_EMS_ID, findSpec, type DemFieldValue, type DemGroupSpec, type DemNode, type DemSpec } from "./dem-schema.ts";

export interface DemRenderOptions {
  software: { creator: string; name: string; version: string };
  timeStamp?: string;
  /** Emit the dCustomConfiguration declaration for dPersonnel.901 (default true). */
  declareCustomConfiguration?: boolean;
  uuid?: () => string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const unesc = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d))).replace(/&amp;/g, "&");

function defaultUuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function attrStr(attrs: [string, string][]): string {
  return attrs.map(([k, v]) => ` ${k}="${esc(v)}"`).join("");
}

function renderLeaf(tag: string, fv: DemFieldValue, attrOrder: string[]): string {
  const a: [string, string][] = [];
  for (const name of attrOrder) {
    const v = fv.attrs?.[name];
    if (v != null && v !== "") a.push([name, v]);
  }
  for (const [k, v] of Object.entries(fv.attrs ?? {})) {
    if (!attrOrder.includes(k) && v != null && v !== "") a.push([k, v]);
  }
  if (fv.nv) return `<${tag} xsi:nil="true" NV="${esc(fv.nv)}"${attrStr(a)}/>`;
  if (fv.pn) a.unshift(["PN", fv.pn]);
  if (fv.v == null || fv.v === "") {
    return fv.pn ? `<${tag} xsi:nil="true"${attrStr(a)}/>` : "";
  }
  return `<${tag}${attrStr(a)}>${esc(fv.v)}</${tag}>`;
}

export function childrenOf(nodes: DemNode[], parentId: string, tag?: string): DemNode[] {
  return nodes
    .filter((n) => n.parent_id === parentId && (tag == null || n.tag === tag))
    .sort((x, y) => x.position - y.position);
}

function renderGroupBody(spec: DemGroupSpec, node: DemNode, nodes: DemNode[], uuid: () => string): string {
  let out = "";
  for (const c of spec.children) {
    if (c.kind === "field") {
      if (c.custom) continue;
      const order = (c.attrs ?? []).map((x) => x.name);
      for (const fv of node.values?.[c.tag] ?? []) out += renderLeaf(c.tag, fv, order);
    } else {
      for (const child of childrenOf(nodes, node.id, c.tag)) {
        const a: [string, string][] = [];
        if (c.attrs.includes("UUID")) a.push(["UUID", child.uuid || uuid()]);
        if (c.attrs.includes("CorrelationID") && child.correlation_id) a.push(["CorrelationID", child.correlation_id]);
        const body = renderGroupBody(c, child, nodes, uuid);
        out += `<${c.tag}${attrStr(a)}>${body}</${c.tag}>`;
      }
    }
  }
  return out;
}

/** Correlation ID used to link a personnel record to its custom results. */
export function personnelCorrelationId(person: DemNode, nodes: DemNode[]): string {
  if (person.correlation_id) return person.correlation_id;
  const lic = childrenOf(nodes, person.id, "dPersonnel.LicensureGroup")[0];
  const n = lic?.values?.["dPersonnel.23"]?.[0]?.v;
  return n ? `personnel-${n}` : `personnel-${person.id.slice(0, 8)}`;
}

/** Fill in personnel CorrelationIDs needed for dCustomResults (pure; returns a copy). */
export function withPersonnelCorrelation(nodes: DemNode[]): DemNode[] {
  return nodes.map((n) =>
    n.tag === "dPersonnel.PersonnelGroup" && !n.correlation_id && (n.values?.[NATIONAL_EMS_ID]?.length ?? 0) > 0
      ? { ...n, correlation_id: personnelCorrelationId(n, nodes) }
      : n,
  );
}

export const NATIONAL_EMS_ID_DECLARATION =
  `<dCustomConfiguration><dCustomConfiguration.CustomGroup CustomElementID="${NATIONAL_EMS_ID}">` +
  `<dCustomConfiguration.01 nemsisElement="dPersonnel.PersonnelGroup">Crew Member National EMS ID</dCustomConfiguration.01>` +
  `<dCustomConfiguration.02>The National EMS ID assigned to the crew member.</dCustomConfiguration.02>` +
  `<dCustomConfiguration.03>9902009</dCustomConfiguration.03>` +
  `<dCustomConfiguration.04>9923001</dCustomConfiguration.04>` +
  `<dCustomConfiguration.05>9903007</dCustomConfiguration.05>` +
  `<dCustomConfiguration.07>7701001</dCustomConfiguration.07>` +
  `<dCustomConfiguration.07>7701003</dCustomConfiguration.07>` +
  `</dCustomConfiguration.CustomGroup></dCustomConfiguration>`;

export function renderDemDataSet(input: DemNode[], opts: DemRenderOptions): string {
  const uuid = opts.uuid ?? defaultUuid;
  const nodes = withPersonnelCorrelation(input);
  const sw = opts.software;
  let body =
    `<dRecord><dRecord.SoftwareApplicationGroup><dRecord.01>${esc(sw.creator)}</dRecord.01>` +
    `<dRecord.02>${esc(sw.name)}</dRecord.02><dRecord.03>${esc(sw.version)}</dRecord.03>` +
    `</dRecord.SoftwareApplicationGroup></dRecord>`;
  for (const spec of DEM_SECTIONS) {
    const root = nodes.find((n) => n.parent_id == null && n.tag === spec.tag);
    if (!root) continue;
    body += `<${spec.tag}>${renderGroupBody(spec, root, nodes, uuid)}</${spec.tag}>`;
  }
  // dCustomResults — National EMS ID per personnel record, in personnel order.
  const persRoot = nodes.find((n) => n.parent_id == null && n.tag === "dPersonnel");
  const results = persRoot
    ? childrenOf(nodes, persRoot.id, "dPersonnel.PersonnelGroup").flatMap((p) =>
        (p.values?.[NATIONAL_EMS_ID] ?? []).slice(0, 1).map((fv) =>
          `<dCustomResults.ResultsGroup>${renderLeaf("dCustomResults.01", fv, []) || `<dCustomResults.01 xsi:nil="true" NV="7701003"/>`}` +
          `<dCustomResults.02>${NATIONAL_EMS_ID}</dCustomResults.02>` +
          `<dCustomResults.03>${esc(p.correlation_id!)}</dCustomResults.03></dCustomResults.ResultsGroup>`,
        ),
      )
    : [];
  if (results.length) body += `<dCustomResults>${results.join("")}</dCustomResults>`;
  const declare = (opts.declareCustomConfiguration ?? true) && results.length > 0;
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<DEMDataSet xmlns="http://www.nemsis.org" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"` +
    ` xsi:schemaLocation="http://www.nemsis.org https://nemsis.org/media/nemsis_v3/3.5.1.251001CP2/XSDs/NEMSIS_XSDs/DEMDataSet_v3.xsd">` +
    (declare ? NATIONAL_EMS_ID_DECLARATION : "") +
    `<DemographicReport timeStamp="${esc(opts.timeStamp ?? new Date().toISOString().replace(/\.\d+Z$/, "+00:00"))}">${body}</DemographicReport></DEMDataSet>`;
}

/** Parse a DEMDataSet into nodes (ids from `newId`). Unknown elements throw. */
export function parseDemXml(xml: string, newId: () => string = defaultUuid): DemNode[] {
  const src = xml.replace(/<\?[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  const nodes: DemNode[] = [];
  const re = /<(\/?)([A-Za-z_][\w.:-]*)((?:\s+[\w:.-]+\s*=\s*"[^"]*")*)\s*(\/?)>|([^<]+)/g;
  type Frame = { tag: string; node?: DemNode; field?: { tag: string; fv: DemFieldValue; owner: DemNode }; custom?: Record<string, DemFieldValue> };
  const stack: Frame[] = [];
  const customs: Record<string, DemFieldValue>[] = [];
  const posCounter = new Map<string, number>();
  let text = "";
  let m: RegExpExecArray | null;
  const currentNode = () => [...stack].reverse().find((f) => f.node)?.node;
  while ((m = re.exec(src))) {
    if (m[5] !== undefined) { text += m[5]; continue; }
    const [, close, tag, rawAttrs, selfClose] = m;
    if (close) {
      const f = stack.pop();
      if (f?.field) {
        const t = unesc(text.trim());
        if (t !== "") f.field.fv.v = t;
        if (f.field.tag.startsWith("dCustomResults.")) {
          const cr = [...stack].reverse().find((x) => x.custom)!.custom!;
          cr[f.field.tag] = f.field.fv;
        } else {
          (f.field.owner.values[f.field.tag] ??= []).push(f.field.fv);
        }
      }
      text = "";
      continue;
    }
    text = "";
    const attrs = Object.fromEntries([...rawAttrs.matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)].map(([, k, v]) => [k, unesc(v)]));
    let frame: Frame = { tag };
    if (tag === "DEMDataSet" || tag === "DemographicReport" || tag.startsWith("dRecord") || tag.startsWith("dCustomConfiguration")) {
      // structural / software identity / declaration — regenerated on export
      frame = { tag };
      if (tag.startsWith("dRecord.0") || tag.startsWith("dCustomConfiguration.0")) frame = { tag };
    } else if (tag === "dCustomResults") {
      frame = { tag };
    } else if (tag === "dCustomResults.ResultsGroup") {
      const c: Record<string, DemFieldValue> = {};
      customs.push(c);
      frame = { tag, custom: c };
    } else if (tag.startsWith("dCustomResults.")) {
      frame = { tag, field: { tag, fv: leafValue(attrs), owner: null as unknown as DemNode } };
    } else {
      const spec: DemSpec | undefined = findSpec(tag);
      if (!spec) throw new Error(`DEM parse: element ${tag} is not in the DEM schema model`);
      const parent = currentNode();
      if (spec.kind === "group") {
        const key = `${parent?.id ?? "root"}:${tag}`;
        const position = posCounter.get(key) ?? 0;
        posCounter.set(key, position + 1);
        const node: DemNode = {
          id: newId(), section: parent?.section ?? tag, parent_id: parent?.id ?? null, tag, position,
          uuid: attrs.UUID ?? null, correlation_id: attrs.CorrelationID ?? null, values: {},
        };
        nodes.push(node);
        frame = { tag, node };
      } else {
        if (!parent) throw new Error(`DEM parse: field ${tag} outside a section`);
        frame = { tag, field: { tag, fv: leafValue(attrs), owner: parent } };
      }
    }
    if (selfClose) {
      if (frame.field) {
        if (tag.startsWith("dCustomResults.")) {
          [...stack].reverse().find((x) => x.custom)!.custom![tag] = frame.field.fv;
        } else (frame.field.owner.values[tag] ??= []).push(frame.field.fv);
      }
    } else stack.push(frame);
  }
  // Attach custom results to personnel by CorrelationID.
  for (const c of customs) {
    if (c["dCustomResults.02"]?.v !== NATIONAL_EMS_ID) throw new Error(`DEM parse: unsupported custom element ${c["dCustomResults.02"]?.v}`);
    const corr = c["dCustomResults.03"]?.v;
    const person = nodes.find((n) => n.tag === "dPersonnel.PersonnelGroup" && n.correlation_id === corr);
    if (!person) throw new Error(`DEM parse: no personnel record for ${corr}`);
    person.values[NATIONAL_EMS_ID] = [c["dCustomResults.01"] ?? { nv: "7701003" }];
  }
  return nodes;
}

function leafValue(attrs: Record<string, string>): DemFieldValue {
  const fv: DemFieldValue = {};
  const rest: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "xsi:nil") continue;
    if (k === "NV") fv.nv = v;
    else if (k === "PN") fv.pn = v;
    else rest[k] = v;
  }
  if (Object.keys(rest).length) fv.attrs = rest;
  return fv;
}

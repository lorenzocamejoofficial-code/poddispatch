/**
 * EMS node tree ⇄ EMSDataSet XML (certification EMS cases).
 *
 * Same model as the Agency NEMSIS Profile (dem-tree.ts): one root node per
 * PatientCareReport section (plus Header/DemographicGroup), one child node per
 * group instance, leaf values in `values`. Field order, labels and Defined Lists
 * come from scripts/nemsis/gen-ems-schema.py (ems-schema.generated.ts).
 *
 * Custom elements (eCrew.901 Crew Member National EMS ID, eMedications.905) are
 * stored on their group and exported as eCustomResults linked by the group's
 * CorrelationID, with matching eCustomConfiguration declarations.
 * eRecord.02–.04 (software identity) are stamped on export, never stored.
 */
import { EMS_DEFINED_LISTS, EMS_PCR_ORDER, EMS_SECTION_SPECS } from "./ems-schema.generated.ts";
import type { DemFieldSpec, DemFieldValue, DemGroupSpec, DemNode, DemSpec } from "./dem-schema.ts";

export const EMS_SECTIONS = EMS_SECTION_SPECS;
export const EMS_LISTS = EMS_DEFINED_LISTS;
export const CREW_NATIONAL_EMS_ID = "eCrew.901";
export const EMS_CASE_KEYS = ["EMS1", "EMS2", "EMS3", "EMS4", "EMS5"] as const;
export type EmsCaseKey = (typeof EMS_CASE_KEYS)[number];

export interface EmsRenderOptions {
  software: { creator: string; name: string; version: string };
  /** Emit eCustomConfiguration declarations for the custom elements used (default true). */
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

export function findEmsSpec(tag: string, specs: DemSpec[] = EMS_SECTIONS): DemSpec | undefined {
  for (const s of specs) {
    if (s.tag === tag) return s;
    if (s.kind === "group") {
      const r = findEmsSpec(tag, s.children);
      if (r) return r;
    }
  }
  return undefined;
}

/** Custom elements per owning group tag. */
export const EMS_CUSTOM_FIELDS: Record<string, DemFieldSpec[]> = (() => {
  const out: Record<string, DemFieldSpec[]> = {};
  const walk = (g: DemGroupSpec) => {
    for (const c of g.children) {
      if (c.kind === "group") walk(c);
      else if (c.custom) (out[g.tag] ??= []).push(c);
    }
  };
  EMS_SECTIONS.forEach(walk);
  return out;
})();

const CUSTOM_DECLARATIONS: Record<string, { group: string; title: string; def: string }> = {
  "eCrew.901": { group: "eCrew.CrewGroup", title: "Crew Member National EMS ID", def: "The National EMS ID assigned to the crew member." },
  "eMedications.905": { group: "eMedications.MedicationGroup", title: "Medication Custom Result", def: "Agency custom result recorded on the medication administration." },
};

function declaration(tag: string): string {
  const d = CUSTOM_DECLARATIONS[tag];
  return `<eCustomConfiguration.CustomGroup CustomElementID="${tag}">` +
    `<eCustomConfiguration.01 nemsisElement="${d.group}">${esc(d.title)}</eCustomConfiguration.01>` +
    `<eCustomConfiguration.02>${esc(d.def)}</eCustomConfiguration.02>` +
    `<eCustomConfiguration.03>9902009</eCustomConfiguration.03>` +
    `<eCustomConfiguration.04>9923001</eCustomConfiguration.04>` +
    `<eCustomConfiguration.05>9903007</eCustomConfiguration.05>` +
    `<eCustomConfiguration.07>7701001</eCustomConfiguration.07>` +
    `<eCustomConfiguration.07>7701003</eCustomConfiguration.07>` +
    `</eCustomConfiguration.CustomGroup>`;
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
  if (fv.v == null || fv.v === "") return fv.pn ? `<${tag} xsi:nil="true"${attrStr(a)}/>` : "";
  return `<${tag}${attrStr(a)}>${esc(fv.v)}</${tag}>`;
}

export function emsChildrenOf(nodes: DemNode[], parentId: string, tag?: string): DemNode[] {
  return nodes.filter((n) => n.parent_id === parentId && (tag == null || n.tag === tag)).sort((x, y) => x.position - y.position);
}

function renderGroupBody(spec: DemGroupSpec, node: DemNode, nodes: DemNode[], uuid: () => string, sw: EmsRenderOptions["software"]): string {
  let out = "";
  for (const c of spec.children) {
    if (c.kind === "field") {
      if (c.custom) continue;
      const order = (c.attrs ?? []).map((x) => x.name);
      for (const fv of node.values?.[c.tag] ?? []) out += renderLeaf(c.tag, fv, order);
    } else if (c.tag === "eRecord.SoftwareApplicationGroup") {
      out += `<eRecord.SoftwareApplicationGroup><eRecord.02>${esc(sw.creator)}</eRecord.02>` +
        `<eRecord.03>${esc(sw.name)}</eRecord.03><eRecord.04>${esc(sw.version)}</eRecord.04></eRecord.SoftwareApplicationGroup>`;
    } else {
      for (const child of emsChildrenOf(nodes, node.id, c.tag)) {
        const a: [string, string][] = [];
        if (c.attrs.includes("CorrelationID") && child.correlation_id) a.push(["CorrelationID", child.correlation_id]);
        if (c.attrs.includes("UUID") && child.uuid) a.push(["UUID", child.uuid]);
        out += `<${c.tag}${attrStr(a)}>${renderGroupBody(c, child, nodes, uuid, sw)}</${c.tag}>`;
      }
    }
  }
  return out;
}

/** Hidden per-node key keeping the eCustomResults position of a custom value (lossless round-trip). */
export const customOrderKey = (tag: string) => `${tag}#order`;

const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/** Give every group holding a custom value a CorrelationID (c1, c2, …) — pure. */
export function withEmsCorrelation(input: DemNode[]): DemNode[] {
  const used = new Set(input.map((n) => n.correlation_id).filter(Boolean) as string[]);
  let i = 1;
  return input.map((n) => {
    const customs = EMS_CUSTOM_FIELDS[n.tag];
    if (!customs || n.correlation_id || !customs.some((c) => (n.values?.[c.tag]?.length ?? 0) > 0)) return n;
    while (used.has(`c${i}`)) i++;
    used.add(`c${i}`);
    return { ...n, correlation_id: `c${i}` };
  });
}

export function renderEmsDataSet(input: DemNode[], opts: EmsRenderOptions): string {
  const uuid = opts.uuid ?? defaultUuid;
  const nodes = withEmsCorrelation(input);
  const root = (tag: string) => nodes.find((n) => n.parent_id == null && n.tag === tag);
  const specOf = (tag: string) => EMS_SECTIONS.find((s) => s.tag === tag)!;

  const results: { corr: string; tag: string; values: DemFieldValue[]; order: number }[] = [];
  for (const n of nodes) {
    for (const c of EMS_CUSTOM_FIELDS[n.tag] ?? []) {
      const vals = n.values?.[c.tag];
      const ord = Number(n.values?.[customOrderKey(c.tag)]?.[0]?.v);
      if (vals?.length && n.correlation_id) results.push({ corr: n.correlation_id, tag: c.tag, values: vals, order: Number.isFinite(ord) ? ord : Infinity });
    }
  }
  results.sort((a, b) => (a.order - b.order) || natural(a.corr, b.corr));

  let pcr = "";
  for (const tag of EMS_PCR_ORDER) {
    if (tag === "eCustomResults") {
      if (results.length) {
        pcr += `<eCustomResults>${results.map((r) =>
          `<eCustomResults.ResultsGroup>${r.values.map((fv) => renderLeaf("eCustomResults.01", fv, []) || `<eCustomResults.01 xsi:nil="true" NV="7701003"/>`).join("")}` +
          `<eCustomResults.02>${r.tag}</eCustomResults.02><eCustomResults.03>${esc(r.corr)}</eCustomResults.03></eCustomResults.ResultsGroup>`).join("")}</eCustomResults>`;
      }
      continue;
    }
    const r = root(tag);
    if (!r) continue;
    pcr += `<${tag}>${renderGroupBody(specOf(tag), r, nodes, uuid, opts.software)}</${tag}>`;
  }
  const demo = root("DemographicGroup");
  const used = [...new Set(results.map((r) => r.tag))];
  const declare = (opts.declareCustomConfiguration ?? true) && used.length > 0;
  const pcrUuid = root("eRecord")?.uuid || uuid();
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<EMSDataSet xmlns="http://www.nemsis.org" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"` +
    ` xsi:schemaLocation="http://www.nemsis.org https://nemsis.org/media/nemsis_v3/3.5.1.251001CP2/XSDs/NEMSIS_XSDs/EMSDataSet_v3.xsd">` +
    `<Header><DemographicGroup>${demo ? renderGroupBody(specOf("DemographicGroup"), demo, nodes, uuid, opts.software) : ""}</DemographicGroup>` +
    (declare ? `<eCustomConfiguration>${used.map(declaration).join("")}</eCustomConfiguration>` : "") +
    `<PatientCareReport UUID="${esc(pcrUuid)}">${pcr}</PatientCareReport></Header></EMSDataSet>`;
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

const SKIP = (tag: string) =>
  tag === "EMSDataSet" || tag === "Header" || tag === "PatientCareReport" ||
  tag.startsWith("eCustomConfiguration") || tag === "eCustomResults" ||
  tag === "eRecord.SoftwareApplicationGroup" || /^eRecord\.0[234]$/.test(tag);

/** Parse an EMSDataSet (one PatientCareReport) into nodes. Unknown elements throw. */
export function parseEmsXml(xml: string, newId: () => string = defaultUuid): DemNode[] {
  const src = xml.replace(/<\?[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  const nodes: DemNode[] = [];
  const re = /<(\/?)([A-Za-z_][\w.:-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  type Field = { tag: string; fv: DemFieldValue; owner: DemNode | null; custom?: Record<string, DemFieldValue[]> };
  type Frame = { tag: string; node?: DemNode; field?: Field; custom?: Record<string, DemFieldValue[]> };
  const stack: Frame[] = [];
  const customs: Record<string, DemFieldValue[]>[] = [];
  const pos = new Map<string, number>();
  let pcrUuid: string | null = null;
  let text = "";
  let m: RegExpExecArray | null;
  const currentNode = () => [...stack].reverse().find((f) => f.node)?.node;
  const commit = (f: Field) => {
    if (f.custom) (f.custom[f.tag] ??= []).push(f.fv);
    else (f.owner!.values[f.tag] ??= []).push(f.fv);
  };
  while ((m = re.exec(src))) {
    if (m[5] !== undefined) { text += m[5]; continue; }
    const [, close, tag, rawAttrs, selfClose] = m;
    if (close) {
      const f = stack.pop();
      if (f?.field) {
        const t = unesc(text.trim());
        if (t !== "") f.field.fv.v = t;
        commit(f.field);
      }
      text = "";
      continue;
    }
    text = "";
    const attrs = Object.fromEntries([...rawAttrs.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(([, k, d, q]) => [k, unesc(d ?? q)]));
    let frame: Frame = { tag };
    if (tag === "PatientCareReport") pcrUuid = attrs.UUID ?? null;
    if (tag === "eCustomResults.ResultsGroup") {
      const c: Record<string, DemFieldValue[]> = {};
      customs.push(c);
      frame = { tag, custom: c };
    } else if (tag.startsWith("eCustomResults.")) {
      const c = [...stack].reverse().find((x) => x.custom)!.custom!;
      frame = { tag, field: { tag, fv: leafValue(attrs), owner: null, custom: c } };
    } else if (!SKIP(tag)) {
      const spec = findEmsSpec(tag);
      if (!spec) throw new Error(`EMS parse: element ${tag} is not in the EMS schema model`);
      const parent = currentNode();
      if (spec.kind === "group") {
        const key = `${parent?.id ?? "root"}:${tag}`;
        const position = pos.get(key) ?? 0;
        pos.set(key, position + 1);
        const node: DemNode = {
          id: newId(), section: parent?.section ?? tag, parent_id: parent?.id ?? null, tag, position,
          uuid: attrs.UUID ?? null, correlation_id: attrs.CorrelationID ?? null, values: {},
        };
        nodes.push(node);
        frame = { tag, node };
      } else {
        if (!parent) throw new Error(`EMS parse: field ${tag} outside a section`);
        frame = { tag, field: { tag, fv: leafValue(attrs), owner: parent } };
      }
    }
    if (selfClose) { if (frame.field) commit(frame.field); } else stack.push(frame);
  }
  const rec = nodes.find((n) => n.parent_id == null && n.tag === "eRecord");
  if (rec && pcrUuid) rec.uuid = pcrUuid;
  customs.forEach((c, idx) => {
    const el = c["eCustomResults.02"]?.[0]?.v;
    const corr = c["eCustomResults.03"]?.[0]?.v;
    const owner = nodes.find((n) => n.correlation_id === corr && (EMS_CUSTOM_FIELDS[n.tag] ?? []).some((f) => f.tag === el));
    if (!el || !owner) throw new Error(`EMS parse: custom result ${el} has no group with CorrelationID ${corr}`);
    owner.values[el] = c["eCustomResults.01"] ?? [{ nv: "7701003" }];
    owner.values[customOrderKey(el)] = [{ v: String(idx) }];
  });
  return nodes;
}

/** Codes the agency configured in its DEM profile (dConfiguration.07 procedures, .09 medications). */
export function demConfiguredCodes(demNodes: DemNode[]): { procedures: string[]; medications: string[] } {
  const p = new Set<string>(), md = new Set<string>();
  for (const n of demNodes) {
    for (const fv of n.values?.["dConfiguration.07"] ?? []) if (fv.v) p.add(fv.v);
    for (const fv of n.values?.["dConfiguration.09"] ?? []) if (fv.v) md.add(fv.v);
  }
  return { procedures: [...p], medications: [...md] };
}

/** Procedures/medications on the EMS record that the DEM configuration does not offer. */
export function codesOutsideDemConfiguration(emsNodes: DemNode[], demNodes: DemNode[]): string[] {
  const { procedures, medications } = demConfiguredCodes(demNodes);
  const ps = new Set(procedures), ms = new Set(medications);
  const out: string[] = [];
  for (const n of emsNodes) {
    for (const fv of n.values?.["eProcedures.03"] ?? []) if (fv.v && !ps.has(fv.v)) out.push(`Procedure ${fv.v}`);
    for (const fv of n.values?.["eMedications.03"] ?? []) if (fv.v && !ms.has(fv.v)) out.push(`Medication ${fv.v}`);
  }
  return out;
}

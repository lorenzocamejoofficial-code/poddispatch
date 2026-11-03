#!/usr/bin/env python3
"""Generate src/lib/nemsis/ems-schema.generated.ts from the NEMSIS 3.5.1 EMS XSDs.

Mirror of gen-dem-schema.py for the EMSDataSet: element order, labels,
repetition, NV/PN options, attributes and every NEMSIS Defined List come from
the official XSDs. The field set is limited to elements that occur in the five
EMS certification fixtures (EMS-1..5) plus the custom elements eCrew.901 and
eMedications.905. Re-run after updating the XSDs or fixtures.
"""
import json, re, glob, os
from lxml import etree
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
XSD = os.path.join(ROOT, "tests/nemsis/xsd")
REFS = [os.path.join(ROOT, f"src/lib/nemsis/fixtures/ems{i}-submission.xml") for i in range(1, 6)]
NS = {"xs": "http://www.w3.org/2001/XMLSchema"}
present = set()
for r in REFS:
    present |= set(re.findall(r"<([A-Za-z][\w.]*)", re.sub(r"<!--.*?-->", "", open(r).read(), flags=re.S)))

docs = {os.path.basename(f): etree.parse(f) for f in glob.glob(os.path.join(XSD, "*.xsd"))}
simple, complex_ = {}, {}
for d in docs.values():
    for st in d.getroot().findall("xs:simpleType", NS): simple[st.get("name")] = st
    for ct in d.getroot().findall("xs:complexType", NS): complex_[ct.get("name")] = ct

lists = {}
def enum_of(tname):
    if not tname or tname.startswith("xs:"): return None
    st = simple.get(tname)
    if st is None: return None
    r = st.find("xs:restriction", NS)
    if r is None: return None
    en = r.findall("xs:enumeration", NS)
    if en:
        if tname not in lists:
            lists[tname] = [[e.get("value"), " ".join("".join(e.itertext()).split()) or e.get("value")] for e in en]
        return tname
    return enum_of(r.get("base"))

def facets(tname):
    st = simple.get(tname or "")
    out = {}
    if st is None: return out
    r = st.find("xs:restriction", NS)
    if r is None: return out
    for k in ("minLength","maxLength","pattern","minInclusive","maxInclusive"):
        e = r.find(f"xs:{k}", NS)
        if e is not None: out[k] = e.get("value")
    if not out and r.get("base") and not r.get("base").startswith("xs:"): return facets(r.get("base"))
    if r.get("base","").startswith("xs:"): out.setdefault("base", r.get("base")[3:])
    return out

def nv_options(attr):
    st = attr.find("xs:simpleType", NS)
    if st is None:
        k = enum_of(attr.get("type")); return lists.get(k, []) if k else []
    u = st.find("xs:union", NS)
    vals = []
    for m in (u.get("memberTypes","").split() if u is not None else []):
        k = enum_of(m)
        if k: vals += lists[k]
    return vals

def label(el):
    n = el.find(".//{*}nemsisTacDoc/{*}name")
    if n is not None and n.text: return n.text.strip()
    return el.get("name")

def seq_elements(node):
    """Direct element children of a compositor, flattening nested sequence/choice."""
    out = []
    for c in node:
        if not isinstance(c.tag, str): continue
        t = etree.QName(c).localname
        if t == "element": out.append(c)
        elif t in ("sequence", "choice", "all"): out += seq_elements(c)
    return out

def compositor(ct):
    for t in ("sequence", "choice", "all"):
        s = ct.find(f"xs:{t}", NS)
        if s is not None: return s
    return None

def element_spec(el):
    name = el.get("name")
    mx = el.get("maxOccurs", "1")
    spec = {"tag": name, "label": label(el), "repeat": mx == "unbounded" or int(mx) > 1, "min": int(el.get("minOccurs","1"))}
    ct = el.find("xs:complexType", NS)
    if ct is None and el.get("type") in complex_: ct = complex_[el.get("type")]
    seq = compositor(ct) if ct is not None else None
    if seq is not None:
        spec["kind"] = "group"
        spec["attrs"] = [a.get("name") for a in ct.findall("xs:attribute", NS)]
        spec["children"] = [element_spec(c) for c in seq_elements(seq) if c.get("name") in present]
        return spec
    spec["kind"] = "field"
    base = el.get("type"); attrs = []
    if ct is not None:
        ext = ct.find("xs:simpleContent/xs:extension", NS)
        if ext is None: ext = ct.find("xs:simpleContent/xs:restriction", NS)
        base = ext.get("base")
        for a in ext.findall("xs:attribute", NS):
            if a.get("name") == "NV": spec["nv"] = nv_options(a); continue
            if a.get("name") == "PN": spec["pn"] = nv_options(a); continue
            attrs.append({"name": a.get("name"), "list": enum_of(a.get("type")), "required": a.get("use") == "required"})
    spec["nillable"] = el.get("nillable") == "true"
    if attrs: spec["attrs"] = attrs
    lk = enum_of(base)
    if lk: spec["list"] = lk
    else: spec["facets"] = facets(base)
    return spec

root = docs["EMSDataSet_v3.xsd"].getroot()
def find_el(node, name):
    for e in node.iter("{http://www.w3.org/2001/XMLSchema}element"):
        if e.get("name") == name: return e
demog = find_el(root, "DemographicGroup")
pcr = find_el(root, "PatientCareReport")
order = [e.get("name") for e in seq_elements(compositor(pcr.find("xs:complexType", NS))) if e.get("name") in present]
sections = [dict(element_spec(demog), repeat=False, min=1)]
for name in order:
    if name == "eCustomResults": continue
    s = element_spec(find_el(pcr, name)); s["repeat"] = False; s["min"] = 1
    sections.append(s)

def find(spec, tag):
    if spec["tag"] == tag: return spec
    for c in spec.get("children", []):
        r = find(c, tag)
        if r: return r
NVS = lists.get("NV.NotApplicable", []) + lists.get("NV.NotRecorded", [])
CUSTOM = [
    ("eCrew", "eCrew.CrewGroup", {"tag": "eCrew.901", "label": "Crew Member National EMS ID", "facets": {"pattern": "[0-9]{12}"}}),
    ("eMedications", "eMedications.MedicationGroup", {"tag": "eMedications.905", "label": "Medication Custom Result (eMedications.905)", "facets": {}}),
]
for sec, grp, f in CUSTOM:
    g = find(next(s for s in sections if s["tag"] == sec), grp)
    g["children"].append({**f, "kind": "field", "repeat": False, "min": 0, "nillable": True, "custom": True, "nv": NVS})

out = ["// AUTO-GENERATED by scripts/nemsis/gen-ems-schema.py from the NEMSIS 3.5.1 XSDs. Do not edit.",
       "import type { DemGroupSpec } from \"./dem-schema\";",
       f"export const EMS_SECTION_SPECS: DemGroupSpec[] = {json.dumps(sections, ensure_ascii=False)} as DemGroupSpec[];",
       f"/** PatientCareReport child order (includes eCustomResults). */",
       f"export const EMS_PCR_ORDER: string[] = {json.dumps(order)};",
       f"export const EMS_DEFINED_LISTS: Record<string, [string, string][]> = {json.dumps(lists, ensure_ascii=False)} as Record<string, [string, string][]>;", ""]
open(os.path.join(ROOT, "src/lib/nemsis/ems-schema.generated.ts"), "w").write("\n".join(out))
print("sections", len(sections), [s["tag"] for s in sections], "lists", len(lists), "values", sum(len(v) for v in lists.values()))

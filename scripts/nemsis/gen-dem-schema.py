#!/usr/bin/env python3
"""Generate src/lib/nemsis/dem-schema.generated.ts from the NEMSIS 3.5.1 DEM XSDs.

Element order, labels, repetition, nillable/NV options, attributes and every
NEMSIS Defined List (xs:enumeration) come from the official XSDs. The field set
is limited to elements that occur in the DEM-1 reference (plus the
dPersonnel.901 custom element). Re-run after updating the XSDs or reference.
"""
import json, re, glob, os
from lxml import etree
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
XSD = os.path.join(ROOT, "tests/nemsis/xsd")
REF = os.path.join(ROOT, "src/lib/nemsis/fixtures/dem1-submission.xml")
NS = {"xs": "http://www.w3.org/2001/XMLSchema"}
SECTIONS = ["dAgency","dContact","dConfiguration","dLocation","dVehicle","dPersonnel","dDevice","dFacility"]
present = set(re.findall(r"<([A-Za-z][\w.]*)", re.sub(r"<!--.*?-->", "", open(REF).read(), flags=re.S)))

docs = {}
for f in glob.glob(os.path.join(XSD, "*.xsd")):
    docs[os.path.basename(f)] = etree.parse(f)
simple, complex_ = {}, {}
for d in docs.values():
    for st in d.getroot().findall("xs:simpleType", NS): simple[st.get("name")] = st
    for ct in d.getroot().findall("xs:complexType", NS): complex_[ct.get("name")] = ct

lists = {}
def enum_of(tname, seen=None):
    """Return list-key for a named simple type with enumerations, following restriction bases."""
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
    d = el.find("xs:annotation/xs:documentation", NS)
    return " ".join("".join(d.itertext()).split()) if d is not None else el.get("name")

def element_spec(el):
    name = el.get("name")
    mx = el.get("maxOccurs", "1")
    spec = {"tag": name, "label": label(el), "repeat": mx == "unbounded" or int(mx) > 1, "min": int(el.get("minOccurs","1"))}
    ct = el.find("xs:complexType", NS)
    seq = ct.find("xs:sequence", NS) if ct is not None else None
    if seq is not None:
        spec["kind"] = "group"
        spec["attrs"] = [a.get("name") for a in ct.findall("xs:attribute", NS)]
        spec["children"] = [element_spec(c) for c in seq.findall("xs:element", NS) if c.get("name") in present]
        return spec
    spec["kind"] = "field"
    base = el.get("type"); attrs = []
    if ct is not None:
        ext = ct.find("xs:simpleContent/xs:extension", NS)
        base = ext.get("base")
        for a in ext.findall("xs:attribute", NS):
            if a.get("name") == "NV": spec["nv"] = nv_options(a); continue
            if a.get("name") == "PN": spec["pn"] = nv_options(a); continue
            ak = enum_of(a.get("type"))
            attrs.append({"name": a.get("name"), "list": ak, "required": a.get("use") == "required"})
    spec["nillable"] = el.get("nillable") == "true"
    if attrs: spec["attrs"] = attrs
    lk = enum_of(base)
    if lk: spec["list"] = lk
    else: spec["facets"] = facets(base)
    return spec

sections = []
for s in SECTIONS:
    ct = complex_[s]
    seq = ct.find("xs:sequence", NS)
    sections.append({"tag": s, "label": s, "kind": "group", "repeat": False, "min": 1, "attrs": [],
                     "children": [element_spec(c) for c in seq.findall("xs:element", NS) if c.get("name") in present]})

# Custom element dPersonnel.901 (Crew Member National EMS ID) lives on the personnel group.
def find(spec, tag):
    if spec["tag"] == tag: return spec
    for c in spec.get("children", []):
        r = find(c, tag)
        if r: return r
pg = find(sections[SECTIONS.index("dPersonnel")], "dPersonnel.PersonnelGroup")
pg["children"].append({"tag": "dPersonnel.901", "label": "Crew Member National EMS ID", "kind": "field", "repeat": False,
    "min": 0, "nillable": True, "custom": True, "facets": {"pattern": "[0-9]{12}"},
    "nv": [v for v in lists["NV.NotApplicable"] + lists["NV.NotRecorded"]] if "NV.NotApplicable" in lists else []})

out = ["// AUTO-GENERATED by scripts/nemsis/gen-dem-schema.py from the NEMSIS 3.5.1 XSDs. Do not edit.",
       "import type { DemGroupSpec } from \"./dem-schema\";",
       f"export const DEM_SECTION_SPECS: DemGroupSpec[] = {json.dumps(sections, ensure_ascii=False)} as DemGroupSpec[];",
       f"export const DEM_DEFINED_LISTS: Record<string, [string, string][]> = {json.dumps(lists, ensure_ascii=False)} as Record<string, [string, string][]>;", ""]
open(os.path.join(ROOT, "src/lib/nemsis/dem-schema.generated.ts"), "w").write("\n".join(out))
print("sections", len(sections), "lists", len(lists), "values", sum(len(v) for v in lists.values()))

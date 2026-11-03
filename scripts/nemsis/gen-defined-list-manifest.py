#!/usr/bin/env python3
"""Verify and record NEMSIS Defined List completeness for the DEM/EMS entry screens.

For every coded field (element value, attribute, NV and PN) shown by the
Agency NEMSIS Profile and EMS case editors, compares the dropdown/checklist
options in dem-schema.generated.ts / ems-schema.generated.ts with the FULL
xs:enumeration set in the official NEMSIS 3.5.1 XSDs (following restriction
bases, unions and lists). Exits non-zero if any list is partial. Writes
src/lib/nemsis/defined-lists.manifest.json (source file, version, sha256, count,
elements). Re-run after regenerating either schema module or updating XSDs.
"""
import json, re, glob, os, sys, hashlib
from lxml import etree
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
X = os.path.join(ROOT, "tests/nemsis/xsd")
NS = {"xs": "http://www.w3.org/2001/XMLSchema"}
VERSION = "3.5.1.251001CP2"
simple, home, eltype, attrtype = {}, {}, {}, {}
sha = {}
for f in sorted(glob.glob(X + "/*.xsd")):
    b = os.path.basename(f); sha[b] = hashlib.sha256(open(f, "rb").read()).hexdigest()
    r = etree.parse(f).getroot()
    for st in r.findall("xs:simpleType", NS): simple[st.get("name")] = st; home[st.get("name")] = b
    for el in r.iter("{%s}element" % NS["xs"]):
        n, t = el.get("name"), el.get("type")
        ext = el.find("xs:complexType/xs:simpleContent/xs:extension", NS)
        if ext is None: ext = el.find("xs:complexType/xs:simpleContent/xs:restriction", NS)
        if ext is not None:
            t = ext.get("base")
            for a in ext.findall("xs:attribute", NS):
                st = a.find("xs:simpleType/xs:union", NS)
                attrtype[(n, a.get("name"))] = st.get("memberTypes", "").split() if st is not None else [a.get("type")]
        if n and t: eltype[n] = t

def full(t):
    st = simple.get(t or "")
    if st is None: return []
    r = st.find("xs:restriction", NS)
    if r is not None:
        en = r.findall("xs:enumeration", NS)
        return [e.get("value") for e in en] if en else full(r.get("base"))
    u = st.find("xs:union", NS)
    if u is not None:
        out = []
        for m in u.get("memberTypes", "").split(): out += full(m)
        for s in u.findall("xs:simpleType/xs:restriction", NS): out += [e.get("value") for e in s.findall("xs:enumeration", NS)]
        return out
    l = st.find("xs:list", NS)
    return full(l.get("itemType")) if l is not None else []

def load(p):
    s = open(os.path.join(ROOT, p)).read()
    specs = json.loads(re.search(r"SPECS: DemGroupSpec\[\] = (\[.*?\]) as DemGroupSpec", s, re.S).group(1))
    lists = json.loads(re.search(r"DEFINED_LISTS: Record<string, \[string, string\]\[\]> = (\{.*?\}) as Record", s, re.S).group(1))
    return specs, lists

def walk(sp):
    if sp.get("kind") == "field": yield sp
    for c in sp.get("children", []): yield from walk(c)

manifest, partial = {}, []
def record(ds, key, types, tag, have):
    want = [v for t in types for v in full(t)]
    if not want and not have: return
    missing = sorted(set(want) - set(have))
    if missing: partial.append({"dataset": ds, "element": tag, "list": key, "missing": len(missing), "examples": missing[:5]})
    src = sorted({home[t] for t in types if t in home})
    m = manifest.setdefault(key, {"list": key, "source": [f"tests/nemsis/xsd/{s}" for s in src],
        "source_sha256": {s: sha[s] for s in src}, "nemsis_version": VERSION,
        "official_count": len(set(want)), "interface_count": len(set(have)), "complete": not missing, "elements": [], "datasets": []})
    if tag not in m["elements"]: m["elements"].append(tag)
    if ds not in m["datasets"]: m["datasets"].append(ds)

for ds, p in [("DEM", "src/lib/nemsis/dem-schema.generated.ts"), ("EMS", "src/lib/nemsis/ems-schema.generated.ts")]:
    specs, lists = load(p)
    for s in specs:
        for f in walk(s):
            tag = f["tag"]
            if not f.get("custom"):
                t = eltype.get(tag)
                if t: record(ds, f.get("list") or t, [t], tag, [v for v, _ in lists.get(f.get("list"), [])])
            for a in f.get("attrs") or []:
                if isinstance(a, dict) and (tag, a["name"]) in attrtype:
                    types = attrtype[(tag, a["name"])]
                    record(ds, a.get("list") or "+".join(types), types, f"{tag}@{a['name']}", [v for v, _ in lists.get(a.get("list"), [])])
            for at, key in (("NV", "nv"), ("PN", "pn")):
                if f.get("custom"): continue
                if (tag, at) in attrtype:
                    types = attrtype[(tag, at)]
                    record(ds, f"{at}:" + "+".join(types), types, f"{tag}@{at}", [v for v, _ in f.get(key) or []])

out = {"nemsis_version": VERSION, "generated_by": "scripts/nemsis/gen-defined-list-manifest.py",
       "list_count": len(manifest), "value_count": sum(m["official_count"] for m in manifest.values()),
       "all_complete": not partial, "partial": partial, "lists": sorted(manifest.values(), key=lambda m: m["list"])}
json.dump(out, open(os.path.join(ROOT, "src/lib/nemsis/defined-lists.manifest.json"), "w"), indent=1, ensure_ascii=False)
print("lists", len(manifest), "values", out["value_count"], "partial", len(partial))
for p in partial: print(p)
sys.exit(1 if partial else 0)

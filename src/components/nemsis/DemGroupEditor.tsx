import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  NATIONAL_EMS_ID, listLabel, listOptions,
  type DemFieldSpec, type DemFieldValue, type DemGroupSpec, type DemNode,
} from "@/lib/nemsis/dem-schema";
import { childrenOf } from "@/lib/nemsis/dem-tree";

export interface DemEditorApi {
  nodes: DemNode[];
  setValues: (nodeId: string, tag: string, values: DemFieldValue[]) => void;
  addChild: (parent: DemNode, tag: string) => void;
  remove: (nodeId: string) => void;
  /** Defined lists to use (defaults to the DEM lists). */
  lists?: Record<string, [string, string][]>;
  /** Restricts a field's choices, e.g. EMS procedures/medications to the DEM configuration. */
  optionsFor?: (tag: string) => [string, string][] | undefined;
}

const NONE = "__none__";

/** "dContact.ContactInfoGroup" → "Contact Info Group" */
export function groupLabel(tag: string): string {
  const last = tag.split(".").pop() ?? tag;
  return last.replace(/^d(?=[A-Z])/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
}

function summary(spec: DemGroupSpec, node: DemNode, nodes: DemNode[], lists?: DemEditorApi["lists"]): string {
  if (node.tag === "dPersonnel.PersonnelGroup") {
    const name = childrenOf(nodes, node.id, "dPersonnel.NameGroup")[0];
    const last = name?.values["dPersonnel.01"]?.[0]?.v ?? "";
    const first = name?.values["dPersonnel.02"]?.[0]?.v ?? "";
    return [first, last].filter(Boolean).join(" ");
  }
  for (const c of spec.children) {
    if (c.kind !== "field") continue;
    const fv = node.values[c.tag]?.[0];
    if (fv?.v) return (lists ? lists[c.list ?? ""]?.find(([k]) => k === fv.v)?.[1] : listLabel(c.list, fv.v)) ?? fv.v;
  }
  return "";
}

function FieldEditor({ spec, values, onChange, api }: { spec: DemFieldSpec; values: DemFieldValue[]; onChange: (v: DemFieldValue[]) => void; api: DemEditorApi }) {
  const lookup = (key: string | null | undefined) => (api.lists ? (key ? api.lists[key] ?? [] : []) : listOptions(key));
  const restricted = api.optionsFor?.(spec.tag);
  const opts = restricted ?? lookup(spec.list);
  const attrs = (spec.attrs ?? []).filter((a) => a.name !== "CorrelationID");
  const hasNv = values.some((v) => v.nv);
  const [filter, setFilter] = useState("");
  const isCustom = !!spec.custom;
  const header = (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="text-sm font-medium">{spec.label}</span>
      <span className="text-xs text-muted-foreground">{spec.tag}</span>
      {isCustom && <Badge variant="secondary">Custom element · exported in {spec.tag.startsWith("e") ? "eCustomResults" : "dCustomResults"}</Badge>}
      {restricted && <Badge variant="outline">Choices from the agency DEM configuration</Badge>}
    </div>
  );

  // Repeating defined-list codes with no attributes → checklist.
  if (spec.repeat && opts.length && !attrs.length && !hasNv) {
    const chosen = values.map((v) => v.v ?? "");
    const set = new Set(chosen);
    const shown = opts.filter(([c, l]) => !filter || `${c} ${l}`.toLowerCase().includes(filter.toLowerCase()));
    return (
      <div className="space-y-1">
        {header}
        <div className="text-xs text-muted-foreground">{chosen.length} selected</div>
        {opts.length > 12 && <Input placeholder="Filter list" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-8" />}
        <div className="max-h-48 overflow-y-auto rounded border p-2 grid gap-1 sm:grid-cols-2">
          {shown.map(([c, l]) => (
            <label key={c} className="flex items-start gap-2 text-xs">
              <Checkbox
                checked={set.has(c)}
                onCheckedChange={(on) => onChange(on ? [...values, { v: c }] : values.filter((v) => v.v !== c))}
              />
              <span><span className="font-mono">{c}</span> {l}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }
  // Repeating free-text codes (e.g. SNOMED procedures) → one per line.
  if (spec.repeat && !opts.length && !attrs.length && !hasNv) {
    return (
      <div className="space-y-1">
        {header}
        <Textarea
          rows={Math.min(8, Math.max(2, values.length))}
          value={values.map((v) => v.v ?? "").join("\n")}
          placeholder="One value per line"
          onChange={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean).map((v) => ({ v })))}
          className="font-mono text-xs"
        />
        <div className="text-xs text-muted-foreground">{values.length} value(s)</div>
      </div>
    );
  }

  const rows = values.length ? values : [{}];
  const update = (i: number, next: DemFieldValue) => {
    const copy = rows.map((r) => ({ ...r }));
    copy[i] = next;
    onChange(copy.filter((r) => r.v || r.nv || r.pn));
  };
  return (
    <div className="space-y-1">
      {header}
      {rows.map((fv, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          {opts.length ? (
            <Select value={fv.v ?? NONE} disabled={!!fv.nv} onValueChange={(v) => update(i, { ...fv, v: v === NONE ? undefined : v })}>
              <SelectTrigger className="h-8 w-72"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {opts.map(([c, l]) => <SelectItem key={c} value={c}>{l} ({c})</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <Input
              className="h-8 w-72"
              value={fv.v ?? ""}
              disabled={!!fv.nv}
              inputMode={isCustom ? "numeric" : undefined}
              placeholder={spec.facets?.pattern ? `Format: ${spec.facets.pattern}` : undefined}
              onChange={(e) => update(i, { ...fv, v: e.target.value || undefined })}
            />
          )}
          {attrs.map((a) => {
            const aOpts = lookup(a.list);
            const cur = fv.attrs?.[a.name] ?? "";
            const setAttr = (val: string) => update(i, { ...fv, attrs: { ...(fv.attrs ?? {}), [a.name]: val } });
            return aOpts.length ? (
              <Select key={a.name} value={cur || NONE} onValueChange={(v) => setAttr(v === NONE ? "" : v)}>
                <SelectTrigger className="h-8 w-44"><SelectValue placeholder={a.name} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{a.name}: —</SelectItem>
                  {aOpts.map(([c, l]) => <SelectItem key={c} value={c}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input key={a.name} className="h-8 w-44" placeholder={a.name} value={cur} onChange={(e) => setAttr(e.target.value)} />
            );
          })}
          {!!spec.nv?.length && (
            <Select value={fv.nv ?? NONE} onValueChange={(v) => update(i, v === NONE ? { ...fv, nv: undefined } : { attrs: fv.attrs, nv: v })}>
              <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Not value" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Has a value</SelectItem>
                {spec.nv.map(([c, l]) => <SelectItem key={c} value={c}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {spec.repeat && values.length > 0 && (
            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Remove value"
              onClick={() => onChange(values.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      {spec.repeat && values.length > 0 && (
        <Button size="sm" variant="outline" className="h-7" onClick={() => onChange([...values, {}])}>
          <Plus className="h-3 w-3 mr-1" />Add another
        </Button>
      )}
    </div>
  );
}

export function DemGroupEditor({ spec, node, api, depth = 0 }: { spec: DemGroupSpec; node: DemNode; api: DemEditorApi; depth?: number }) {
  const nodes = api.nodes;
  return (
    <div className="space-y-4">
      {spec.children.map((c) => {
        if (c.kind === "field") {
          return (
            <FieldEditor key={c.tag} spec={c} values={node.values[c.tag] ?? []}
              onChange={(v) => api.setValues(node.id, c.tag, v)} api={api} />
          );
        }
        const kids = childrenOf(nodes, node.id, c.tag);
        return <ChildGroups key={c.tag} spec={c} parent={node} kids={kids} api={api} depth={depth} />;
      })}
    </div>
  );
}

function ChildGroups({ spec, parent, kids, api, depth }: { spec: DemGroupSpec; parent: DemNode; kids: DemNode[]; api: DemEditorApi; depth: number }) {
  const label = useMemo(() => groupLabel(spec.tag), [spec.tag]);
  return (
    <div className="space-y-2">
      {kids.map((k, i) => (
        <Card key={k.id} className={depth > 0 ? "border-dashed" : undefined}>
          <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">
              {label} {spec.repeat ? `#${i + 1}` : ""} <span className="font-normal text-muted-foreground">{summary(spec, k, api.nodes, api.lists)}</span>
              {(k.tag === "dPersonnel.PersonnelGroup" || k.tag === "eCrew.CrewGroup") && (() => {
                const idTag = k.tag === "eCrew.CrewGroup" ? "eCrew.901" : NATIONAL_EMS_ID;
                return (
                <span className="ml-2 font-normal text-xs">
                  National EMS ID: {k.values[idTag]?.[0]?.v ?? (k.values[idTag]?.[0]?.nv ? "Not applicable" : "—")}
                </span>
              )}
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => api.remove(k.id)} aria-label={`Remove ${label}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <DemGroupEditor spec={spec} node={k} api={api} depth={depth + 1} />
          </CardContent>
        </Card>
      ))}
      {(spec.repeat || kids.length === 0) && (
        <Button size="sm" variant="outline" onClick={() => api.addChild(parent, spec.tag)}>
          <Plus className="h-4 w-4 mr-1" />Add {label}
        </Button>
      )}
    </div>
  );
}

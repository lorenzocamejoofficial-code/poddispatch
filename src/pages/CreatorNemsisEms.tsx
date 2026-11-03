import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CreatorLayout } from "@/components/layout/CreatorLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { DemGroupEditor, type DemEditorApi } from "@/components/nemsis/DemGroupEditor";
import { NemsisValidationPanel } from "@/components/nemsis/NemsisValidationPanel";
import type { DemFieldValue, DemNode } from "@/lib/nemsis/dem-schema";
import {
  EMS_CASE_KEYS, EMS_LISTS, EMS_SECTIONS, codesOutsideDemConfiguration, demConfiguredCodes,
  parseEmsXml, renderEmsDataSet, withEmsCorrelation, type EmsCaseKey,
} from "@/lib/nemsis/ems-tree";
import { CERT_SOFTWARE, isCertificationCompany } from "@/lib/nemsis/cert-records";
import { EMS1_SUBMISSION_XML } from "@/lib/nemsis/fixtures/ems1-submission";
import { EMS2_SUBMISSION_XML } from "@/lib/nemsis/fixtures/ems2-submission";
import { EMS3_SUBMISSION_XML } from "@/lib/nemsis/fixtures/ems3-submission";
import { EMS4_SUBMISSION_XML } from "@/lib/nemsis/fixtures/ems4-submission";
import { EMS5_SUBMISSION_XML } from "@/lib/nemsis/fixtures/ems5-submission";
import type { ValidationResult } from "@/lib/nemsis/validation";

const CASES: Record<EmsCaseKey, { label: string; xml: string }> = {
  EMS1: { label: "EMS 1 — Crash", xml: EMS1_SUBMISSION_XML },
  EMS2: { label: "EMS 2 — Stroke", xml: EMS2_SUBMISSION_XML },
  EMS3: { label: "EMS 3 — CHF", xml: EMS3_SUBMISSION_XML },
  EMS4: { label: "EMS 4 — Seizure", xml: EMS4_SUBMISSION_XML },
  EMS5: { label: "EMS 5 — Delirium", xml: EMS5_SUBMISSION_XML },
};
const SECTION_LABEL = (tag: string) => (tag === "DemographicGroup" ? "Agency (header)" : tag);

type Company = { id: string; name: string; is_sandbox: boolean; creator_test_tenant: boolean; nemsis_certification: boolean; deleted_at: string | null };

function depthOf(n: DemNode, byId: Map<string, DemNode>): number {
  let d = 0;
  let cur = n;
  while (cur.parent_id && byId.get(cur.parent_id)) { d++; cur = byId.get(cur.parent_id)!; }
  return d;
}

async function invokeValidate(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("nemsis-validate", { body });
  let out = data as { result?: ValidationResult; finalized?: boolean; blocked?: boolean; error?: string } | null;
  if (error) {
    out = await (error as { context?: Response }).context?.json().catch(() => null);
    if (!out?.result) throw new Error(typeof out?.error === "string" ? out.error : error.message);
  }
  return out!;
}

export default function CreatorNemsisEms() {
  const [company, setCompany] = useState<Company | null>(null);
  const [caseKey, setCaseKey] = useState<EmsCaseKey>("EMS1");
  const [nodes, setNodes] = useState<DemNode[]>([]);
  const [demNodes, setDemNodes] = useState<DemNode[]>([]);
  const [saved, setSaved] = useState<Map<string, string>>(new Map());
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [finalizedAt, setFinalizedAt] = useState<string | null>(null);

  const load = useCallback(async (key: EmsCaseKey) => {
    setLoading(true);
    setValidation(null);
    const { data: cos, error: cErr } = await supabase
      .from("companies")
      .select("id, name, is_sandbox, creator_test_tenant, nemsis_certification, deleted_at")
      .eq("nemsis_certification", true).is("deleted_at", null).limit(2);
    if (cErr) toast.error(cErr.message);
    const c = (cos ?? []).find((x) => isCertificationCompany(x)) as Company | undefined;
    setCompany(c ?? null);
    if (c) {
      const [ems, dem, rec] = await Promise.all([
        supabase.from("nemsis_ems_nodes").select("id, section, parent_id, tag, position, uuid, correlation_id, values")
          .eq("company_id", c.id).eq("case_key", key).limit(5000),
        supabase.from("nemsis_dem_nodes").select("id, section, parent_id, tag, position, uuid, correlation_id, values")
          .eq("company_id", c.id).eq("section", "dConfiguration").limit(5000),
        supabase.from("nemsis_cert_records").select("finalized_at, last_validation")
          .eq("company_id", c.id).eq("case_key", key).maybeSingle(),
      ]);
      if (ems.error) toast.error(ems.error.message);
      if (dem.error) toast.error(dem.error.message);
      const asNodes = (rows: unknown[] | null) => (rows ?? []).map((r) => ({ ...(r as DemNode), values: ((r as DemNode).values ?? {}) })) as DemNode[];
      const list = asNodes(ems.data);
      setNodes(list);
      setDemNodes(asNodes(dem.data));
      setSaved(new Map(list.map((n) => [n.id, JSON.stringify(n)])));
      setRemoved(new Set());
      setFinalizedAt((rec.data?.finalized_at as string | null) ?? null);
      setValidation((rec.data?.last_validation as unknown as ValidationResult | null) ?? null);
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(caseKey); }, [load, caseKey]);

  const dirtyCount = useMemo(
    () => nodes.filter((n) => saved.get(n.id) !== JSON.stringify(n)).length + removed.size,
    [nodes, saved, removed],
  );

  const configured = useMemo(() => demConfiguredCodes(demNodes), [demNodes]);
  const outside = useMemo(() => codesOutsideDemConfiguration(nodes, demNodes), [nodes, demNodes]);

  const api: DemEditorApi = {
    nodes,
    lists: EMS_LISTS,
    optionsFor: (tag) => {
      if (tag === "eProcedures.03") return configured.procedures.map((c) => [c, c]);
      if (tag === "eMedications.03") return configured.medications.map((c) => [c, c]);
      return undefined;
    },
    setValues: (id, tag, values: DemFieldValue[]) =>
      setNodes((all) => all.map((n) => (n.id === id ? { ...n, values: { ...n.values, [tag]: values } } : n))),
    addChild: (parent, tag) =>
      setNodes((all) => {
        const position = all.filter((n) => n.parent_id === parent.id && n.tag === tag).reduce((m, n) => Math.max(m, n.position + 1), 0);
        return [...all, { id: crypto.randomUUID(), section: parent.section, parent_id: parent.id, tag, position, uuid: null, correlation_id: null, values: {} }];
      }),
    remove: (id) =>
      setNodes((all) => {
        const drop = new Set([id]);
        let grew = true;
        while (grew) { grew = false; for (const n of all) if (n.parent_id && drop.has(n.parent_id) && !drop.has(n.id)) { drop.add(n.id); grew = true; } }
        setRemoved((r) => { const next = new Set(r); for (const d of drop) if (saved.has(d)) next.add(d); return next; });
        return all.filter((n) => !drop.has(n.id));
      }),
  };

  const rootFor = (section: string) => nodes.find((n) => n.parent_id == null && n.tag === section);
  const ensureRoot = (section: string) =>
    setNodes((all) => all.some((n) => n.parent_id == null && n.tag === section) ? all
      : [...all, { id: crypto.randomUUID(), section, parent_id: null, tag: section, position: 0, uuid: section === "eRecord" ? crypto.randomUUID() : null, correlation_id: null, values: {} }]);

  const persist = async (list: DemNode[], gone: Set<string>, snap: Map<string, string>) => {
    if (!company) return;
    if (gone.size) {
      const { error } = await supabase.from("nemsis_ems_nodes").delete().in("id", [...gone]).eq("company_id", company.id).eq("case_key", caseKey);
      if (error) throw error;
    }
    const byId = new Map(list.map((n) => [n.id, n]));
    const changed = list.filter((n) => snap.get(n.id) !== JSON.stringify(n));
    const maxDepth = Math.max(0, ...changed.map((n) => depthOf(n, byId)));
    for (let d = 0; d <= maxDepth; d++) {
      const rows = changed.filter((n) => depthOf(n, byId) === d).map((n) => ({
        id: n.id, company_id: company.id, case_key: caseKey, section: n.section, parent_id: n.parent_id, tag: n.tag,
        position: n.position, uuid: n.uuid, correlation_id: n.correlation_id, values: n.values as unknown as Json,
      }));
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from("nemsis_ems_nodes").upsert(rows.slice(i, i + 500));
        if (error) throw error;
      }
    }
  };

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); }
  };

  const save = () => run("save", async () => {
    await persist(withEmsCorrelation(nodes), removed, saved);
    toast.success(`${CASES[caseKey].label} saved.`);
    await load(caseKey);
  });

  const loadStartingData = () => run("seed", async () => {
    const parsed = parseEmsXml(CASES[caseKey].xml);
    await persist(parsed, new Set(), new Map());
    toast.success(`Loaded ${parsed.length} ${caseKey} records. Edit them to match the reviewer's data.`);
    await load(caseKey);
  });

  /** Copies the saved case into its certification record. Returns the record id. */
  const writeRecord = async (): Promise<string> => {
    if (!company) throw new Error("No certification company");
    if (dirtyCount) throw new Error("Save your changes first.");
    const payload = { ems_nodes: withEmsCorrelation(nodes), software: { ...CERT_SOFTWARE } } as unknown as Json;
    const { data: existing } = await supabase.from("nemsis_cert_records").select("id")
      .eq("company_id", company.id).eq("case_key", caseKey).maybeSingle();
    if (existing?.id) {
      const { error } = await supabase.from("nemsis_cert_records").update({ payload, finalized_at: null, finalized_by: null }).eq("id", existing.id);
      if (error) throw error;
      return existing.id as string;
    }
    const { data, error } = await supabase.from("nemsis_cert_records")
      .insert({ company_id: company.id, kind: "EMS", case_key: caseKey, label: CASES[caseKey].label, payload })
      .select("id").single();
    if (error) throw error;
    return data.id as string;
  };

  const validate = () => run("validate", async () => {
    const id = await writeRecord();
    const out = await invokeValidate({ action: "validate_record", record_id: id });
    setValidation(out.result ?? null);
    setFinalizedAt(null);
    toast.success("Validated.");
  });

  const finalize = () => run("finalize", async () => {
    const id = await writeRecord();
    const out = await invokeValidate({ action: "finalize_record", record_id: id });
    setValidation(out.result ?? null);
    if (out.finalized) { setFinalizedAt(new Date().toISOString()); toast.success(`${CASES[caseKey].label} finalized.`); }
    else toast.error("Not finalized — fix the errors shown below.");
  });

  const downloadXml = () => {
    const blob = new Blob([renderEmsDataSet(nodes, { software: { ...CERT_SOFTWARE } })], { type: "application/xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${caseKey}.xml`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const warnings = validation?.warning_count ?? 0;

  return (
    <CreatorLayout title="NEMSIS EMS Cases">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Certification EMS cases</CardTitle>
            <CardDescription>
              Patient care records for the NEMSIS certification company only — real crews and ePCRs are unaffected. The EMSDataSet
              sent to the CTA is generated from these records. <Link to="/creator-nemsis-agency" className="underline">Agency NEMSIS Profile</Link> ·{" "}
              <Link to="/creator-nemsis-cta" className="underline">NEMSIS CTA</Link>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {EMS_CASE_KEYS.map((k) => (
                <Button key={k} size="sm" variant={k === caseKey ? "default" : "outline"} disabled={!!busy || (dirtyCount > 0 && k !== caseKey)}
                  onClick={() => setCaseKey(k)}>{CASES[k].label}</Button>
              ))}
              {dirtyCount > 0 && <span className="text-xs text-muted-foreground self-center">Save before switching cases</span>}
            </div>
            {loading ? <span className="text-sm text-muted-foreground">Loading…</span> : company ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{company.name}</Badge>
                <Badge variant="outline">Test / sandbox · certification</Badge>
                {finalizedAt && <Badge>Finalized</Badge>}
                <span className="text-sm text-muted-foreground">{nodes.length} records{dirtyCount ? ` · ${dirtyCount} unsaved` : ""}</span>
                <div className="ml-auto flex flex-wrap gap-2">
                  {nodes.length === 0 && (
                    <Button variant="outline" disabled={!!busy} onClick={loadStartingData}>
                      {busy === "seed" ? "Loading…" : `Load ${caseKey.replace("EMS", "EMS-")} starting data`}
                    </Button>
                  )}
                  <Button variant="outline" disabled={!nodes.length} onClick={downloadXml}>Download EMS XML</Button>
                  <Button disabled={!dirtyCount || !!busy} onClick={save}>{busy === "save" ? "Saving…" : "Save changes"}</Button>
                  <Button variant="secondary" disabled={!nodes.length || !!busy || dirtyCount > 0} onClick={validate}>
                    {busy === "validate" ? "Validating…" : "Validate"}
                  </Button>
                  <Button disabled={!nodes.length || !!busy || dirtyCount > 0 || !validation?.can_finalize} onClick={finalize}>
                    {busy === "finalize" ? "Finalizing…" : warnings ? "Finalize with warnings" : "Finalize"}
                  </Button>
                </div>
              </div>
            ) : (
              <span className="text-sm text-destructive">No NEMSIS certification company found.</span>
            )}
            {company && !configured.procedures.length && !configured.medications.length && (
              <p className="text-xs text-muted-foreground">Load the Agency NEMSIS Profile first — procedure and medication choices come from its configuration.</p>
            )}
            {outside.length > 0 && (
              <div className="rounded border border-[hsl(var(--status-yellow))]/40 bg-[hsl(var(--status-yellow-bg))] p-2 text-xs text-[hsl(var(--status-yellow))]">
                Not offered by the agency DEM configuration: {outside.slice(0, 8).join(", ")}{outside.length > 8 ? ` +${outside.length - 8} more` : ""}
              </div>
            )}
          </CardContent>
        </Card>

        {validation && <NemsisValidationPanel result={validation} title={`${caseKey} validation`} />}

        {company && (
          <Tabs key={caseKey} defaultValue="eRecord" onValueChange={ensureRoot}>
            <TabsList className="flex flex-wrap h-auto">
              {EMS_SECTIONS.map((s) => <TabsTrigger key={s.tag} value={s.tag}>{SECTION_LABEL(s.tag)}</TabsTrigger>)}
            </TabsList>
            {EMS_SECTIONS.map((s) => {
              const root = rootFor(s.tag);
              return (
                <TabsContent key={s.tag} value={s.tag}>
                  <Card>
                    <CardHeader><CardTitle className="text-base">{SECTION_LABEL(s.tag)}</CardTitle></CardHeader>
                    <CardContent>
                      {root ? <DemGroupEditor spec={s} node={root} api={api} />
                        : <Button variant="outline" onClick={() => ensureRoot(s.tag)}>Start {s.tag}</Button>}
                    </CardContent>
                  </Card>
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </div>
    </CreatorLayout>
  );
}

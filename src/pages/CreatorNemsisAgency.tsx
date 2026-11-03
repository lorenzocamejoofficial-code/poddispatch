import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CreatorLayout } from "@/components/layout/CreatorLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { DemGroupEditor, type DemEditorApi } from "@/components/nemsis/DemGroupEditor";
import { NemsisValidationPanel } from "@/components/nemsis/NemsisValidationPanel";
import { DEM_SECTIONS, DEM_SECTION_LABELS, type DemFieldValue, type DemNode } from "@/lib/nemsis/dem-schema";
import { parseDemXml, withPersonnelCorrelation } from "@/lib/nemsis/dem-tree";
import { buildDemDataSet } from "@/lib/nemsis/exporter";
import { CERT_SOFTWARE, isCertificationCompany } from "@/lib/nemsis/cert-records";
import { DEM1_SUBMISSION_XML } from "@/lib/nemsis/fixtures/dem1-submission";
import type { ValidationResult } from "@/lib/nemsis/validation";

const DEM_CASE_KEY = "DEM1";
type Company = { id: string; name: string; is_sandbox: boolean; creator_test_tenant: boolean; nemsis_certification: boolean; deleted_at: string | null };

function depthOf(n: DemNode, byId: Map<string, DemNode>): number {
  let d = 0;
  let cur = n;
  while (cur.parent_id && byId.get(cur.parent_id)) { d++; cur = byId.get(cur.parent_id)!; }
  return d;
}

export default function CreatorNemsisAgency() {
  const [company, setCompany] = useState<Company | null>(null);
  const [nodes, setNodes] = useState<DemNode[]>([]);
  const [saved, setSaved] = useState<Map<string, string>>(new Map()); // id → JSON snapshot
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmUpdate, setConfirmUpdate] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: cos, error: cErr } = await supabase
      .from("companies")
      .select("id, name, is_sandbox, creator_test_tenant, nemsis_certification, deleted_at")
      .eq("nemsis_certification", true).is("deleted_at", null).limit(2);
    if (cErr) toast.error(cErr.message);
    const c = (cos ?? []).find((x) => isCertificationCompany(x)) as Company | undefined;
    setCompany(c ?? null);
    if (c) {
      const { data, error } = await supabase.from("nemsis_dem_nodes")
        .select("id, section, parent_id, tag, position, uuid, correlation_id, values")
        .eq("company_id", c.id).limit(5000);
      if (error) toast.error(error.message);
      const list = (data ?? []).map((r) => ({ ...r, values: (r.values ?? {}) as unknown as DemNode["values"] })) as DemNode[];
      setNodes(list);
      setSaved(new Map(list.map((n) => [n.id, JSON.stringify(n)])));
      setRemoved(new Set());
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const dirtyCount = useMemo(
    () => nodes.filter((n) => saved.get(n.id) !== JSON.stringify(n)).length + removed.size,
    [nodes, saved, removed],
  );

  const api: DemEditorApi = {
    nodes,
    setValues: (id, tag, values: DemFieldValue[]) =>
      setNodes((all) => all.map((n) => (n.id === id ? { ...n, values: { ...n.values, [tag]: values } } : n))),
    addChild: (parent, tag) =>
      setNodes((all) => {
        const position = all.filter((n) => n.parent_id === parent.id && n.tag === tag).reduce((m, n) => Math.max(m, n.position + 1), 0);
        return [...all, { id: crypto.randomUUID(), section: parent.section, parent_id: parent.id, tag, position, uuid: crypto.randomUUID(), correlation_id: null, values: {} }];
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
      : [...all, { id: crypto.randomUUID(), section, parent_id: null, tag: section, position: 0, uuid: null, correlation_id: null, values: {} }]);

  /** Persist: deletions, then inserts/updates parents-first. */
  const persist = async (list: DemNode[], gone: Set<string>, snap: Map<string, string>) => {
    if (!company) return;
    if (gone.size) {
      const { error } = await supabase.from("nemsis_dem_nodes").delete().in("id", [...gone]).eq("company_id", company.id);
      if (error) throw error;
    }
    const byId = new Map(list.map((n) => [n.id, n]));
    const changed = list.filter((n) => snap.get(n.id) !== JSON.stringify(n));
    const maxDepth = Math.max(0, ...changed.map((n) => depthOf(n, byId)));
    for (let d = 0; d <= maxDepth; d++) {
      const rows = changed.filter((n) => depthOf(n, byId) === d).map((n) => ({
        id: n.id, company_id: company.id, section: n.section, parent_id: n.parent_id, tag: n.tag,
        position: n.position, uuid: n.uuid, correlation_id: n.correlation_id, values: n.values as unknown as Json,
      }));
      if (!rows.length) continue;
      const { error } = await supabase.from("nemsis_dem_nodes").upsert(rows);
      if (error) throw error;
    }
  };

  const save = async () => {
    setBusy("save");
    try {
      await persist(nodes, removed, saved);
      toast.success("Agency NEMSIS profile saved.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally { setBusy(null); }
  };

  const loadStartingData = async () => {
    setBusy("seed");
    try {
      const parsed = parseDemXml(DEM1_SUBMISSION_XML);
      await persist(parsed, new Set(), new Map());
      toast.success(`Loaded ${parsed.length} DEM-1 records. Edit them to match the reviewer's data.`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally { setBusy(null); }
  };

  const currentXml = () => buildDemDataSet({
    dem_nodes: nodes, software: { ...CERT_SOFTWARE }, agency: undefined as never, configurations: [],
  });

  const downloadXml = () => {
    const blob = new Blob([currentXml()], { type: "application/xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "DEM-agency-profile.xml";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /** Writes the stored profile into the DEM certification record, then validates it. */
  const buildRecord = async () => {
    if (!company) return;
    setBusy("record");
    try {
      if (dirtyCount) throw new Error("Save your changes first.");
      const payload = { dem_nodes: withPersonnelCorrelation(nodes), software: { ...CERT_SOFTWARE } } as unknown as Json;
      const { data: existing } = await supabase.from("nemsis_cert_records").select("id")
        .eq("company_id", company.id).eq("case_key", DEM_CASE_KEY).maybeSingle();
      let id = existing?.id as string | undefined;
      if (id) {
        const { error } = await supabase.from("nemsis_cert_records").update({ payload }).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("nemsis_cert_records")
          .insert({ company_id: company.id, kind: "DEM", case_key: DEM_CASE_KEY, label: "DEM 1 — Agency NEMSIS Profile", payload })
          .select("id").single();
        if (error) throw error;
        id = data.id;
      }
      const { data, error } = await supabase.functions.invoke("nemsis-validate", { body: { action: "validate_record", record_id: id } });
      let result = (data as { result?: ValidationResult } | null)?.result;
      if (error) {
        const ctx = await (error as { context?: Response }).context?.json().catch(() => null);
        result = ctx?.result;
        if (!result) throw new Error(typeof ctx?.error === "string" ? ctx.error : error.message);
      }
      setValidation(result ?? null);
      toast.success("DEM certification record updated and validated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally { setBusy(null); setConfirmUpdate(false); }
  };

  return (
    <CreatorLayout title="Agency NEMSIS Profile">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Agency NEMSIS Profile (DEM)</CardTitle>
            <CardDescription>
              Demographic data for the NEMSIS certification company only. The DEMDataSet sent to the CTA is generated from
              these records. <Link to="/creator-nemsis-cta" className="underline">NEMSIS CTA</Link>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            {loading ? <span className="text-sm text-muted-foreground">Loading…</span> : company ? (
              <>
                <Badge variant="secondary">{company.name}</Badge>
                <Badge variant="outline">Test / sandbox · certification</Badge>
                <span className="text-sm text-muted-foreground">{nodes.length} records{dirtyCount ? ` · ${dirtyCount} unsaved` : ""}</span>
                <div className="ml-auto flex flex-wrap gap-2">
                  {nodes.length === 0 && (
                    <Button variant="outline" disabled={!!busy} onClick={loadStartingData}>Load DEM-1 starting data</Button>
                  )}
                  <Button variant="outline" disabled={!nodes.length} onClick={downloadXml}>Download DEM XML</Button>
                  <Button disabled={!dirtyCount || !!busy} onClick={save}>{busy === "save" ? "Saving…" : "Save changes"}</Button>
                  <Button variant="secondary" disabled={!nodes.length || !!busy || dirtyCount > 0} onClick={() => setConfirmUpdate(true)}>
                    {busy === "record" ? "Validating…" : "Update DEM record & validate"}
                  </Button>
                </div>
              </>
            ) : (
              <span className="text-sm text-destructive">No NEMSIS certification company found.</span>
            )}
          </CardContent>
        </Card>

        {validation && <NemsisValidationPanel result={validation} title="DEM validation" />}

        {company && (
          <Tabs defaultValue="dAgency" onValueChange={ensureRoot}>
            <TabsList className="flex flex-wrap h-auto">
              {DEM_SECTIONS.map((s) => <TabsTrigger key={s.tag} value={s.tag}>{DEM_SECTION_LABELS[s.tag] ?? s.tag}</TabsTrigger>)}
            </TabsList>
            {DEM_SECTIONS.map((s) => {
              const root = rootFor(s.tag);
              return (
                <TabsContent key={s.tag} value={s.tag}>
                  <Card>
                    <CardHeader><CardTitle className="text-base">{DEM_SECTION_LABELS[s.tag]} <span className="text-xs text-muted-foreground font-normal">{s.tag}</span></CardTitle></CardHeader>
                    <CardContent>
                      {root ? <DemGroupEditor spec={s} node={root} api={api} />
                        : <Button variant="outline" onClick={() => ensureRoot(s.tag)}>Start {DEM_SECTION_LABELS[s.tag]}</Button>}
                    </CardContent>
                  </Card>
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </div>

      <AlertDialog open={confirmUpdate} onOpenChange={setConfirmUpdate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update the DEM certification record?</AlertDialogTitle>
            <AlertDialogDescription>
              This copies the saved profile into the DEM 1 certification record and validates it. If the record already exists,
              changing it queues the automatic DEM resend to the CTA testing environment (the Stage 1 rule for national DEM edits).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); buildRecord(); }}>Update & validate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CreatorLayout>
  );
}

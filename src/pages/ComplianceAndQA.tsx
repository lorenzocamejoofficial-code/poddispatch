import { useEffect, useState, useCallback } from "react";
import { PageLoader } from "@/components/ui/page-loader";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Settings2, FileWarning, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { QAQueuePanel } from "@/components/compliance/QAQueuePanel";
import { VehicleInspectionsTab } from "@/components/compliance/VehicleInspectionsTab";
import { IncidentsTab } from "@/components/compliance/IncidentsTab";

interface PayerRule {
  id: string;
  payer_type: string;
  requires_pcs: boolean;
  requires_signature: boolean;
  requires_necessity_note: boolean;
  requires_timestamps: boolean;
  requires_miles: boolean;
  requires_auth: boolean;
}

const PAYER_TYPES = ["medicare", "medicaid", "facility", "cash", "default"];

export default function ComplianceAndQA() {
  const [payerRules, setPayerRules] = useState<PayerRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<PayerRule | null>(null);
  const [ruleForm, setRuleForm] = useState<Partial<PayerRule>>({});
  const [savingRule, setSavingRule] = useState(false);
  const [addingRule, setAddingRule] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: ruleRows } = await supabase.from("payer_billing_rules" as any).select("*").order("payer_type");
    setPayerRules((ruleRows ?? []) as any[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openEditRule = (rule: PayerRule) => {
    setEditingRule(rule);
    setRuleForm({ ...rule });
  };

  const saveRule = async () => {
    setSavingRule(true);
    const { data: companyId } = await supabase.rpc("get_my_company_id");
    const payload = { ...ruleForm, company_id: companyId };

    if (editingRule) {
      await supabase.from("payer_billing_rules" as any).update(payload).eq("id", editingRule.id);
    } else {
      await supabase.from("payer_billing_rules" as any).insert(payload);
    }
    toast.success("Rule saved");
    setEditingRule(null);
    setAddingRule(false);
    fetchData();
    setSavingRule(false);
  };

  return (
    <AdminLayout>
      <Tabs defaultValue="qa" className="space-y-4">
        <TabsList>
          <TabsTrigger value="qa">QA Queue</TabsTrigger>
          <TabsTrigger value="incidents"><FileWarning className="h-3.5 w-3.5 mr-1.5" />Incidents {incidents.length > 0 && <span className="ml-1.5 text-[10px]">({incidents.length})</span>}</TabsTrigger>
          <TabsTrigger value="payer-rules"><Settings2 className="h-3.5 w-3.5 mr-1.5" />Payer Rules</TabsTrigger>
          <TabsTrigger value="inspections"><ClipboardCheck className="h-3.5 w-3.5 mr-1.5" />Vehicle Inspections</TabsTrigger>
        </TabsList>

        <TabsContent value="qa" className="m-0">
          <QAQueuePanel />
        </TabsContent>

        <TabsContent value="payer-rules" className="m-0 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => {
              setEditingRule(null);
              setRuleForm({ payer_type: "medicare", requires_pcs: false, requires_signature: false, requires_necessity_note: false, requires_timestamps: false, requires_miles: false, requires_auth: false });
              setAddingRule(true);
            }}>+ Add Rule</Button>
          </div>
          <div className="rounded-lg border bg-card overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 text-left">Payer</th>
                  <th className="px-4 py-3 text-center">PCS</th>
                  <th className="px-4 py-3 text-center">Signature</th>
                  <th className="px-4 py-3 text-center">Necessity Note</th>
                  <th className="px-4 py-3 text-center">Timestamps</th>
                  <th className="px-4 py-3 text-center">Miles</th>
                  <th className="px-4 py-3 text-center">Auth</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {payerRules.map(rule => (
                  <tr key={rule.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium capitalize">{rule.payer_type}</td>
                    {([
                      rule.requires_pcs, rule.requires_signature, rule.requires_necessity_note,
                      rule.requires_timestamps, rule.requires_miles, rule.requires_auth
                    ] as boolean[]).map((v, i) => (
                      <td key={i} className="px-4 py-3 text-center">
                        {v ? <CheckCircle className="h-4 w-4 text-[hsl(var(--status-green))] mx-auto" />
                           : <span className="text-muted-foreground/30 text-xs">—</span>}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEditRule(rule)}>Edit</Button>
                    </td>
                  </tr>
                ))}
                {payerRules.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      No payer rules configured. Add rules to enforce billing compliance.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="incidents" className="m-0 space-y-4">
          {loading ? (
            <PageLoader label="Loading incidents…" />
          ) : incidents.length === 0 ? (
            <EmptyState
              icon={FileWarning}
              title="No incident reports"
              description="Incident reports submitted by crew or dispatchers will appear here."
            />
          ) : (
            <div className="space-y-2">
              {incidents.map(inc => (
                <div key={inc.id} className="rounded-lg border bg-card p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{inc.incident_type}</span>
                    <span className="text-xs text-muted-foreground">{new Date(inc.incident_date).toLocaleString()}</span>
                  </div>
                  {inc.description && <p className="text-xs text-muted-foreground">{inc.description}</p>}
                  <div className="flex gap-3 text-[10px] text-muted-foreground">
                    {inc.crew_names && <span>Crew: {inc.crew_names}</span>}
                    {inc.emergency_services_contacted && (
                      <span className="text-destructive font-bold">Emergency Services Contacted</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="inspections" className="m-0">
          <VehicleInspectionsTab />
        </TabsContent>
      </Tabs>

      {/* Payer rule edit dialog */}
      <Dialog open={!!editingRule || addingRule} onOpenChange={o => { if (!o) { setEditingRule(null); setAddingRule(false); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit Rule" : "Add Rule"}</DialogTitle>
            <DialogDescription>Required billing fields for this payer type.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Payer Type</Label>
              <Select value={ruleForm.payer_type} onValueChange={v => setRuleForm({ ...ruleForm, payer_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYER_TYPES.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {([
              { key: "requires_pcs", label: "Requires PCS" },
              { key: "requires_signature", label: "Requires Signature" },
              { key: "requires_necessity_note", label: "Requires Necessity Note" },
              { key: "requires_timestamps", label: "Requires Timestamps" },
              { key: "requires_miles", label: "Requires Loaded Miles" },
              { key: "requires_auth", label: "Requires Authorization" },
            ] as const).map(field => (
              <div key={field.key} className="flex items-center justify-between">
                <Label>{field.label}</Label>
                <Switch
                  checked={!!(ruleForm as any)[field.key]}
                  onCheckedChange={v => setRuleForm({ ...ruleForm, [field.key]: v })}
                />
              </div>
            ))}
            <Button className="w-full" onClick={saveRule} disabled={savingRule}>
              {savingRule ? "Saving…" : "Save Rule"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

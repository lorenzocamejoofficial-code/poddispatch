import { useEffect, useState, useCallback } from "react";
import { PageLoader } from "@/components/ui/page-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, AlertTriangle, CheckCircle, RotateCcw, Settings2, FileWarning } from "lucide-react";
import { toast } from "sonner";

interface QAReview {
  id: string;
  trip_id: string;
  flag_reason: string;
  status: string;
  qa_notes: string | null;
  created_at: string;
  // joined
  patient_name?: string;
  run_date?: string;
  trip_type?: string;
}

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

interface IncidentReport {
  id: string;
  incident_date: string;
  incident_type: string;
  description: string | null;
  crew_names: string | null;
  emergency_services_contacted: boolean;
  created_at: string;
}

const PAYER_TYPES = ["medicare", "medicaid", "facility", "cash", "default"];

export default function ComplianceAndQA() {
  const [qaItems, setQaItems] = useState<QAReview[]>([]);
  const [payerRules, setPayerRules] = useState<PayerRule[]>([]);
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQA, setSelectedQA] = useState<QAReview | null>(null);
  const [qaNotes, setQaNotes] = useState("");
  const [savingQA, setSavingQA] = useState(false);
  const [editingRule, setEditingRule] = useState<PayerRule | null>(null);
  const [ruleForm, setRuleForm] = useState<Partial<PayerRule>>({});
  const [savingRule, setSavingRule] = useState(false);
  const [addingRule, setAddingRule] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: qaRows }, { data: ruleRows }, { data: incidentRows }] = await Promise.all([
      supabase.from("qa_reviews" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("payer_billing_rules" as any).select("*").order("payer_type"),
      supabase.from("incident_reports").select("*").order("incident_date", { ascending: false }),
    ]);

    // Enrich QA with trip/patient data
    const tripIds = [...new Set(((qaRows ?? []) as any[]).map((q: any) => q.trip_id).filter(Boolean))];
    const { data: tripRows } = tripIds.length > 0
      ? await supabase.from("trip_records" as any)
          .select("id, run_date, trip_type, patient:patients!trip_records_patient_id_fkey(first_name, last_name)")
          .in("id", tripIds)
      : { data: [] };
    const tripMap = new Map((tripRows ?? []).map((t: any) => [t.id, t]));

    setQaItems(
      ((qaRows ?? []) as any[]).map((q: any) => {
        const t = tripMap.get(q.trip_id) as any;
        return {
          ...q,
          patient_name: t?.patient ? `${t.patient.first_name} ${t.patient.last_name}` : "Unknown",
          run_date: t?.run_date ?? "—",
          trip_type: t?.trip_type ?? "—",
        };
      })
    );
    setPayerRules((ruleRows ?? []) as any[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-flag suspicious trips
  const runAutoFlag = async () => {
    const { data: trips } = await supabase
      .from("trip_records" as any)
      .select("id, loaded_miles, company_id")
      .in("status", ["completed", "ready_for_billing"]);
    if (!trips) return;

    const { data: existing } = await supabase.from("qa_reviews" as any).select("trip_id");
    const flagged = new Set((existing ?? []).map((e: any) => e.trip_id));
    const { data: companyId } = await supabase.rpc("get_my_company_id");

    const newFlags: any[] = [];
    (trips as any[]).forEach(t => {
      if (flagged.has(t.id)) return;
      const reasons: string[] = [];
      if (Number(t.loaded_miles ?? 0) > 100) reasons.push("Unusually long mileage (>100 miles)");
      if (reasons.length > 0) {
        newFlags.push({ trip_id: t.id, flag_reason: reasons.join("; "), company_id: companyId, status: "pending" });
      }
    });

    if (newFlags.length > 0) {
      await supabase.from("qa_reviews" as any).insert(newFlags);
      toast.success(`Flagged ${newFlags.length} trip(s) for QA review`);
      fetchData();
    } else {
      toast.info("No new flags generated");
    }
  };

  const handleQAAction = async (action: "approved" | "sent_back" | "adjusted") => {
    if (!selectedQA) return;
    setSavingQA(true);
    await supabase.from("qa_reviews" as any).update({
      status: action,
      qa_notes: qaNotes || null,
      reviewed_at: new Date().toISOString(),
    }).eq("id", selectedQA.id);
    toast.success(`QA item ${action.replace("_", " ")}`);
    setSelectedQA(null);
    fetchData();
    setSavingQA(false);
  };

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

  const statusColor: Record<string, string> = {
    pending: "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]",
    approved: "bg-[hsl(var(--status-green))]/15 text-[hsl(var(--status-green))]",
    sent_back: "bg-destructive/10 text-destructive",
    adjusted: "bg-primary/10 text-primary",
  };

  const pending = qaItems.filter(q => q.status === "pending");
  const reviewed = qaItems.filter(q => q.status !== "pending");

  return (
    <AdminLayout>
      <Tabs defaultValue="qa" className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="qa">QA Queue {pending.length > 0 && <span className="ml-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5">{pending.length}</span>}</TabsTrigger>
            <TabsTrigger value="payer-rules"><Settings2 className="h-3.5 w-3.5 mr-1.5" />Payer Rules</TabsTrigger>
          </TabsList>
          <Button size="sm" variant="outline" onClick={runAutoFlag}>
            <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />Run Auto-Flag
          </Button>
        </div>

        <TabsContent value="qa" className="m-0 space-y-4">
          {loading ? (
            <PageLoader label="Loading QA reviews…" />
          ) : pending.length === 0 && reviewed.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No QA items"
              description="Run Auto-Flag to check for suspicious trips."
            />
          ) : (
            <>
              {pending.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Review ({pending.length})</p>
                  {pending.map(item => (
                    <div key={item.id} className="flex items-center gap-3 rounded-lg border bg-card p-4">
                      <AlertTriangle className="h-5 w-5 text-[hsl(var(--status-yellow))] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{item.patient_name}</p>
                        <p className="text-xs text-muted-foreground">{item.run_date} · {item.flag_reason}</p>
                      </div>
                      <Button size="sm" onClick={() => { setSelectedQA(item); setQaNotes(item.qa_notes ?? ""); }}>
                        Review
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {reviewed.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reviewed ({reviewed.length})</p>
                  {reviewed.map(item => (
                    <div key={item.id} className="flex items-center gap-3 rounded-lg border bg-card/50 p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{item.patient_name}</p>
                        <p className="text-xs text-muted-foreground">{item.run_date} · {item.flag_reason}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${statusColor[item.status] ?? ""}`}>
                        {item.status.replace("_", " ")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
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
      </Tabs>

      {/* QA review dialog */}
      <Dialog open={!!selectedQA} onOpenChange={o => { if (!o) setSelectedQA(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QA Review — {selectedQA?.patient_name}</DialogTitle>
            <DialogDescription>{selectedQA?.run_date} · {selectedQA?.flag_reason}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>QA Notes</Label>
              <Textarea rows={4} value={qaNotes} onChange={e => setQaNotes(e.target.value)} placeholder="Add review notes…" />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => handleQAAction("approved")} disabled={savingQA}>
                <CheckCircle className="h-4 w-4 mr-1.5" />Approve
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => handleQAAction("adjusted")} disabled={savingQA}>
                <Settings2 className="h-4 w-4 mr-1.5" />Adjust
              </Button>
              <Button variant="destructive" className="flex-1" onClick={() => handleQAAction("sent_back")} disabled={savingQA}>
                <RotateCcw className="h-4 w-4 mr-1.5" />Send Back
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, ClipboardCheck, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { logAuditEvent } from "@/lib/audit-logger";
import { MASTER_INSPECTION_ITEMS, INSPECTION_CATEGORIES, getAllItemKeys } from "@/lib/vehicle-inspection-items";
import { CrewLayout } from "@/components/crew/CrewLayout";

interface ItemState {
  status: "ok" | "missing" | null;
  note: string;
}

export default function CrewInspectionChecklist() {
  const { user, profileId } = useAuth();
  const [truckId, setTruckId] = useState<string | null>(null);
  const [truckName, setTruckName] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [enabledKeys, setEnabledKeys] = useState<string[]>(getAllItemKeys());
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
  const [submittedInspection, setSubmittedInspection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const today = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`; })();

  const loadData = useCallback(async () => {
    if (!profileId) return;

    // Find crew assignment
    const { data: crewRow } = await supabase
      .from("crews")
      .select("truck_id, company_id, truck:trucks!crews_truck_id_fkey(name)")
      .eq("active_date", today)
      .or(`member1_id.eq.${profileId},member2_id.eq.${profileId},member3_id.eq.${profileId}`)
      .maybeSingle();

    if (!crewRow) { setLoading(false); return; }

    setTruckId(crewRow.truck_id);
    setCompanyId(crewRow.company_id);
    setTruckName((crewRow.truck as any)?.name ?? "");

    // Get profile name
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", profileId).maybeSingle();
    setProfileName(profile?.full_name ?? "");

    // Check for existing inspection
    const { data: existing } = await supabase
      .from("vehicle_inspections" as any)
      .select("*")
      .eq("truck_id", crewRow.truck_id)
      .eq("run_date", today)
      .maybeSingle();

    if (existing) {
      setSubmittedInspection(existing);
      setLoading(false);
      return;
    }

    // Load template
    const { data: template } = await supabase
      .from("vehicle_inspection_templates" as any)
      .select("*")
      .eq("truck_id", crewRow.truck_id)
      .eq("company_id", crewRow.company_id)
      .maybeSingle();

    if (template && Array.isArray((template as any).enabled_items) && (template as any).enabled_items.length > 0) {
      setEnabledKeys((template as any).enabled_items);
    }

    setLoading(false);
  }, [profileId, today]);

  useEffect(() => { loadData(); }, [loadData]);

  const enabledItems = MASTER_INSPECTION_ITEMS.filter(i => enabledKeys.includes(i.key));

  const setItemStatus = (key: string, status: "ok" | "missing") => {
    setItemStates(prev => ({ ...prev, [key]: { ...prev[key], status, note: prev[key]?.note ?? "" } }));
  };

  const setItemNote = (key: string, note: string) => {
    setItemStates(prev => ({ ...prev, [key]: { ...prev[key], status: prev[key]?.status ?? null, note } }));
  };

  const allMarked = enabledItems.every(i => itemStates[i.key]?.status != null);
  const missingItemsWithoutNotes = enabledItems.filter(
    i => itemStates[i.key]?.status === "missing" && !itemStates[i.key]?.note?.trim()
  );
  const canSubmit = allMarked && missingItemsWithoutNotes.length === 0;

  const handleSubmit = async () => {
    if (!truckId || !companyId || !user) return;
    setSubmitting(true);

    const checkedItems = enabledItems.map(i => ({
      item_key: i.key,
      item_label: i.label,
      category: i.category,
      status: itemStates[i.key]?.status ?? "ok",
      crew_note: itemStates[i.key]?.note?.trim() || null,
    }));

    const missingCount = checkedItems.filter(i => i.status === "missing").length;

    const inspectionPayload = {
      company_id: companyId,
      truck_id: truckId,
      run_date: today,
      submitted_by: user.id,
      submitted_by_name: profileName,
      items_checked: checkedItems,
      total_items: checkedItems.length,
      missing_count: missingCount,
      status: missingCount > 0 ? "has_missing" : "complete",
    };

    const { data: inspection, error } = await supabase
      .from("vehicle_inspections" as any)
      .insert(inspectionPayload)
      .select("*")
      .single();

    if (error) {
      console.error("Inspection submit error:", error.message, error.details, error.hint);
      toast.error("Failed to submit inspection", { description: error.message });
      setSubmitting(false);
      return;
    }

    // Audit log
    await logAuditEvent({
      action: "vehicle_inspection",
      tableName: "vehicle_inspections",
      recordId: (inspection as any).id,
      newData: inspectionPayload,
      notes: `Pre-trip inspection submitted for ${truckName}. ${checkedItems.length} items checked, ${missingCount} flagged missing.`,
    });

    // Create alerts for missing items
    if (missingCount > 0) {
      const missingItems = checkedItems.filter(i => i.status === "missing");
      const alertRows = missingItems.map(item => ({
        company_id: companyId,
        inspection_id: (inspection as any).id,
        truck_id: truckId,
        run_date: today,
        missing_item_key: item.item_key,
        missing_item_label: item.item_label,
        crew_note: item.crew_note,
      }));

      await supabase.from("vehicle_inspection_alerts" as any).insert(alertRows);

      // Create dispatch alert
      await supabase.from("alerts").insert({
        message: `Unit ${truckName} pre-trip inspection flagged ${missingCount} missing item(s) — ${profileName}. Dispatcher acknowledgment required.`,
        severity: "red",
        truck_id: truckId,
        company_id: companyId,
      });

      // Audit each flagged item
      for (const item of missingItems) {
        await logAuditEvent({
          action: "vehicle_inspection",
          tableName: "vehicle_inspection_alerts",
          notes: `Missing item flagged: ${item.item_label}. Crew note: ${item.crew_note}`,
        });
      }
    } else {
      // Green alert — auto-dismiss after 2h
      await supabase.from("alerts").insert({
        message: `Unit ${truckName} pre-trip inspection complete — ${profileName}. ${checkedItems.length} items checked, all present.`,
        severity: "green",
        truck_id: truckId,
        company_id: companyId,
      });
    }

    toast.success("Inspection submitted successfully");
    setSubmittedInspection(inspection);
    setSubmitting(false);
  };

  if (loading) {
    return (
      <CrewLayout>
        <div className="flex items-center justify-center p-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </CrewLayout>
    );
  }

  if (!truckId) {
    return (
      <CrewLayout>
        <div className="p-6 text-center text-muted-foreground">
          <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No truck assignment for today.</p>
        </div>
      </CrewLayout>
    );
  }

  // Submitted — read-only view
  if (submittedInspection) {
    const items = (submittedInspection as any).items_checked as any[];
    return (
      <CrewLayout>
        <div className="p-4 space-y-4">
          <div className="rounded-lg border border-[hsl(var(--status-green))]/30 bg-[hsl(var(--status-green))]/5 p-4 flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-[hsl(var(--status-green))] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">Inspection Complete</p>
              <p className="text-xs text-muted-foreground">
                Submitted by {(submittedInspection as any).submitted_by_name} at {new Date((submittedInspection as any).submitted_at).toLocaleTimeString()}
              </p>
              <p className="text-xs text-muted-foreground">
                {(submittedInspection as any).total_items} items checked · {(submittedInspection as any).missing_count} flagged
              </p>
            </div>
            <Lock className="h-4 w-4 text-muted-foreground ml-auto" />
          </div>

          {INSPECTION_CATEGORIES.map(cat => {
            const catItems = (items ?? []).filter((i: any) => i.category === cat);
            if (catItems.length === 0) return null;
            return (
              <div key={cat}>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{cat}</h4>
                <div className="space-y-1">
                  {catItems.map((item: any) => (
                    <div key={item.item_key} className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${
                      item.status === "missing" ? "bg-destructive/5 text-destructive" : "text-foreground"
                    }`}>
                      {item.status === "ok" ? (
                        <CheckCircle className="h-3 w-3 text-[hsl(var(--status-green))]" />
                      ) : (
                        <AlertTriangle className="h-3 w-3 text-destructive" />
                      )}
                      <span className="flex-1">{item.item_label}</span>
                      {item.crew_note && <span className="text-muted-foreground italic">— {item.crew_note}</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CrewLayout>
    );
  }

  // Active checklist
  return (
    <CrewLayout>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Pre-Trip Inspection</h2>
          <Badge variant="outline" className="ml-auto text-[10px]">{truckName}</Badge>
        </div>

        {INSPECTION_CATEGORIES.map(cat => {
          const catItems = enabledItems.filter(i => i.category === cat);
          if (catItems.length === 0) return null;
          return (
            <div key={cat} className="space-y-1">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{cat}</h4>
              {catItems.map(item => {
                const state = itemStates[item.key];
                return (
                  <div key={item.key} className="rounded border bg-card p-2 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-foreground flex-1">{item.label}</span>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant={state?.status === "ok" ? "default" : "outline"}
                          className={`h-6 text-[10px] px-2 ${state?.status === "ok" ? "bg-[hsl(var(--status-green))] hover:bg-[hsl(var(--status-green))]/90 text-white" : ""}`}
                          onClick={() => setItemStatus(item.key, "ok")}
                        >
                          OK
                        </Button>
                        <Button
                          size="sm"
                          variant={state?.status === "missing" ? "destructive" : "outline"}
                          className="h-6 text-[10px] px-2"
                          onClick={() => setItemStatus(item.key, "missing")}
                        >
                          Flag Missing
                        </Button>
                      </div>
                    </div>
                    {state?.status === "missing" && (
                      <Textarea
                        className="text-xs min-h-[40px]"
                        placeholder="Required: Describe what is missing or wrong…"
                        value={state.note}
                        onChange={(e) => setItemNote(item.key, e.target.value)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        <div className="sticky bottom-0 bg-background pt-2 pb-4 border-t">
          <Button
            className="w-full"
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Submitting…</>
            ) : (
              <><ClipboardCheck className="h-4 w-4 mr-1.5" /> Submit Inspection</>
            )}
          </Button>
          {!allMarked && (
            <p className="text-[10px] text-muted-foreground text-center mt-1">
              Mark every item as OK or Flag Missing to submit
            </p>
          )}
          {missingItemsWithoutNotes.length > 0 && (
            <p className="text-[10px] text-destructive text-center mt-1">
              {missingItemsWithoutNotes.length} flagged item(s) need a note
            </p>
          )}
        </div>
      </div>
    </CrewLayout>
  );
}

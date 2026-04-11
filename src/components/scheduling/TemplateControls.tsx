import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BookmarkCheck, Wand2, RefreshCw, Trash2, Info } from "lucide-react";
import type { LegDisplay, TruckOption } from "@/hooks/useSchedulingStore";

/* ── helpers ── */

/** Get the "day_type" key for a given ISO date string. */
export function getDayType(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay(); // 0=Sun…6=Sat
  // MWF: Mon(1), Wed(3), Fri(5)
  if ([1, 3, 5].includes(dow)) return "MWF";
  // TTS: Tue(2), Thu(4), Sat(6)
  if ([2, 4, 6].includes(dow)) return "TTS";
  // Sun gets its own key
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return labels[dow];
}

/** Transport group from trip_type (mirrors RunPool logic). */
function getTransportGroup(tripType: string): string {
  if (tripType === "dialysis") return "dialysis";
  if (tripType === "outpatient") return "outpatient";
  return "adhoc";
}

/** Rule shape stored in the template mapping JSONB array. */
interface TemplateRule {
  truck_id: string;
  transport_types: string[]; // e.g. ["dialysis"]
  leg_types: string[];       // e.g. ["A", "B"]
}

/** Row from truck_builder_templates. */
interface TemplateRow {
  id: string;
  company_id: string;
  day_type: string;
  name: string;
  mapping: TemplateRule[];
  created_at: string;
  updated_at: string;
}

interface Props {
  selectedDate: string;
  trucks: TruckOption[];
  legs: LegDisplay[];
  onRefresh: () => void;
}

type ApplyMode = "unassigned_only" | "rebuild_all";

export function TemplateControls({ selectedDate, trucks, legs, onRefresh }: Props) {
  const [template, setTemplate] = useState<TemplateRow | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Apply confirmation dialog
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applyMode, setApplyMode] = useState<ApplyMode>("unassigned_only");

  const dayType = getDayType(selectedDate);

  /* ── load active template for this day_type ── */
  const loadTemplate = useCallback(async () => {
    setLoadingTemplate(true);
    const { data } = await supabase
      .from("truck_builder_templates" as any)
      .select("*")
      .eq("day_type", dayType)
      .maybeSingle();
    setTemplate(data ? (data as unknown as TemplateRow) : null);
    setLoadingTemplate(false);
  }, [dayType]);

  useEffect(() => { loadTemplate(); }, [loadTemplate]);

  /* ── SAVE / UPDATE TEMPLATE ──────────────────────────────────────── */
  const handleSave = async () => {
    setSaving(true);
    try {
      // Resolve company_id using standard RPC
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      if (!companyId) { toast.error("Cannot determine company — are you logged in?"); return; }

      // Build mapping: one rule per truck that has assigned legs
      const mapping: TemplateRule[] = trucks
        .map((truck) => {
          const tLegs = legs.filter(l => l.assigned_truck_id === truck.id);
          if (tLegs.length === 0) return null;

          const transportTypes = [...new Set(tLegs.map(l => getTransportGroup(l.trip_type)))];
          const legTypes = [...new Set(tLegs.map(l => l.leg_type))];

          return { truck_id: truck.id, transport_types: transportTypes, leg_types: legTypes } as TemplateRule;
        })
        .filter(Boolean) as TemplateRule[];

      if (mapping.length === 0) {
        toast.warning("No assigned runs found — assign runs to trucks before saving a template.");
        return;
      }

      const assignedCount = legs.filter(l => l.assigned_truck_id).length;
      const name = `${dayType} Setup (${assignedCount} runs across ${mapping.length} truck${mapping.length !== 1 ? "s" : ""})`;

      const payload = { company_id: companyId, day_type: dayType, name, mapping };

      const { error } = await supabase
        .from("truck_builder_templates" as any)
        .upsert(payload, { onConflict: "company_id,day_type" });

      if (error) { toast.error("Failed to save template"); console.error(error); return; }

      toast.success(`Default ${dayType} setup saved — ${mapping.length} truck rule${mapping.length !== 1 ? "s" : ""} stored`);
      await loadTemplate();
    } finally {
      setSaving(false);
    }
  };

  /* ── APPLY TEMPLATE ───────────────────────────────────────────────── */
  const handleApply = async () => {
    if (!template) return;
    setApplying(true);
    setApplyDialogOpen(false);
    try {
      // Resolve company_id using standard RPC
      const { data: companyId } = await supabase.rpc("get_my_company_id");

      // If rebuild mode: first clear all existing slots for this date
      if (applyMode === "rebuild_all") {
        const { error: delErr } = await supabase
          .from("truck_run_slots")
          .delete()
          .eq("run_date", selectedDate);
        if (delErr) { toast.error("Failed to clear existing assignments"); return; }
      }

      // Reload fresh leg state from DB after possible delete
      const [{ data: freshLegs }, { data: freshSlots }] = await Promise.all([
        supabase.from("scheduling_legs").select("id, trip_type, leg_type").eq("run_date", selectedDate),
        supabase.from("truck_run_slots").select("leg_id").eq("run_date", selectedDate),
      ]);

      const assignedIds = new Set((freshSlots ?? []).map((s: any) => s.leg_id));
      const rules = template.mapping as TemplateRule[];

      // Collect inserts to perform
      const inserts: any[] = [];
      const usedLegIds = new Set<string>();

      for (const rule of rules) {
        // Check truck still exists
        const truckExists = trucks.some(t => t.id === rule.truck_id);
        if (!truckExists) continue;

        // Find legs that match this rule (unassigned, matching transport + leg type)
        const matchingLegs = (freshLegs ?? []).filter((l: any) => {
          if (assignedIds.has(l.id) || usedLegIds.has(l.id)) return false;
          const tg = getTransportGroup(l.trip_type);
          return rule.transport_types.includes(tg) && rule.leg_types.includes(l.leg_type);
        });

        // Cap at 10 per truck (system max)
        const existingOnTruck = inserts.filter(i => i.truck_id === rule.truck_id).length;
        const available = 10 - existingOnTruck;
        const toAssign = matchingLegs.slice(0, available);

        for (let i = 0; i < toAssign.length; i++) {
          inserts.push({
            truck_id: rule.truck_id,
            leg_id: toAssign[i].id,
            run_date: selectedDate,
            slot_order: existingOnTruck + i,
            company_id: companyId,
          });
          usedLegIds.add(toAssign[i].id);
        }
      }

      if (inserts.length === 0) {
        toast.info("No unassigned runs matched the template rules — try Auto-Fill first.");
        return;
      }

      const { error } = await supabase
        .from("truck_run_slots")
        .insert(inserts as any);

      if (error) {
        if (error.code === "23505") {
          toast.warning("Some legs were already assigned — skipped duplicates.");
        } else {
          toast.error("Failed to apply template"); console.error(error); return;
        }
      }

      const trucksHit = new Set(inserts.map(i => i.truck_id)).size;
      toast.success(`Applied template — ${inserts.length} run${inserts.length !== 1 ? "s" : ""} assigned across ${trucksHit} truck${trucksHit !== 1 ? "s" : ""}`);
      onRefresh();
    } finally {
      setApplying(false);
    }
  };

  /* ── CLEAR TEMPLATE ───────────────────────────────────────────────── */
  const handleClear = async () => {
    if (!template) return;
    setClearing(true);
    try {
      const { error } = await supabase
        .from("truck_builder_templates" as any)
        .delete()
        .eq("id", template.id);
      if (error) { toast.error("Failed to clear template"); return; }
      toast.success(`Default ${dayType} template cleared`);
      setTemplate(null);
    } finally {
      setClearing(false);
    }
  };

  /* ── RENDER ── */
  const assignedCount = legs.filter(l => l.assigned_truck_id).length;
  const unassignedCount = legs.filter(l => !l.assigned_truck_id).length;

  if (loadingTemplate) return null;

  return (
    <section className="rounded-lg border bg-card px-4 py-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <BookmarkCheck className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Default Setup Template
          </span>
          <Badge variant="secondary" className="text-[10px]">{dayType}</Badge>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {assignedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={handleSave}
              disabled={saving}
            >
              <BookmarkCheck className="h-3.5 w-3.5" />
              {template ? "Update Default" : "Save as Default Setup"}
            </Button>
          )}

          {template && unassignedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/5"
              onClick={() => setApplyDialogOpen(true)}
              disabled={applying}
            >
              <Wand2 className="h-3.5 w-3.5" />
              {applying ? "Applying…" : "Apply Default Setup"}
            </Button>
          )}

          {template && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={handleClear}
              disabled={clearing}
              title={`Clear default ${dayType} template`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Template info line */}
      {template ? (
        <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Info className="h-3 w-3 shrink-0 mt-0.5" />
          <span>
            <span className="text-foreground font-medium">{template.name}</span>
            {" · "}Last updated{" "}
            {new Date(template.updated_at).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            })}
            {" at "}
            {new Date(template.updated_at).toLocaleTimeString("en-US", {
              hour: "numeric", minute: "2-digit",
            })}
            {" · "}
            {(template.mapping as TemplateRule[]).length} truck rule{(template.mapping as TemplateRule[]).length !== 1 ? "s" : ""}
          </span>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground italic flex items-center gap-1.5">
          <Info className="h-3 w-3 shrink-0" />
          No default template saved for <strong>{dayType}</strong> days yet.
          {assignedCount === 0
            ? " Assign runs to trucks first, then click Save as Default Setup."
            : " Click Save as Default Setup to store the current truck arrangement."}
        </p>
      )}

      {/* Apply confirmation dialog */}
      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-primary" />
              Apply Default Setup
            </DialogTitle>
            <DialogDescription>
              The template will auto-place unassigned runs from the Run Pool into trucks based on the saved rules for <strong>{dayType}</strong> days.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <button
                className={`w-full text-left rounded-md border px-3 py-2.5 text-sm transition-colors ${
                  applyMode === "unassigned_only"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-primary/30"
                }`}
                onClick={() => setApplyMode("unassigned_only")}
              >
                <div className="font-medium">Apply to unassigned only</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Already-assigned runs stay in place. Only runs still in the pool are placed. <span className="text-primary font-medium">(Recommended)</span>
                </div>
              </button>
              <button
                className={`w-full text-left rounded-md border px-3 py-2.5 text-sm transition-colors ${
                  applyMode === "rebuild_all"
                    ? "border-destructive/60 bg-destructive/5 text-destructive"
                    : "border-border hover:border-destructive/30"
                }`}
                onClick={() => setApplyMode("rebuild_all")}
              >
                <div className="font-medium">Rebuild all from template</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Clears all current truck assignments first, then re-places from pool. All manual moves are lost.
                </div>
              </button>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1"
                variant={applyMode === "rebuild_all" ? "destructive" : "default"}
                onClick={handleApply}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                {applyMode === "rebuild_all" ? "Rebuild & Apply" : "Apply to Unassigned"}
              </Button>
              <Button variant="outline" onClick={() => setApplyDialogOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

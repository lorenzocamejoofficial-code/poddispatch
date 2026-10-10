import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getActiveCompanyId, NO_COMPANY } from "@/lib/company-scope";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardCheck, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { INSPECTION_CATEGORIES } from "@/lib/vehicle-inspection-items";
import { InspectionAlertExpanded } from "./InspectionAlertExpanded";
import { canMarkReviewed, checkoffStatus, reviewInspection, unansweredFlagCount, type CheckoffStatus } from "@/lib/inspection-review";

const LABEL: Record<CheckoffStatus, string> = {
  not_submitted: "Not submitted",
  awaiting_review: "Awaiting review",
  has_flags: "Has flags",
  reviewed: "Reviewed",
};

function badgeClass(s: CheckoffStatus) {
  if (s === "reviewed") return "bg-[hsl(var(--status-green))] hover:bg-[hsl(var(--status-green))]/90";
  if (s === "has_flags") return "bg-destructive hover:bg-destructive/90";
  if (s === "awaiting_review") return "border border-[hsl(var(--status-yellow))]/40 bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]";
  return "";
}

export function TruckCheckoffSection({ truckId, truckName, runDate }: { truckId: string; truckName: string; runDate: string }) {
  const { user } = useAuth();
  const [insp, setInsp] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const companyId = (await getActiveCompanyId()) ?? NO_COMPANY;
    const { data } = await supabase
      .from("vehicle_inspections")
      .select("*")
      .eq("company_id", companyId)
      .eq("truck_id", truckId)
      .eq("run_date", runDate)
      .maybeSingle();
    setInsp(data ?? null);
    if (data) {
      const { data: a } = await supabase
        .from("vehicle_inspection_alerts")
        .select("*")
        .eq("company_id", companyId)
        .eq("inspection_id", data.id);
      setAlerts(a ?? []);
    } else setAlerts([]);
  }, [truckId, runDate]);

  useEffect(() => { load(); }, [load]);

  const status = checkoffStatus(insp, alerts);
  const items = (insp?.items_checked ?? []) as any[];
  const reviewable = insp && !insp.reviewed_at && canMarkReviewed(alerts);

  const markReviewed = async () => {
    if (!insp || !user) return;
    setSaving(true);
    const { data: prof } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
    const res = await reviewInspection({
      inspectionId: insp.id, truckId, truckName, runDate,
      reviewerUserId: user.id, reviewerName: prof?.full_name ?? user.email ?? "", note,
    });
    setSaving(false);
    if (!res.ok) { toast.error("Could not mark reviewed", { description: res.error }); return; }
    toast.success("Checkoff marked reviewed — crew notified");
    setNote("");
    load();
  };

  return (
    <>
      <div className="flex items-center gap-2 border-t pt-2 mt-2 text-xs">
        <ClipboardCheck className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Checkoff</span>
        <Badge variant={status === "not_submitted" ? "outline" : "default"} className={`text-[10px] ${badgeClass(status)}`}>{LABEL[status]}</Badge>
        {insp && (
          <Button size="sm" variant="ghost" className="ml-auto h-6 text-[10px]" onClick={() => setOpen(true)}>Open</Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Truck checkoff — {truckName} · {runDate}</DialogTitle></DialogHeader>
          {insp && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Submitted by {insp.submitted_by_name ?? "Unknown"} at {new Date(insp.submitted_at).toLocaleString()} · {insp.total_items} items · {insp.missing_count} flagged
              </p>
              {insp.reviewed_at && (
                <p className="text-xs text-[hsl(var(--status-green))]">
                  Reviewed by {insp.reviewed_by_name} at {new Date(insp.reviewed_at).toLocaleString()}{insp.review_note ? ` — ${insp.review_note}` : ""}
                </p>
              )}

              {unansweredFlagCount(alerts) > 0 && (
                <InspectionAlertExpanded truckId={truckId} truckName={truckName} runDate={runDate} onAcknowledged={load} />
              )}

              {INSPECTION_CATEGORIES.map((cat) => {
                const catItems = items.filter((i) => i.category === cat);
                if (catItems.length === 0) return null;
                return (
                  <div key={cat}>
                    <h5 className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">{cat}</h5>
                    {catItems.map((item) => {
                      const a = alerts.find((x) => x.missing_item_key === item.item_key);
                      return (
                        <div key={item.item_key} className="flex items-start gap-2 text-xs">
                          {item.status === "ok"
                            ? <CheckCircle className="h-3 w-3 text-[hsl(var(--status-green))] shrink-0 mt-0.5" />
                            : <AlertTriangle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />}
                          <span className="flex-1 text-foreground">{item.item_label}</span>
                          {item.crew_note && <span className="text-muted-foreground italic">Crew: {item.crew_note}</span>}
                          {a?.dispatcher_response && (
                            <span className={a.dispatcher_response === "cleared" ? "text-[hsl(var(--status-green))]" : "text-destructive"}>
                              {a.dispatcher_response === "cleared" ? "Cleared" : "Hold"}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {!insp.reviewed_at && (
                <div className="space-y-2 border-t pt-3">
                  <Textarea className="text-xs min-h-[50px]" placeholder="Optional review note…" value={note} onChange={(e) => setNote(e.target.value)} />
                  {!canMarkReviewed(alerts) && (
                    <p className="text-xs text-destructive">Answer every flagged item (Cleared or Hold) before marking reviewed.</p>
                  )}
                  <Button size="sm" className="w-full" disabled={!reviewable || saving} onClick={markReviewed}>
                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Mark Reviewed
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, BellRing, Truck } from "lucide-react";
import { toast } from "sonner";

interface ChangeLog {
  id: string;
  truck_id: string | null;
  change_summary: string;
  change_type: string;
  created_at: string;
}

interface NotifyCrewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string;
  onNotified: () => void;
}

export function NotifyCrewModal({ open, onOpenChange, selectedDate, onNotified }: NotifyCrewModalProps) {
  const [changes, setChanges] = useState<ChangeLog[]>([]);
  const [truckNames, setTruckNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      const { data } = await supabase
        .from("schedule_change_log")
        .select("id, truck_id, change_summary, change_type, created_at")
        .eq("company_id", companyId)
        .is("notified_at", null)
        .order("created_at", { ascending: false });

      const rows = (data ?? []) as unknown as ChangeLog[];
      setChanges(rows);

      // Fetch truck names
      const truckIds = [...new Set(rows.map(r => r.truck_id).filter(Boolean))] as string[];
      if (truckIds.length > 0) {
        const { data: trucks } = await supabase.from("trucks").select("id, name").in("id", truckIds);
        setTruckNames(new Map((trucks ?? []).map((t: any) => [t.id, t.name])));
      }
      setLoading(false);
    };
    load();
  }, [open]);

  // Group by truck
  const grouped = new Map<string, ChangeLog[]>();
  for (const c of changes) {
    const key = c.truck_id ?? "unassigned";
    const arr = grouped.get(key) ?? [];
    arr.push(c);
    grouped.set(key, arr);
  }

  const handleSend = async () => {
    if (changes.length === 0) return;
    setSending(true);
    try {
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      let crewNotified = 0;

      for (const [truckId, truckChanges] of grouped) {
        if (truckId === "unassigned") continue;

        // Look up crew for this truck on selectedDate
        const { data: crewRow } = await supabase
          .from("crews")
          .select("member1_id, member2_id, member3_id, member1:profiles!crews_member1_id_fkey(user_id), member2:profiles!crews_member2_id_fkey(user_id), member3:profiles!crews_member3_id_fkey(user_id)")
          .eq("truck_id", truckId)
          .eq("active_date", selectedDate)
          .maybeSingle();

        if (!crewRow) continue;

        const truckName = truckNames.get(truckId) ?? "Truck";
        const messageLines = truckChanges.map(c => `• ${c.change_summary}`).join("\n");
        const message = `Schedule Update — ${truckName}\n${messageLines}`;

        const userIds: string[] = [];
        if ((crewRow.member1 as any)?.user_id) userIds.push((crewRow.member1 as any).user_id);
        if ((crewRow.member2 as any)?.user_id) userIds.push((crewRow.member2 as any).user_id);
        if ((crewRow.member3 as any)?.user_id) userIds.push((crewRow.member3 as any).user_id);

        for (const userId of userIds) {
          await supabase.from("notifications").insert({
            user_id: userId,
            message,
            acknowledged: false,
            notification_type: "schedule_change",
            related_run_id: null,
          } as any);
          crewNotified++;
        }
      }

      // Mark all changes as notified
      const changeIds = changes.map(c => c.id);
      if (changeIds.length > 0) {
        await supabase
          .from("schedule_change_log")
          .update({ notified_at: new Date().toISOString() })
          .in("id", changeIds);
      }

      toast.success(`Crew notified — ${crewNotified} crew member${crewNotified !== 1 ? "s" : ""} received schedule update`);
      onNotified();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Failed to send notifications");
    }
    setSending(false);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            Notify Crew of Schedule Changes
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : changes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No pending changes to notify</p>
        ) : (
          <div className="space-y-4">
            {[...grouped].map(([truckId, truckChanges]) => (
              <div key={truckId} className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">
                    {truckId === "unassigned" ? "Unassigned" : truckNames.get(truckId) ?? "Unknown Truck"}
                  </span>
                  <span className="text-xs text-muted-foreground">{truckChanges.length} change{truckChanges.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="space-y-1">
                  {truckChanges.map(c => (
                    <div key={c.id} className="flex items-start justify-between gap-2 text-xs">
                      <span className="text-foreground">• {c.change_summary}</span>
                      <span className="text-muted-foreground shrink-0">{formatTime(c.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending || changes.length === 0}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <BellRing className="h-4 w-4 mr-1.5" />}
            Send Notifications
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

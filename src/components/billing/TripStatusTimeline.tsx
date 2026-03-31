import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronRight, ArrowRight } from "lucide-react";

interface StatusEntry {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_at: string;
  changed_by: string | null;
  changed_by_name: string;
}

interface TripStatusTimelineProps {
  tripId: string;
  /** Label override — defaults to "Status History" */
  label?: string;
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  assigned: "Assigned",
  en_route: "En Route",
  arrived_pickup: "Arrived Pickup",
  loaded: "Loaded",
  arrived_dropoff: "Arrived Dropoff",
  completed: "Completed",
  ready_for_billing: "Ready for Billing",
  cancelled: "Cancelled",
  no_show: "No-Show",
  patient_not_ready: "Patient Not Ready",
  facility_delay: "Facility Delay",
  pending_cancellation: "Pending Cancel",
};

function statusLabel(s: string | null): string {
  if (!s) return "—";
  return STATUS_LABELS[s] ?? s;
}

export function TripStatusTimeline({ tripId, label = "Status History" }: TripStatusTimelineProps) {
  const [entries, setEntries] = useState<StatusEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    (async () => {
      const { data, error } = await supabase
        .from("trip_status_history" as any)
        .select("id, old_status, new_status, changed_at, changed_by")
        .eq("trip_id", tripId)
        .order("changed_at", { ascending: true });

      if (error || !data) {
        setLoading(false);
        return;
      }

      // Resolve changed_by names
      const userIds = [...new Set((data as any[]).map((d: any) => d.changed_by).filter(Boolean))];
      let nameMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);
        if (profiles) {
          nameMap = new Map(profiles.map((p: any) => [p.user_id, p.full_name]));
        }
      }

      setEntries(
        (data as any[]).map((d: any) => ({
          id: d.id,
          old_status: d.old_status,
          new_status: d.new_status,
          changed_at: d.changed_at,
          changed_by: d.changed_by,
          changed_by_name: d.changed_by ? (nameMap.get(d.changed_by) ?? "Unknown") : "System",
        }))
      );
      setLoading(false);
    })();
  }, [tripId]);

  if (loading) return null;
  if (entries.length === 0) return null;

  return (
    <div className="rounded-md border bg-card">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <span>{label} ({entries.length})</span>
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="border-t px-3 py-2 space-y-2 max-h-48 overflow-y-auto">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground whitespace-nowrap">
                {new Date(e.changed_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="font-medium">{statusLabel(e.old_status)}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="font-medium text-primary">{statusLabel(e.new_status)}</span>
              <span className="ml-auto text-muted-foreground truncate max-w-[120px]">
                {e.changed_by_name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

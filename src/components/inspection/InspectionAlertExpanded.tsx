import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle, Shield } from "lucide-react";
import { toast } from "sonner";
import { logAuditEvent } from "@/lib/audit-logger";

interface Props {
  truckId: string;
  truckName: string;
  runDate: string;
  onAcknowledged: () => void;
}

interface InspectionAlert {
  id: string;
  missing_item_key: string;
  missing_item_label: string;
  crew_note: string | null;
  dispatcher_response: string | null;
  acknowledged_by_name: string | null;
}

export function InspectionAlertExpanded({ truckId, truckName, runDate, onAcknowledged }: Props) {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<InspectionAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [dispatcherNote, setDispatcherNote] = useState("");
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("vehicle_inspection_alerts" as any)
        .select("*")
        .eq("truck_id", truckId)
        .eq("run_date", runDate)
        .is("acknowledged_by", null);
      setAlerts((data ?? []) as any[]);
      setLoading(false);
    })();
  }, [truckId, runDate]);

  const respond = async (response: "cleared" | "hold") => {
    if (!dispatcherNote.trim()) {
      toast.error("Enter a note before responding");
      return;
    }
    setResponding(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user!.id)
      .maybeSingle();

    const name = profile?.full_name ?? user?.email ?? "";

    for (const alert of alerts) {
      await supabase
        .from("vehicle_inspection_alerts" as any)
        .update({
          acknowledged_by: user!.id,
          acknowledged_by_name: name,
          acknowledged_at: new Date().toISOString(),
          dispatcher_response: response,
          dispatcher_note: dispatcherNote.trim(),
        })
        .eq("id", alert.id);

      await logAuditEvent({
        action: "vehicle_inspection",
        tableName: "vehicle_inspection_alerts",
        recordId: alert.id,
        notes: `Dispatcher ${response === "cleared" ? "cleared" : "placed hold on"} missing item: ${alert.missing_item_label}. Note: ${dispatcherNote.trim()}`,
      });
    }

    if (response === "cleared") {
      await logAuditEvent({
        action: "vehicle_inspection",
        tableName: "vehicle_inspection_alerts",
        notes: `Gate bypassed: Dispatcher cleared crew on ${truckName} despite ${alerts.length} missing item(s).`,
      });
    }

    toast.success(response === "cleared" ? "Crew cleared to proceed" : "Hold placed — crew should not depart");
    setResponding(false);
    onAcknowledged();
  };

  if (loading) return null;
  if (alerts.length === 0) return <p className="text-xs text-muted-foreground">No unacknowledged inspection alerts.</p>;

  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <h4 className="text-xs font-semibold text-destructive flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5" />
        Missing Items — {truckName}
      </h4>
      <div className="space-y-1">
        {alerts.map(a => (
          <div key={a.id} className="flex items-start gap-2 text-xs rounded bg-destructive/5 p-2">
            <AlertTriangle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-foreground">{a.missing_item_label}</p>
              {a.crew_note && <p className="text-muted-foreground italic mt-0.5">Crew: {a.crew_note}</p>}
            </div>
          </div>
        ))}
      </div>
      <Textarea
        className="text-xs min-h-[50px]"
        placeholder="Required: Enter dispatcher note…"
        value={dispatcherNote}
        onChange={e => setDispatcherNote(e.target.value)}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 h-7 text-xs"
          onClick={() => respond("cleared")}
          disabled={responding}
        >
          <CheckCircle className="h-3 w-3 mr-1" /> Cleared to Proceed
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="flex-1 h-7 text-xs"
          onClick={() => respond("hold")}
          disabled={responding}
        >
          <Shield className="h-3 w-3 mr-1" /> Hold — Do Not Depart
        </Button>
      </div>
    </div>
  );
}

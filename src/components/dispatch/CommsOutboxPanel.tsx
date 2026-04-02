import { useState, useEffect, useCallback } from "react";
import { ChevronDown, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface CommsCall {
  id: string;
  call_type: string;
  patient_name: string | null;
  facility_name: string | null;
  truck_id: string;
  queued_at: string;
  status: string;
}

interface CommsOutboxPanelProps {
  selectedDate: string;
  refreshKey: number;
}

export function CommsOutboxPanel({ selectedDate, refreshKey }: CommsOutboxPanelProps) {
  const [calls, setCalls] = useState<CommsCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [truckNames, setTruckNames] = useState<Map<string, string>>(new Map());

  const fetchCalls = useCallback(async () => {
    const startOfDay = `${selectedDate}T00:00:00.000Z`;
    const endOfDay = `${selectedDate}T23:59:59.999Z`;

    const { data } = await supabase
      .from("comms_events" as any)
      .select("id, call_type, patient_name, facility_name, truck_id, queued_at, status, event_type")
      .in("event_type", ["call_patient", "call_facility"])
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay)
      .order("created_at", { ascending: true })
      .limit(50);

    const rows = (data as any[]) ?? [];
    setCalls(rows);

    // Fetch truck names for display
    const truckIds = [...new Set(rows.map((r: any) => r.truck_id).filter(Boolean))];
    if (truckIds.length > 0) {
      const { data: trucks } = await supabase
        .from("trucks")
        .select("id, name")
        .in("id", truckIds);
      const map = new Map<string, string>();
      (trucks ?? []).forEach((t) => map.set(t.id, t.name));
      setTruckNames(map);
    }

    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls, refreshKey]);

  if (loading) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-2">
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/50 transition-colors">
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-0" : "-rotate-90"}`} />
        <span className="font-medium">Today's Queued Calls</span>
        {calls.length > 0 && (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary ml-auto">
            {calls.length}
          </Badge>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 space-y-1">
        {calls.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">No calls queued today</p>
        ) : (
          calls.map((call) => (
            <div
              key={call.id}
              className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs bg-background"
            >
              <Phone className="h-3 w-3 shrink-0 text-primary" />
              <span className="text-muted-foreground">
                {call.queued_at
                  ? new Date(call.queued_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : "—"}
              </span>
              <span className="font-medium text-card-foreground">
                {call.call_type === "facility" ? call.facility_name : call.patient_name}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{truckNames.get(call.truck_id) ?? "—"}</span>
              <Badge variant="outline" className="text-[8px] px-1 py-0 ml-auto">
                {call.call_type === "facility" ? "Facility" : "Patient"}
              </Badge>
            </div>
          ))
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

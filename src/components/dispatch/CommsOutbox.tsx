import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Send, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CommsEvent {
  id: string;
  trip_id: string;
  truck_id: string;
  event_type: string;
  payload: any;
  status: string;
  created_at: string;
}

interface CommsOutboxProps {
  selectedDate: string;
}

export function CommsOutbox({ selectedDate }: CommsOutboxProps) {
  const [events, setEvents] = useState<CommsEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    const startOfDay = `${selectedDate}T00:00:00.000Z`;
    const endOfDay = `${selectedDate}T23:59:59.999Z`;

    const { data } = await supabase
      .from("comms_events" as any)
      .select("*")
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay)
      .order("created_at", { ascending: false })
      .limit(50);

    setEvents((data as any[]) ?? []);
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  if (loading) return null;
  if (events.length === 0) return null;

  const queuedCount = events.filter(e => e.status === "queued").length;

  return (
    <section className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Comms Outbox
        </h3>
        {queuedCount > 0 && (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary">
            {queuedCount} queued
          </Badge>
        )}
        <span className="text-[10px] text-muted-foreground ml-auto">
          Would-be notifications (simulation mode)
        </span>
      </div>

      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {events.map((event) => {
          const payload = event.payload as any;
          const isEta = event.event_type === "eta_shift";

          return (
            <div
              key={event.id}
              className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs bg-background"
            >
              <div className={`shrink-0 ${isEta ? "text-[hsl(var(--status-yellow))]" : "text-[hsl(var(--status-red))]"}`}>
                {isEta ? <Clock className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-card-foreground">
                  {event.event_type.replace(/_/g, " ").toUpperCase()}
                </span>
                {payload?.message && (
                  <p className="text-muted-foreground truncate">{payload.message}</p>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {new Date(event.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <Badge
                variant="outline"
                className={`text-[8px] px-1 py-0 ${
                  event.status === "queued"
                    ? "border-[hsl(var(--status-yellow))]/40 text-[hsl(var(--status-yellow))]"
                    : "border-[hsl(var(--status-green))]/40 text-[hsl(var(--status-green))]"
                }`}
              >
                {event.status}
              </Badge>
            </div>
          );
        })}
      </div>
    </section>
  );
}

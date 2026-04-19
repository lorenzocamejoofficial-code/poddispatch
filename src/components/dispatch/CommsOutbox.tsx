import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Phone, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CommsEvent {
  id: string;
  trip_id: string;
  truck_id: string;
  event_type: string;
  payload: any;
  status: string;
  call_status: string | null;
  called_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

interface CommsOutboxProps {
  selectedDate: string;
}

type Tone = "green" | "yellow" | "red" | "grey";

function statusTone(ev: CommsEvent): Tone {
  const cs = (ev.call_status ?? "").toLowerCase();
  const s = (ev.status ?? "").toLowerCase();
  if (cs === "completed" || s === "sent" && cs === "completed") return "green";
  if (cs === "in-progress" || cs === "ringing" || cs === "answered") return "yellow";
  if (s === "failed" || cs === "failed" || cs === "no-answer" || cs === "busy" || cs === "canceled") return "red";
  return "grey";
}

const toneClasses: Record<Tone, string> = {
  green: "text-[hsl(var(--status-green))]",
  yellow: "text-[hsl(var(--status-yellow))]",
  red: "text-[hsl(var(--status-red))]",
  grey: "text-muted-foreground",
};

const toneBadgeClasses: Record<Tone, string> = {
  green: "border-[hsl(var(--status-green))]/40 text-[hsl(var(--status-green))]",
  yellow: "border-[hsl(var(--status-yellow))]/40 text-[hsl(var(--status-yellow))]",
  red: "border-[hsl(var(--status-red))]/40 text-[hsl(var(--status-red))]",
  grey: "border-muted-foreground/40 text-muted-foreground",
};

function ToneIcon({ tone }: { tone: Tone }) {
  const cls = `h-3.5 w-3.5 ${toneClasses[tone]}`;
  if (tone === "green") return <CheckCircle2 className={cls} />;
  if (tone === "yellow") return <Clock className={cls} />;
  if (tone === "red") return <XCircle className={cls} />;
  return <AlertCircle className={cls} />;
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

  // Realtime subscription for live status updates
  useEffect(() => {
    const channel = supabase
      .channel("comms-events-outbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comms_events" },
        () => {
          fetchEvents();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEvents]);

  if (loading) return null;
  if (events.length === 0) return null;

  const queuedCount = events.filter(e => statusTone(e) === "grey").length;

  return (
    <section className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Today's Queued Calls
        </h3>
        {queuedCount > 0 && (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary">
            {queuedCount} pending
          </Badge>
        )}
      </div>

      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {events.map((event) => {
          const payload = event.payload as any;
          const tone = statusTone(event);
          const displayStatus = event.call_status ?? event.status ?? "queued";
          const completedTime = event.completed_at
            ? new Date(event.completed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : event.called_at
              ? new Date(event.called_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : new Date(event.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

          return (
            <div
              key={event.id}
              className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs bg-background"
            >
              <div className="shrink-0">
                <ToneIcon tone={tone} />
              </div>
              <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium text-card-foreground">
                  {payload?.target_name ?? event.event_type.replace(/_/g, " ")}
                </span>
                {event.error_message && tone === "red" && (
                  <p className="text-[10px] text-[hsl(var(--status-red))] truncate">{event.error_message}</p>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {completedTime}
              </span>
              <Badge
                variant="outline"
                className={`text-[8px] px-1 py-0 ${toneBadgeClasses[tone]}`}
              >
                {displayStatus}
              </Badge>
            </div>
          );
        })}
      </div>
    </section>
  );
}

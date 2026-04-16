import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronUp, ArrowRight, ExternalLink, AlertCircle } from "lucide-react";

/* ── types ── */
interface UpcomingLeg {
  id: string;
  run_date: string;
  patient_name: string;
  pickup_time: string | null;
  pickup_location: string;
  destination_location: string;
  trip_type: string;
  leg_type: string;
  assigned_truck_name: string | null;
  is_completed: boolean;
}

/* ── helpers ── */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function shorten(s: string | null | undefined): string {
  if (!s) return "Unknown";
  // Strip street number and cut at comma for brevity
  return s.replace(/^\d+\s/, "").split(",")[0];
}

function tripTypeBadgeClass(tt: string): string {
  if (tt === "outpatient") return "bg-primary/10 text-primary border-primary/20";
  if (tt === "discharge") return "bg-[hsl(var(--status-green))]/10 text-[hsl(var(--status-green))] border-[hsl(var(--status-green))]/20";
  return "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))] border-[hsl(var(--status-yellow))]/20";
}

function tripTypeLabel(tt: string): string {
  if (tt === "outpatient") return "Outpatient";
  if (tt === "discharge") return "Discharge";
  if (tt === "hospital") return "Hospital";
  if (tt === "private_pay") return "Private Pay";
  return "Ad-hoc";
}

const WINDOW_OPTIONS: { label: string; days: number }[] = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
];

interface Props {
  /** Called when user clicks "Go to day" for a particular date */
  onGoToDay: (date: string) => void;
}

export function UpcomingNonDialysisPanel({ onGoToDay }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [windowDays, setWindowDays] = useState(14);
  const [unassignedOnly, setUnassignedOnly] = useState(true);
  const [legs, setLegs] = useState<UpcomingLeg[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLegs = useCallback(async () => {
    setLoading(true);
    try {
      const today = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`; })();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + windowDays);
      const endStr = endDate.toISOString().split("T")[0];

      // Fetch non-dialysis scheduling legs in window
      const { data: legData } = await supabase
        .from("scheduling_legs")
        .select("id, run_date, patient_id, pickup_time, pickup_location, destination_location, trip_type, leg_type, is_oneoff, oneoff_name, oneoff_pickup_address, oneoff_dropoff_address, patient:patients!scheduling_legs_patient_id_fkey(first_name, last_name, status, pickup_address, dropoff_facility)")
        .neq("trip_type", "dialysis")
        .gte("run_date", today)
        .lte("run_date", endStr)
        .order("run_date")
        .order("pickup_time");

      if (!legData) { setLegs([]); return; }

      // Filter out patients with suppressing statuses
      const activeLegData = legData.filter((l: any) => {
        const status = l.patient?.status;
        return !["in_hospital", "out_of_hospital", "vacation", "paused"].includes(status ?? "");
      });

      if (activeLegData.length === 0) { setLegs([]); return; }

      // Fetch truck slot assignments for those leg ids
      const legIds = activeLegData.map((l: any) => l.id);
      const [{ data: slotData }, { data: tripData }] = await Promise.all([
        supabase
          .from("truck_run_slots")
          .select("leg_id, truck_id, status, truck:trucks!truck_run_slots_truck_id_fkey(name)")
          .in("leg_id", legIds),
        supabase
          .from("trip_records")
          .select("leg_id, status")
          .in("leg_id", legIds),
      ]);

      const slotMap = new Map<string, { truckName: string; slotStatus: string }>();
      for (const s of slotData ?? []) {
        slotMap.set(s.leg_id, {
          truckName: (s as any).truck?.name ?? "Unknown truck",
          slotStatus: (s as any).status ?? "pending",
        });
      }

      const completedLegIds = new Set((tripData ?? []).map((t: any) => t.leg_id));

      // Build display items
      const items: UpcomingLeg[] = activeLegData.map((l: any) => {
        const patientName = l.patient
          ? `${l.patient.first_name} ${l.patient.last_name}`
          : l.oneoff_name || "Unknown";

        const pickup = l.pickup_location
          || l.oneoff_pickup_address
          || l.patient?.pickup_address
          || null;
        const destination = l.destination_location
          || l.oneoff_dropoff_address
          || l.patient?.dropoff_facility
          || null;

        const slot = slotMap.get(l.id);
        const tripStatus = (tripData ?? []).find((t: any) => t.leg_id === l.id)?.status;
        const terminalStatuses = ["completed", "ready_for_billing", "submitted", "paid"];
        const isCompleted = slot?.slotStatus === "completed" || terminalStatuses.includes(tripStatus ?? "");

        return {
          id: l.id,
          run_date: l.run_date,
          patient_name: patientName,
          pickup_time: l.pickup_time,
          pickup_location: pickup,
          destination_location: destination,
          trip_type: l.trip_type,
          leg_type: l.leg_type,
          assigned_truck_name: slot?.truckName ?? null,
          is_completed: isCompleted,
        };
      });

      // Sort: soonest date → earliest pickup → completed last → unassigned first
      items.sort((a, b) => {
        if (a.run_date !== b.run_date) return a.run_date.localeCompare(b.run_date);
        // Completed sinks to bottom
        if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
        const aUnassigned = !a.assigned_truck_name ? 0 : 1;
        const bUnassigned = !b.assigned_truck_name ? 0 : 1;
        if (aUnassigned !== bUnassigned) return aUnassigned - bUnassigned;
        return (a.pickup_time ?? "").localeCompare(b.pickup_time ?? "");
      });

      setLegs(items);
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => { fetchLegs(); }, [fetchLegs]);

  // Real-time sync
  useEffect(() => {
    const channel = supabase
      .channel("upcoming-non-dialysis")
      .on("postgres_changes", { event: "*", schema: "public", table: "scheduling_legs" }, fetchLegs)
      .on("postgres_changes", { event: "*", schema: "public", table: "truck_run_slots" }, fetchLegs)
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_records" }, fetchLegs)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchLegs]);

  const nonCompleted = legs.filter(l => !l.is_completed);
  const displayed = unassignedOnly ? nonCompleted.filter(l => !l.assigned_truck_name) : nonCompleted;
  const unassignedCount = nonCompleted.filter(l => !l.assigned_truck_name).length;
  const totalCount = nonCompleted.length;
  const completedCount = legs.filter(l => l.is_completed).length;

  return (
    <section className="rounded-lg border bg-card overflow-hidden">
      {/* ── Header (always visible) ── */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-[hsl(var(--status-yellow))] shrink-0" />
          <span className="text-sm font-semibold text-foreground">Upcoming Non-Dialysis Transports</span>
          {unassignedCount > 0 && (
            <Badge className="bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))] border-[hsl(var(--status-yellow))]/25 text-[10px] px-1.5 py-0">
              {unassignedCount} unassigned
            </Badge>
          )}
          {totalCount > 0 && !unassignedOnly && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{totalCount} total</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            {loading ? "Loading…" : `Next ${windowDays} days`}
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* ── Expanded body ── */}
      {expanded && (
        <div className="border-t">
          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-muted/20 border-b">
            {/* Window toggles */}
            <div className="flex items-center gap-1">
              {WINDOW_OPTIONS.map(opt => (
                <button
                  key={opt.days}
                  onClick={() => setWindowDays(opt.days)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                    windowDays === opt.days
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Unassigned toggle */}
            <div className="flex items-center gap-1.5">
              <Switch
                id="unassigned-only"
                checked={unassignedOnly}
                onCheckedChange={setUnassignedOnly}
                className="h-4 w-7"
              />
              <Label htmlFor="unassigned-only" className="text-xs cursor-pointer text-muted-foreground">
                Unassigned only
              </Label>
            </div>

            <span className="ml-auto text-[11px] text-muted-foreground">
              {displayed.length === 0 ? "None" : `${displayed.length} run${displayed.length !== 1 ? "s" : ""}`}
            </span>
          </div>

          {/* List */}
          {loading ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : displayed.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              {unassignedOnly
                ? `No unassigned non-dialysis runs in the next ${windowDays} days. 🎉`
                : `No non-dialysis runs in the next ${windowDays} days.`}
            </div>
          ) : (
            <div className="divide-y max-h-[420px] overflow-y-auto">
              {displayed.map(leg => (
                <div
                  key={leg.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/20 transition-colors group"
                >
                  {/* Date */}
                  <div className="w-24 shrink-0">
                    <div className="text-xs font-semibold text-foreground">{formatDate(leg.run_date)}</div>
                    {leg.pickup_time && (
                      <div className="text-[11px] text-muted-foreground">{formatTime(leg.pickup_time)}</div>
                    )}
                  </div>

                  {/* Patient + route */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">{leg.patient_name}</div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <span className="truncate">{shorten(leg.pickup_location)}</span>
                      <ArrowRight className="h-2.5 w-2.5 shrink-0 text-muted-foreground/60" />
                      <span className="truncate">{shorten(leg.destination_location)}</span>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className={`text-[10px] px-1 py-0 ${tripTypeBadgeClass(leg.trip_type)}`}>
                      {tripTypeLabel(leg.trip_type)}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      {leg.leg_type}
                    </Badge>
                    {leg.assigned_truck_name ? (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 max-w-[80px] truncate">
                        {leg.assigned_truck_name}
                      </Badge>
                    ) : (
                      <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] px-1.5 py-0">
                        Unassigned
                      </Badge>
                    )}
                  </div>

                  {/* Go to day */}
                  <button
                    onClick={() => onGoToDay(leg.run_date)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 text-[11px] text-primary hover:underline"
                    title={`Go to ${leg.run_date}`}
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span className="hidden sm:inline">Go</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

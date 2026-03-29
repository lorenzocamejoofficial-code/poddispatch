import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CrewLayout } from "@/components/crew/CrewLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarDays, FileText, Eye, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { format, addDays, startOfDay, isToday, isTomorrow, isYesterday, isBefore, isAfter } from "date-fns";

interface ScheduleRun {
  date: string; // YYYY-MM-DD
  legId: string;
  legType: string;
  patientName: string;
  pickupTime: string | null;
  pickupLocation: string | null;
  destinationLocation: string | null;
  transportType: string | null;
  pcrStatus: string;
  tripId: string | null;
  slotOrder: number;
}

const TRANSPORT_COLORS: Record<string, string> = {
  dialysis: "bg-primary/10 text-primary",
  outpatient: "bg-accent text-accent-foreground",
  ift: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  discharge: "bg-muted text-muted-foreground",
  outpatient_specialty: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
  private_pay: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  emergency: "bg-destructive/10 text-destructive",
};

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, MMM d");
}

function mapLegType(raw: string | null): string {
  if (raw === "a_leg" || raw === "A") return "A";
  if (raw === "b_leg" || raw === "B") return "B";
  return "—";
}

export default function CrewSchedule() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<ScheduleRun[]>([]);
  const [loading, setLoading] = useState(true);

  // Date range: anchor is the start of the visible window
  const today = useMemo(() => startOfDay(new Date()), []);
  const [anchor, setAnchor] = useState(() => addDays(today, -3));

  const RANGE_DAYS = 10; // 3 back + today + 6 forward = 10

  const dateRange = useMemo(() => {
    const dates: string[] = [];
    for (let i = 0; i < RANGE_DAYS; i++) {
      dates.push(format(addDays(anchor, i), "yyyy-MM-dd"));
    }
    return dates;
  }, [anchor]);

  const fetchSchedule = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // 1. Get profile id
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) { setLoading(false); return; }
    const profileId = profile.id;

    const startDate = dateRange[0];
    const endDate = dateRange[dateRange.length - 1];

    // 2. Get crew assignments in range
    const { data: crewRows } = await supabase
      .from("crews")
      .select("id, truck_id, active_date")
      .or(`member1_id.eq.${profileId},member2_id.eq.${profileId}`)
      .gte("active_date", startDate)
      .lte("active_date", endDate);

    if (!crewRows || crewRows.length === 0) { setRuns([]); setLoading(false); return; }

    // 3. For each crew row, get slots + legs + patients + trips
    const allRuns: ScheduleRun[] = [];

    for (const crew of crewRows) {
      const { data: slots } = await supabase
        .from("truck_run_slots")
        .select("id, leg_id, slot_order, run_date")
        .eq("truck_id", crew.truck_id)
        .eq("run_date", crew.active_date);

      if (!slots || slots.length === 0) continue;

      const legIds = slots.map(s => s.leg_id).filter(Boolean) as string[];
      if (legIds.length === 0) continue;

      const { data: legs } = await supabase
        .from("scheduling_legs")
        .select("id, patient_id, leg_type, pickup_time, pickup_location, destination_location, trip_type, is_oneoff, oneoff_name")
        .in("id", legIds);

      if (!legs) continue;

      const patientIds = legs.map(l => l.patient_id).filter(Boolean) as string[];
      const { data: patients } = patientIds.length > 0
        ? await supabase.from("patients").select("id, first_name, last_name").in("id", patientIds)
        : { data: [] };

      const { data: trips } = await supabase
        .from("trip_records")
        .select("id, leg_id, pcr_status")
        .in("leg_id", legIds)
        .eq("run_date", crew.active_date);

      const patientMap = new Map((patients ?? []).map(p => [p.id, p]));
      const tripMap = new Map((trips ?? []).map(t => [t.leg_id, t]));
      const slotMap = new Map(slots.map(s => [s.leg_id, s]));

      for (const leg of legs) {
        const patient = leg.patient_id ? patientMap.get(leg.patient_id) : null;
        const trip = tripMap.get(leg.id);
        const slot = slotMap.get(leg.id);

        allRuns.push({
          date: crew.active_date,
          legId: leg.id,
          legType: mapLegType(leg.leg_type),
          patientName: patient ? `${patient.first_name?.[0] ?? ""}. ${patient.last_name}` : "Unknown",
          pickupTime: leg.pickup_time,
          pickupLocation: leg.pickup_location,
          destinationLocation: leg.destination_location,
          transportType: leg.trip_type,
          pcrStatus: trip?.pcr_status ?? "not_started",
          tripId: trip?.id ?? null,
          slotOrder: slot?.slot_order ?? 0,
        });
      }
    }

    allRuns.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.slotOrder - b.slotOrder;
    });

    setRuns(allRuns);
    setLoading(false);
  }, [user, dateRange]);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

  const grouped = useMemo(() => {
    const map = new Map<string, ScheduleRun[]>();
    for (const d of dateRange) map.set(d, []);
    for (const r of runs) {
      const arr = map.get(r.date);
      if (arr) arr.push(r);
    }
    return map;
  }, [runs, dateRange]);

  const goToToday = () => setAnchor(addDays(today, -3));
  const goPrev = () => setAnchor(prev => addDays(prev, -7));
  const goNext = () => setAnchor(prev => addDays(prev, 7));

  const todayStr = format(today, "yyyy-MM-dd");

  return (
    <CrewLayout>
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {/* Navigation */}
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={goToToday}>
            <CalendarDays className="h-4 w-4" /> Today
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            {dateRange.map(dateStr => {
              const dayRuns = grouped.get(dateStr) ?? [];
              const dateObj = new Date(dateStr + "T12:00:00");
              const isPast = isBefore(dateObj, today) && !isToday(dateObj);
              const isFuture = isAfter(dateObj, today) && !isToday(dateObj);
              const isTodayDate = dateStr === todayStr;

              return (
                <div key={dateStr}>
                  <h3 className={cn(
                    "text-sm font-semibold mb-2 sticky top-0 bg-background py-1 z-10",
                    isTodayDate ? "text-primary" : "text-foreground"
                  )}>
                    {formatDateHeader(dateStr)}
                    <span className="text-xs font-normal text-muted-foreground ml-2">
                      {format(dateObj, "M/d")}
                    </span>
                  </h3>

                  {dayRuns.length === 0 ? (
                    <p className="text-xs text-muted-foreground pl-1">No runs scheduled</p>
                  ) : (
                    <div className="space-y-2">
                      {dayRuns.map(run => (
                        <div
                          key={`${run.date}-${run.legId}`}
                          className={cn(
                            "border border-border rounded-lg bg-card px-4 py-3",
                            isPast && "opacity-60"
                          )}
                        >
                          <div className="flex items-start gap-2">
                            {/* Leg badge */}
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-[10px] px-1.5 py-0 mt-0.5 shrink-0",
                                run.legType === "A" ? "bg-primary/10 text-primary" : run.legType === "B" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" : ""
                              )}
                            >
                              {run.legType}
                            </Badge>

                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{run.patientName}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {run.pickupTime && (
                                  <span className="text-xs text-muted-foreground font-mono">{run.pickupTime}</span>
                                )}
                                {run.transportType && (
                                  <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", TRANSPORT_COLORS[run.transportType])}>
                                    {run.transportType.replace(/_/g, " ")}
                                  </Badge>
                                )}
                              </div>
                              {(run.pickupLocation || run.destinationLocation) && (
                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                  {run.pickupLocation ?? "—"} → {run.destinationLocation ?? "—"}
                                </p>
                              )}
                            </div>

                            {/* PCR Button — today only */}
                            {isTodayDate && (
                              <div className="shrink-0">
                                {run.pcrStatus === "not_started" && (
                                  <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => navigate("/pcr")}>
                                    <FileText className="h-3 w-3" /> Start
                                  </Button>
                                )}
                                {run.pcrStatus === "in_progress" && (
                                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-amber-300 text-amber-700" onClick={() => navigate("/pcr")}>
                                    <FileText className="h-3 w-3" /> Continue
                                  </Button>
                                )}
                                {(run.pcrStatus === "completed" || run.pcrStatus === "submitted") && (
                                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => navigate("/pcr")}>
                                    <Eye className="h-3 w-3" /> View
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* PCR status indicator */}
                          <div className="mt-2 flex items-center gap-1.5">
                            <span className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              run.pcrStatus === "not_started" ? "bg-muted-foreground" :
                              run.pcrStatus === "in_progress" ? "bg-amber-500" :
                              run.pcrStatus === "completed" || run.pcrStatus === "submitted" ? "bg-emerald-500" : "bg-muted-foreground"
                            )} />
                            <span className="text-[10px] text-muted-foreground capitalize">
                              {run.pcrStatus.replace(/_/g, " ")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </CrewLayout>
  );
}

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CrewLayout } from "@/components/crew/CrewLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Eye, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { format, addDays, startOfDay, startOfWeek, isToday } from "date-fns";
import { useCrewPartner } from "@/hooks/useCrewPartner";

interface ScheduleRun {
  date: string;
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

function mapLegType(raw: string | null): string {
  if (raw === "a_leg" || raw === "A") return "A";
  if (raw === "b_leg" || raw === "B") return "B";
  return "—";
}

function DayPicker({ selectedDate, onSelect }: { selectedDate: string; onSelect: (d: string) => void }) {
  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return { date: format(d, "yyyy-MM-dd"), dayName: format(d, "EEE"), dayNum: format(d, "d"), isToday: isToday(d) };
  });

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
      {days.map((d) => (
        <button
          key={d.date}
          onClick={() => onSelect(d.date)}
          className={cn(
            "flex flex-col items-center min-w-[3rem] py-2 px-2 rounded-xl text-xs font-medium transition-colors shrink-0",
            d.date === selectedDate
              ? "bg-primary text-primary-foreground shadow-sm"
              : d.isToday
                ? "bg-primary/10 text-primary"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
          )}
        >
          <span className="text-[10px] uppercase tracking-wide">{d.dayName}</span>
          <span className="text-base font-semibold leading-tight mt-0.5">{d.dayNum}</span>
        </button>
      ))}
    </div>
  );
}

export default function CrewSchedule() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<ScheduleRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => format(startOfDay(new Date()), "yyyy-MM-dd"));

  const fetchSchedule = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) { setLoading(false); return; }

    const { data: crewRows } = await supabase
      .from("crews")
      .select("id, truck_id, active_date")
      .or(`member1_id.eq.${profile.id},member2_id.eq.${profile.id}`)
      .eq("active_date", selectedDate);

    if (!crewRows || crewRows.length === 0) { setRuns([]); setLoading(false); return; }

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

        const patientName = patient
          ? `${patient.first_name?.[0] ?? ""}. ${patient.last_name}`
          : ((leg as any).is_oneoff && (leg as any).oneoff_name)
            ? (leg as any).oneoff_name
            : (leg.pickup_location || "Unknown Patient");

        allRuns.push({
          date: crew.active_date,
          legId: leg.id,
          legType: mapLegType(leg.leg_type),
          patientName,
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

    allRuns.sort((a, b) => a.slotOrder - b.slotOrder);
    setRuns(allRuns);
    setLoading(false);
  }, [user, selectedDate]);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

  const isTodaySelected = selectedDate === format(startOfDay(new Date()), "yyyy-MM-dd");

  return (
    <CrewLayout>
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <DayPicker selectedDate={selectedDate} onSelect={setSelectedDate} />

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : runs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No runs scheduled</p>
        ) : (
          <div className="space-y-2">
            {runs.map(run => (
              <div
                key={`${run.date}-${run.legId}`}
                className="border border-border rounded-lg bg-card px-4 py-3"
              >
                <div className="flex items-start gap-2">
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

                  {isTodaySelected && (
                    <div className="shrink-0">
                      {run.pcrStatus === "not_started" && (
                        <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => navigate("/crew-dashboard", { state: { openPCRForTripId: run.tripId, openPCRForLegId: run.legId } })}>
                          <FileText className="h-3 w-3" /> Start
                        </Button>
                      )}
                      {run.pcrStatus === "in_progress" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-amber-300 text-amber-700" onClick={() => navigate("/crew-dashboard", { state: { openPCRForTripId: run.tripId, openPCRForLegId: run.legId } })}>
                          <FileText className="h-3 w-3" /> Continue
                        </Button>
                      )}
                      {(run.pcrStatus === "completed" || run.pcrStatus === "submitted") && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => navigate("/crew-dashboard", { state: { openPCRForTripId: run.tripId, openPCRForLegId: run.legId } })}>
                          <Eye className="h-3 w-3" /> View
                        </Button>
                      )}
                    </div>
                  )}
                </div>

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
    </CrewLayout>
  );
}

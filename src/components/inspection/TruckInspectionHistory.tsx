import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, AlertTriangle, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  truckId: string;
}

interface DayResult {
  date: string;
  status: "complete" | "has_missing" | "none";
  missing_count: number;
  submitted_by_name: string | null;
}

export function TruckInspectionHistory({ truckId }: Props) {
  const [days, setDays] = useState<DayResult[]>([]);

  useEffect(() => {
    const last7: string[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      last7.push(d.toISOString().split("T")[0]);
    }

    (async () => {
      const { data } = await supabase
        .from("vehicle_inspections" as any)
        .select("run_date, status, missing_count, submitted_by_name")
        .eq("truck_id", truckId)
        .gte("run_date", last7[0])
        .lte("run_date", last7[6]);

      const byDate = new Map<string, any>();
      for (const row of (data ?? []) as any[]) {
        byDate.set(row.run_date, row);
      }

      setDays(last7.map(date => {
        const row = byDate.get(date);
        if (!row) return { date, status: "none" as const, missing_count: 0, submitted_by_name: null };
        return {
          date,
          status: row.status as "complete" | "has_missing",
          missing_count: row.missing_count ?? 0,
          submitted_by_name: row.submitted_by_name,
        };
      }));
    })();
  }, [truckId]);

  if (days.length === 0) return null;

  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div className="flex items-center gap-0.5 pl-6 pt-1">
      <span className="text-[9px] text-muted-foreground mr-1">7d:</span>
      {days.map(day => {
        const dayOfWeek = new Date(day.date + "T12:00:00").getDay();
        const label = dayLabels[dayOfWeek];
        const isToday = day.date === new Date().toISOString().split("T")[0];

        return (
          <Tooltip key={day.date}>
            <TooltipTrigger asChild>
              <div className={`flex flex-col items-center w-5 ${isToday ? "font-bold" : ""}`}>
                <span className="text-[8px] text-muted-foreground leading-none">{label}</span>
                {day.status === "complete" ? (
                  <CheckCircle className="h-3 w-3 text-[hsl(var(--status-green))]" />
                ) : day.status === "has_missing" ? (
                  <AlertTriangle className="h-3 w-3 text-[hsl(var(--status-yellow))]" />
                ) : (
                  <X className="h-3 w-3 text-muted-foreground/30" />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p className="font-medium">{day.date}</p>
              {day.status === "none" && <p className="text-muted-foreground">No inspection</p>}
              {day.status === "complete" && <p className="text-[hsl(var(--status-green))]">Complete — all items OK</p>}
              {day.status === "has_missing" && <p className="text-[hsl(var(--status-yellow))]">{day.missing_count} item(s) flagged</p>}
              {day.submitted_by_name && <p className="text-muted-foreground">By: {day.submitted_by_name}</p>}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

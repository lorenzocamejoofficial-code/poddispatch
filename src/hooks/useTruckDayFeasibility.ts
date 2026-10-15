import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getActiveCompanyId, NO_COMPANY } from "@/lib/company-scope";
import { useSimulationCompanyState } from "@/hooks/useIsSimulationCompany";
import { usePatientTimeStats } from "@/hooks/usePatientTimeStats";
import { MIN_GAP_MINUTES } from "@/lib/time-conflict";
import { normalizeLegType, suggestReturnPickup, EMPTY_STATS } from "@/lib/patient-time-prediction";
import {
  evaluateTruckDay, DEFAULT_TRIP_MINUTES,
  type FeasibilityBuffers, type FeasibilityLeg, type TruckDayFeasibility,
} from "@/lib/schedule-feasibility";

function toMin(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

interface Row {
  truck_id: string;
  slot_order: number;
  leg: any;
}

/** Advisory, read-only per-truck feasibility for one run date. Never writes. */
export function useTruckDayFeasibility(runDate: string, refreshKey: unknown = null): Map<string, TruckDayFeasibility> {
  const { isSim, resolved } = useSimulationCompanyState();
  const [rows, setRows] = useState<Row[]>([]);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    if (!resolved || !runDate) return;
    let cancelled = false;
    (async () => {
      const companyId = (await getActiveCompanyId()) ?? NO_COMPANY;
      const [slotsRes, settingsRes] = await Promise.all([
        supabase.from("truck_run_slots")
          .select("truck_id, leg_id, slot_order, leg:scheduling_legs(id, leg_type, pickup_time, chair_time, estimated_duration_minutes, is_oneoff, oneoff_name, is_simulated, patient_id, patient:patients(first_name, last_name, must_arrive_by, chair_time, chair_time_duration_hours, chair_time_duration_minutes, run_duration_minutes))")
          .eq("company_id", companyId)
          .eq("run_date", runDate),
        supabase.from("company_settings")
          .select("load_time_minutes, unload_time_minutes, grace_window_minutes, enforce_run_gap_minutes, dialysis_b_leg_buffer_minutes")
          .eq("company_id", companyId)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      if (slotsRes.error) { console.error("useTruckDayFeasibility read failed:", slotsRes.error); return; }
      const r = ((slotsRes.data ?? []) as any[])
        .filter((s) => s.leg && (isSim || !s.leg.is_simulated))
        .map((s) => ({ truck_id: s.truck_id, slot_order: s.slot_order ?? 0, leg: s.leg }));
      setRows(r);
      setSettings(settingsRes.data ?? null);
    })();
    return () => { cancelled = true; };
  }, [runDate, isSim, resolved, refreshKey]);

  const patientIds = useMemo(() => rows.map((r) => r.leg.patient_id), [rows]);
  const stats = usePatientTimeStats(patientIds);

  return useMemo(() => {
    const out = new Map<string, TruckDayFeasibility>();
    if (rows.length === 0) return out;
    const b: FeasibilityBuffers = {
      loadMinutes: settings?.load_time_minutes ?? 10,
      unloadMinutes: settings?.unload_time_minutes ?? 10,
      graceMinutes: settings?.grace_window_minutes ?? 15,
      minGapMinutes: settings?.enforce_run_gap_minutes ? MIN_GAP_MINUTES : 0,
    };
    const byTruck = new Map<string, FeasibilityLeg[]>();
    for (const r of rows) {
      const l = r.leg, p = l.patient ?? null;
      const kind = normalizeLegType(l.leg_type);
      const s = (l.patient_id && stats.get(l.patient_id)) || EMPTY_STATS;
      const learned = kind === "A" ? s.durationA.median : kind === "B" ? s.durationB.median : s.durationAll.median;
      const tripMinutes = learned ?? l.estimated_duration_minutes ?? p?.run_duration_minutes ?? DEFAULT_TRIP_MINUTES;
      let predictedReturn: number | null = null;
      if (kind === "B" && p) {
        const planned = ((p.chair_time_duration_hours ?? 0) * 60 + (p.chair_time_duration_minutes ?? 0)) || p.run_duration_minutes || 0;
        const sug = suggestReturnPickup({
          chairTime: p.chair_time, turnaround: s.turnaround, plannedChairMinutes: planned,
          bufferMinutes: settings?.dialysis_b_leg_buffer_minutes ?? undefined,
        });
        predictedReturn = typeof sug.value === "string" ? toMin(sug.value) : null;
      }
      const label = p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() : (l.oneoff_name || "Run");
      const leg: FeasibilityLeg = {
        legId: l.id, label, legKind: kind,
        scheduledPickup: toMin(l.pickup_time),
        predictedReturn,
        mustArriveBy: kind === "A" ? toMin(p?.must_arrive_by ?? p?.chair_time) : null,
        tripMinutes, slotOrder: r.slot_order,
      };
      const arr = byTruck.get(r.truck_id) ?? [];
      arr.push(leg);
      byTruck.set(r.truck_id, arr);
    }
    for (const [truckId, legs] of byTruck) out.set(truckId, evaluateTruckDay(legs, b));
    return out;
  }, [rows, settings, stats]);
}

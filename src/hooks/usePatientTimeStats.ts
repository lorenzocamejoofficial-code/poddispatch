import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getActiveCompanyId, NO_COMPANY } from "@/lib/company-scope";
import { getLocalToday } from "@/lib/local-date";
import { useSimulationCompanyState } from "@/hooks/useIsSimulationCompany";
import {
  computePatientStats, filterTrips, normalizeLegType, EMPTY_STATS, LOOKBACK_DAYS,
  type PatientTimeStats, type TripSample,
} from "@/lib/patient-time-prediction";

// Session cache: `${companyId}|${includeSim}|${patientId}` → stats. Read-only, advisory.
const cache = new Map<string, PatientTimeStats>();

/** Per-patient actual-time stats, computed on read from completed/ready_for_billing trips. */
export function usePatientTimeStats(patientIds: (string | null | undefined)[]): Map<string, PatientTimeStats> {
  const { isSim, resolved } = useSimulationCompanyState();
  const key = useMemo(() => [...new Set(patientIds.filter(Boolean) as string[])].sort().join(","), [patientIds]);
  const [result, setResult] = useState<Map<string, PatientTimeStats>>(new Map());

  useEffect(() => {
    if (!resolved || !key) { setResult(new Map()); return; }
    let cancelled = false;
    (async () => {
      const companyId = (await getActiveCompanyId()) ?? NO_COMPANY;
      const ids = key.split(",");
      const ck = (id: string) => `${companyId}|${isSim}|${id}`;
      const missing = ids.filter((id) => !cache.has(ck(id)));
      if (missing.length) {
        const today = getLocalToday();
        const since = new Date(`${today}T00:00:00Z`);
        since.setUTCDate(since.getUTCDate() - LOOKBACK_DAYS);
        const { data, error } = await supabase
          .from("trip_records")
          .select("patient_id, run_date, status, is_simulated, emergency_upgrade_at, at_scene_time, in_service_time, patient_contact_time, left_scene_time, arrived_dropoff_at, dropped_at, leg:scheduling_legs!trip_records_leg_id_fkey(leg_type)")
          .eq("company_id", companyId)
          .in("patient_id", missing)
          .in("status", ["completed", "ready_for_billing"] as any)
          .gte("run_date", since.toISOString().slice(0, 10))
          .limit(1000);
        if (error) { console.error("usePatientTimeStats read failed:", error); return; }
        const byPatient = new Map<string, TripSample[]>();
        for (const r of (data ?? []) as any[]) {
          const t: TripSample = { ...r, leg_type: normalizeLegType(r.leg?.leg_type) };
          const arr = byPatient.get(r.patient_id) ?? [];
          arr.push(t);
          byPatient.set(r.patient_id, arr);
        }
        for (const id of missing) {
          const trips = filterTrips(byPatient.get(id) ?? [], { includeSimulated: isSim, today });
          cache.set(ck(id), computePatientStats(trips));
        }
      }
      if (!cancelled) setResult(new Map(ids.map((id) => [id, cache.get(ck(id)) ?? EMPTY_STATS])));
    })();
    return () => { cancelled = true; };
  }, [key, isSim, resolved]);

  return result;
}

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

/* ── Shared types ── */
export interface LegDisplay {
  id: string;
  patient_name: string;
  patient_id: string;
  patient_weight: number | null;
  patient_status: string;
  leg_type: string;
  pickup_time: string | null;
  chair_time: string | null;
  pickup_location: string;
  destination_location: string;
  trip_type: string;
  estimated_duration_minutes: number | null;
  notes: string | null;
  assigned_truck_id: string | null;
  // exception override fields
  exception_pickup_time?: string | null;
  exception_pickup_location?: string | null;
  exception_destination_location?: string | null;
  exception_notes?: string | null;
  has_exception?: boolean;
}

export interface PatientOption {
  id: string;
  name: string;
  weight: number | null;
  status: string;
  pickup_address: string | null;
  dropoff_facility: string | null;
  chair_time: string | null;
  run_duration_minutes: number | null;
  schedule_days: string | null;
  notes: string | null;
  transport_type: string;
  recurrence_start_date: string | null;
  recurrence_end_date: string | null;
}

export interface TruckOption { id: string; name: string; }

export interface CrewDisplay {
  id: string;
  truck_id: string;
  member1_name: string | null;
  member2_name: string | null;
}

export interface LegFormState {
  patient_id: string;
  pickup_time: string;
  chair_time: string;
  pickup_location: string;
  destination_location: string;
  trip_type: string;
  estimated_duration_minutes: string;
  notes: string;
}

const emptyForm: LegFormState = {
  patient_id: "", pickup_time: "", chair_time: "",
  pickup_location: "", destination_location: "",
  trip_type: "dialysis", estimated_duration_minutes: "",
  notes: "",
};

/* ── Helper: check if a weekday matches schedule_days ── */
export function matchesScheduleDay(date: string, scheduleDays: string | null): boolean {
  if (!scheduleDays) return false;
  const d = new Date(date + "T12:00:00");
  const dayOfWeek = d.getDay();
  if (scheduleDays === "MWF") return [1, 3, 5].includes(dayOfWeek);
  if (scheduleDays === "TTS") return [2, 4, 6].includes(dayOfWeek);
  return false;
}

/* ── Helper: subtract minutes from a time string ── */
function subtractMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m - minutes;
  const adjTotal = total < 0 ? total + 1440 : total;
  return `${String(Math.floor(adjTotal / 60)).padStart(2, "0")}:${String(adjTotal % 60).padStart(2, "0")}`;
}

/* ── Context shape ── */
interface SchedulingStore {
  selectedDate: string;
  setSelectedDate: (d: string) => void;

  legs: LegDisplay[];
  patients: PatientOption[];
  trucks: TruckOption[];
  crews: CrewDisplay[];
  loading: boolean;

  legForm: LegFormState;
  setLegForm: (f: LegFormState | ((prev: LegFormState) => LegFormState)) => void;
  resetLegForm: () => void;
  pendingLegType: "A" | "B" | null;
  setPendingLegType: (t: "A" | "B" | null) => void;
  dialogOpen: boolean;
  setDialogOpen: (o: boolean) => void;

  addingLeg: { truckId: string; legId: string } | null;
  setAddingLeg: (v: { truckId: string; legId: string } | null) => void;

  refresh: () => void;
  refreshTrucks: () => void;
  autoGenerateLegs: () => Promise<number>;
}

const SchedulingContext = createContext<SchedulingStore | undefined>(undefined);

export function SchedulingProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [legs, setLegs] = useState<LegDisplay[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [trucks, setTrucks] = useState<TruckOption[]>([]);
  const [crews, setCrews] = useState<CrewDisplay[]>([]);
  const [loading, setLoading] = useState(true);

  const [legForm, setLegForm] = useState<LegFormState>(emptyForm);
  const [pendingLegType, setPendingLegType] = useState<"A" | "B" | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addingLeg, setAddingLeg] = useState<{ truckId: string; legId: string } | null>(null);

  const resetLegForm = useCallback(() => setLegForm(emptyForm), []);

  const fetchLegs = useCallback(async () => {
    const [{ data }, { data: slots }, { data: exceptions }] = await Promise.all([
      supabase
        .from("scheduling_legs")
        .select("*, patient:patients!scheduling_legs_patient_id_fkey(first_name, last_name, weight_lbs, status)")
        .eq("run_date", selectedDate)
        .order("pickup_time"),
      supabase
        .from("truck_run_slots")
        .select("leg_id, truck_id")
        .eq("run_date", selectedDate),
      supabase
        .from("leg_exceptions")
        .select("*")
        .eq("run_date", selectedDate),
    ]);

    const slotMap = new Map((slots ?? []).map((s) => [s.leg_id, s.truck_id]));
    const exceptionMap = new Map((exceptions ?? []).map((e: any) => [e.scheduling_leg_id, e]));

    setLegs(
      (data ?? []).map((l: any) => {
        const exc = exceptionMap.get(l.id);
        return {
          id: l.id,
          patient_name: l.patient ? `${l.patient.first_name} ${l.patient.last_name}` : "Unknown",
          patient_id: l.patient_id,
          patient_weight: l.patient?.weight_lbs ?? null,
          patient_status: l.patient?.status ?? "active",
          leg_type: l.leg_type,
          pickup_time: exc?.pickup_time ?? l.pickup_time,
          chair_time: l.chair_time,
          pickup_location: exc?.pickup_location ?? l.pickup_location,
          destination_location: exc?.destination_location ?? l.destination_location,
          trip_type: l.trip_type,
          estimated_duration_minutes: l.estimated_duration_minutes,
          notes: exc?.notes !== undefined ? exc.notes : l.notes,
          assigned_truck_id: slotMap.get(l.id) ?? null,
          exception_pickup_time: exc?.pickup_time ?? null,
          exception_pickup_location: exc?.pickup_location ?? null,
          exception_destination_location: exc?.destination_location ?? null,
          exception_notes: exc?.notes ?? null,
          has_exception: !!exc,
        };
      })
    );
  }, [selectedDate]);

  const fetchOptions = useCallback(async () => {
    const [{ data: p }, { data: t }] = await Promise.all([
      supabase.from("patients").select("id, first_name, last_name, weight_lbs, status, pickup_address, dropoff_facility, chair_time, run_duration_minutes, schedule_days, notes, transport_type, recurrence_start_date, recurrence_end_date").order("last_name"),
      supabase.from("trucks").select("id, name").eq("active", true).order("name"),
    ]);
    setPatients((p ?? []).map((x: any) => ({
      id: x.id,
      name: `${x.first_name} ${x.last_name}`,
      weight: x.weight_lbs,
      status: x.status,
      pickup_address: x.pickup_address,
      dropoff_facility: x.dropoff_facility,
      chair_time: x.chair_time,
      run_duration_minutes: x.run_duration_minutes,
      schedule_days: x.schedule_days,
      notes: x.notes,
      transport_type: x.transport_type ?? "dialysis",
      recurrence_start_date: x.recurrence_start_date,
      recurrence_end_date: x.recurrence_end_date,
    })));
    setTrucks((t ?? []).map((x: any) => ({ id: x.id, name: x.name })));
  }, []);

  const fetchCrews = useCallback(async () => {
    const { data } = await supabase
      .from("crews")
      .select("id, truck_id, member1:profiles!crews_member1_id_fkey(full_name), member2:profiles!crews_member2_id_fkey(full_name)")
      .eq("active_date", selectedDate);
    setCrews((data ?? []).map((c: any) => ({
      id: c.id,
      truck_id: c.truck_id,
      member1_name: c.member1?.full_name ?? null,
      member2_name: c.member2?.full_name ?? null,
    })));
  }, [selectedDate]);

  const refresh = useCallback(() => {
    fetchLegs();
    fetchCrews();
  }, [fetchLegs, fetchCrews]);

  const refreshTrucks = useCallback(() => {
    fetchOptions();
  }, [fetchOptions]);

  const autoGenerateLegs = useCallback(async (): Promise<number> => {
    // Get active patients with recurring transport whose schedule matches selectedDate
    const eligible = patients.filter((p) => {
      if (p.status !== "active") return false;
      if (p.transport_type === "adhoc") return false;
      if (!matchesScheduleDay(selectedDate, p.schedule_days)) return false;
      if (!p.pickup_address || !p.dropoff_facility) return false;
      // Check recurrence window
      if (p.recurrence_start_date && selectedDate < p.recurrence_start_date) return false;
      if (p.recurrence_end_date && selectedDate > p.recurrence_end_date) return false;
      return true;
    });

    if (eligible.length === 0) return 0;

    // Check which patients already have legs for this date
    const { data: existingLegs } = await supabase
      .from("scheduling_legs")
      .select("patient_id")
      .eq("run_date", selectedDate);

    const existingPatientIds = new Set((existingLegs ?? []).map((l) => l.patient_id));

    const newLegs: any[] = [];
    for (const p of eligible) {
      if (existingPatientIds.has(p.id)) continue;

      const duration = p.run_duration_minutes ?? 30;
      const chairTime = p.chair_time ?? null;
      const pickupTime = chairTime ? subtractMinutes(chairTime, duration) : null;

      // A leg: home -> facility
      newLegs.push({
        patient_id: p.id,
        leg_type: "A",
        pickup_time: pickupTime,
        chair_time: chairTime,
        pickup_location: p.pickup_address!,
        destination_location: p.dropoff_facility!,
        trip_type: "dialysis",
        estimated_duration_minutes: duration,
        notes: p.notes || null,
        run_date: selectedDate,
      });

      // B leg: facility -> home (default 3.5h after chair time)
      const treatmentMinutes = 210;
      const bPickupTime = chairTime ? subtractMinutes(chairTime, -treatmentMinutes) : null;

      newLegs.push({
        patient_id: p.id,
        leg_type: "B",
        pickup_time: bPickupTime,
        chair_time: null,
        pickup_location: p.dropoff_facility!,
        destination_location: p.pickup_address!,
        trip_type: "dialysis",
        estimated_duration_minutes: duration,
        notes: p.notes || null,
        run_date: selectedDate,
      });
    }

    if (newLegs.length === 0) return 0;

    const { error } = await supabase.from("scheduling_legs").insert(newLegs as any);
    if (error) {
      console.error("Auto-generate error:", error);
      return 0;
    }

    await fetchLegs();
    return newLegs.length / 2;
  }, [patients, selectedDate, fetchLegs]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchLegs(), fetchOptions(), fetchCrews()]).finally(() => setLoading(false));
  }, [selectedDate, fetchLegs, fetchOptions, fetchCrews]);

  return (
    <SchedulingContext.Provider
      value={{
        selectedDate, setSelectedDate,
        legs, patients, trucks, crews, loading,
        legForm, setLegForm, resetLegForm,
        pendingLegType, setPendingLegType,
        dialogOpen, setDialogOpen,
        addingLeg, setAddingLeg,
        refresh, refreshTrucks, autoGenerateLegs,
      }}
    >
      {children}
    </SchedulingContext.Provider>
  );
}

export function useSchedulingStore() {
  const ctx = useContext(SchedulingContext);
  if (!ctx) throw new Error("useSchedulingStore must be used within SchedulingProvider");
  return ctx;
}

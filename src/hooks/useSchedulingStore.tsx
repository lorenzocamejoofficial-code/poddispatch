import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getLocalToday } from "@/lib/local-date";

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
  slot_order: number | null;
  slot_status: string;
  // exception override fields
  exception_pickup_time?: string | null;
  exception_pickup_location?: string | null;
  exception_destination_location?: string | null;
  exception_notes?: string | null;
  has_exception?: boolean;
  // safety fields
  patient_mobility?: string | null;
  patient_stairs_required?: string | null;
  patient_stair_chair_required?: boolean | null;
  patient_oxygen_required?: boolean | null;
  patient_oxygen_lpm?: number | null;
  patient_special_equipment?: string | null;
  patient_bariatric?: boolean | null;
  // one-off fields
  is_oneoff?: boolean;
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
  recurrence_days: number[] | null;
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
export function matchesScheduleDay(date: string, scheduleDays: string | null, recurrenceDays?: number[] | null): boolean {
  const d = new Date(date + "T12:00:00");
  const dayOfWeek = d.getDay();
  // Check custom recurrence_days first (array of day numbers 1-6)
  if (recurrenceDays && recurrenceDays.length > 0) {
    return recurrenceDays.includes(dayOfWeek);
  }
  if (!scheduleDays) return false;
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
  // Optimistic: directly mutate legs state without a network round-trip
  optimisticUpdateLegs: (updater: (prev: LegDisplay[]) => LegDisplay[]) => void;
}

const SchedulingContext = createContext<SchedulingStore | undefined>(undefined);

export function SchedulingProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState(getLocalToday());
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
        .select("*, patient:patients!scheduling_legs_patient_id_fkey(first_name, last_name, weight_lbs, status, mobility, stairs_required, stair_chair_required, oxygen_required, oxygen_lpm, special_equipment_required, bariatric), is_oneoff, oneoff_name, oneoff_weight_lbs, oneoff_mobility, oneoff_oxygen, oneoff_notes")
        .eq("run_date", selectedDate)
        .order("pickup_time"),
      supabase
        .from("truck_run_slots")
        .select("leg_id, truck_id, slot_order, status")
        .eq("run_date", selectedDate),
      supabase
        .from("leg_exceptions")
        .select("*")
        .eq("run_date", selectedDate),
    ]);

    const slotMap = new Map((slots ?? []).map((s) => [s.leg_id, { truck_id: s.truck_id, slot_order: s.slot_order, status: (s as any).status ?? "pending" }]));
    const exceptionMap = new Map((exceptions ?? []).map((e: any) => [e.scheduling_leg_id, e]));

    setLegs(
      (data ?? []).map((l: any) => {
        const exc = exceptionMap.get(l.id);
        const slot = slotMap.get(l.id);
        const isOneoff = l.is_oneoff ?? false;
        return {
          id: l.id,
          patient_name: isOneoff ? (l.oneoff_name ?? "One-Off") : (l.patient ? `${l.patient.first_name} ${l.patient.last_name}` : "Unknown"),
          patient_id: l.patient_id ?? "",
          patient_weight: isOneoff ? (l.oneoff_weight_lbs ?? null) : (l.patient?.weight_lbs ?? null),
          patient_status: isOneoff ? "active" : (l.patient?.status ?? "active"),
          leg_type: l.leg_type,
          pickup_time: exc?.pickup_time ?? l.pickup_time,
          chair_time: l.chair_time,
          pickup_location: exc?.pickup_location ?? l.pickup_location,
          destination_location: exc?.destination_location ?? l.destination_location,
          trip_type: l.trip_type,
          estimated_duration_minutes: l.estimated_duration_minutes,
          notes: exc?.notes !== undefined ? exc.notes : l.notes,
          assigned_truck_id: slot?.truck_id ?? null,
          slot_order: slot?.slot_order ?? null,
          slot_status: slot?.status ?? "pending",
          exception_pickup_time: exc?.pickup_time ?? null,
          exception_pickup_location: exc?.pickup_location ?? null,
          exception_destination_location: exc?.destination_location ?? null,
          exception_notes: exc?.notes ?? null,
          has_exception: !!exc,
          // Safety-relevant patient fields
          patient_mobility: isOneoff ? (l.oneoff_mobility ?? null) : (l.patient?.mobility ?? null),
          patient_stairs_required: l.patient?.stairs_required ?? null,
          patient_stair_chair_required: l.patient?.stair_chair_required ?? null,
          patient_oxygen_required: isOneoff ? (l.oneoff_oxygen ?? null) : (l.patient?.oxygen_required ?? null),
          patient_oxygen_lpm: l.patient?.oxygen_lpm ?? null,
          patient_special_equipment: l.patient?.special_equipment_required ?? null,
          patient_bariatric: l.patient?.bariatric ?? null,
          is_oneoff: isOneoff,
        };
      })
    );
  }, [selectedDate]);

  const fetchOptions = useCallback(async () => {
    const [{ data: p }, { data: t }] = await Promise.all([
      supabase.from("patients").select("id, first_name, last_name, weight_lbs, status, pickup_address, dropoff_facility, chair_time, run_duration_minutes, schedule_days, notes, transport_type, recurrence_start_date, recurrence_end_date, recurrence_days").order("last_name"),
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
      recurrence_days: x.recurrence_days ?? null,
    })));
    setTrucks((t ?? []).map((x: any) => ({ id: x.id, name: x.name })));
  }, []);

  const fetchCrews = useCallback(async () => {
    const { data } = await supabase
      .from("crews")
      .select("id, truck_id, member1:profiles!crews_member1_id_fkey(full_name), member2:profiles!crews_member2_id_fkey(full_name), member3:profiles!crews_member3_id_fkey(full_name)")
      .eq("active_date", selectedDate);
    setCrews((data ?? []).map((c: any) => ({
      id: c.id,
      truck_id: c.truck_id,
      member1_name: c.member1?.full_name ?? null,
      member2_name: c.member2?.full_name ?? null,
      member3_name: c.member3?.full_name ?? null,
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
    // Resolve company_id for RLS
    const { data: companyId } = await supabase.rpc("get_my_company_id");

    // Get active patients with recurring transport whose schedule matches selectedDate
    const eligible = patients.filter((p) => {
      if (p.status !== "active") return false;
      if (p.transport_type === "adhoc") return false;
      if (!matchesScheduleDay(selectedDate, p.schedule_days, p.recurrence_days)) return false;
      if (!p.pickup_address || !p.dropoff_facility) return false;
      if (p.recurrence_start_date && selectedDate < p.recurrence_start_date) return false;
      if (p.recurrence_end_date && selectedDate > p.recurrence_end_date) return false;
      return true;
    });

    if (eligible.length === 0) return 0;

    const { data: existingLegs } = await supabase
      .from("scheduling_legs")
      .select("patient_id, leg_type")
      .eq("run_date", selectedDate);

    const existingMap = new Map<string, Set<string>>();
    for (const l of existingLegs ?? []) {
      if (!existingMap.has(l.patient_id)) existingMap.set(l.patient_id, new Set());
      existingMap.get(l.patient_id)!.add(l.leg_type);
    }

    const newLegs: any[] = [];
    let patientsAdded = 0;

    for (const p of eligible) {
      const existingLegTypes = existingMap.get(p.id) ?? new Set();
      const isDialysis = p.transport_type === "dialysis";
      const tripType = isDialysis ? "dialysis" : "outpatient";
      const duration = p.run_duration_minutes ?? 30;
      const chairTime = p.chair_time ?? null;

      let addedAny = false;

      if (!existingLegTypes.has("A")) {
        const pickupTime = chairTime ? subtractMinutes(chairTime, duration) : null;
        newLegs.push({
          patient_id: p.id,
          leg_type: "A",
          pickup_time: pickupTime,
          chair_time: chairTime,
          pickup_location: p.pickup_address!,
          destination_location: p.dropoff_facility!,
          trip_type: tripType,
          estimated_duration_minutes: duration,
          notes: p.notes || null,
          run_date: selectedDate,
          company_id: companyId,
        });
        addedAny = true;
      }

      // Issue #8: Auto B-leg for ALL transport types (not just dialysis)
      if (!existingLegTypes.has("B")) {
        if (isDialysis) {
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
            company_id: companyId,
          });
        } else {
          // Non-dialysis: B-leg returns patient from facility to home
          // Estimate B pickup = A pickup + duration + appointment duration (default 60 min)
          const appointmentMinutes = 60;
          const bPickupTime = chairTime
            ? subtractMinutes(chairTime, -(appointmentMinutes))
            : null;
          newLegs.push({
            patient_id: p.id,
            leg_type: "B",
            pickup_time: bPickupTime,
            chair_time: null,
            pickup_location: p.dropoff_facility!,
            destination_location: p.pickup_address!,
            trip_type: tripType,
            estimated_duration_minutes: duration,
            notes: p.notes || null,
            run_date: selectedDate,
            company_id: companyId,
          });
        }
        addedAny = true;
      }

      if (addedAny) patientsAdded++;
    }

    if (newLegs.length === 0) return 0;

    const { error } = await supabase.from("scheduling_legs").insert(newLegs as any);
    if (error) {
      console.error("Auto-generate error:", error);
      return 0;
    }

    await fetchLegs();
    return patientsAdded;
  }, [patients, selectedDate, fetchLegs]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchLegs(), fetchOptions(), fetchCrews()]).finally(() => setLoading(false));

    // Realtime: re-fetch when any scheduling, crew, or trip status data changes
    const channel = supabase
      .channel("scheduling-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "scheduling_legs" }, () => fetchLegs())
      .on("postgres_changes", { event: "*", schema: "public", table: "truck_run_slots" }, () => fetchLegs())
      .on("postgres_changes", { event: "*", schema: "public", table: "leg_exceptions" }, () => fetchLegs())
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_records" }, () => fetchLegs())
      .on("postgres_changes", { event: "*", schema: "public", table: "crews" }, () => fetchCrews())
      .on("postgres_changes", { event: "*", schema: "public", table: "truck_availability" }, () => fetchCrews())
      .on("postgres_changes", { event: "*", schema: "public", table: "trucks" }, () => fetchOptions())
      .on("postgres_changes", { event: "*", schema: "public", table: "patients" }, () => { fetchOptions(); fetchLegs(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedDate, fetchLegs, fetchOptions, fetchCrews]);

  const optimisticUpdateLegs = useCallback(
    (updater: (prev: LegDisplay[]) => LegDisplay[]) => setLegs(updater),
    []
  );

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
        optimisticUpdateLegs,
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

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
}

export interface PatientOption { id: string; name: string; weight: number | null; status: string; }
export interface TruckOption { id: string; name: string; }

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

/* ── Context shape ── */
interface SchedulingStore {
  /* Persisted across tab navigation */
  selectedDate: string;
  setSelectedDate: (d: string) => void;

  legs: LegDisplay[];
  patients: PatientOption[];
  trucks: TruckOption[];
  loading: boolean;

  /* Form state kept alive across navigation */
  legForm: LegFormState;
  setLegForm: (f: LegFormState | ((prev: LegFormState) => LegFormState)) => void;
  resetLegForm: () => void;
  pendingLegType: "A" | "B" | null;
  setPendingLegType: (t: "A" | "B" | null) => void;
  dialogOpen: boolean;
  setDialogOpen: (o: boolean) => void;

  /* Truck builder transient state */
  addingLeg: { truckId: string; legId: string } | null;
  setAddingLeg: (v: { truckId: string; legId: string } | null) => void;

  /* Data operations */
  refresh: () => void;
}

const SchedulingContext = createContext<SchedulingStore | undefined>(undefined);

export function SchedulingProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [legs, setLegs] = useState<LegDisplay[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [trucks, setTrucks] = useState<TruckOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [legForm, setLegForm] = useState<LegFormState>(emptyForm);
  const [pendingLegType, setPendingLegType] = useState<"A" | "B" | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addingLeg, setAddingLeg] = useState<{ truckId: string; legId: string } | null>(null);

  const resetLegForm = useCallback(() => setLegForm(emptyForm), []);

  const fetchLegs = useCallback(async () => {
    const [{ data }, { data: slots }] = await Promise.all([
      supabase
        .from("scheduling_legs")
        .select("*, patient:patients!scheduling_legs_patient_id_fkey(first_name, last_name, weight_lbs, status)")
        .eq("run_date", selectedDate)
        .order("pickup_time"),
      supabase
        .from("truck_run_slots")
        .select("leg_id, truck_id")
        .eq("run_date", selectedDate),
    ]);

    const slotMap = new Map((slots ?? []).map((s) => [s.leg_id, s.truck_id]));

    setLegs(
      (data ?? []).map((l: any) => ({
        id: l.id,
        patient_name: l.patient ? `${l.patient.first_name} ${l.patient.last_name}` : "Unknown",
        patient_id: l.patient_id,
        patient_weight: l.patient?.weight_lbs ?? null,
        patient_status: l.patient?.status ?? "active",
        leg_type: l.leg_type,
        pickup_time: l.pickup_time,
        chair_time: l.chair_time,
        pickup_location: l.pickup_location,
        destination_location: l.destination_location,
        trip_type: l.trip_type,
        estimated_duration_minutes: l.estimated_duration_minutes,
        notes: l.notes,
        assigned_truck_id: slotMap.get(l.id) ?? null,
      }))
    );
  }, [selectedDate]);

  const fetchOptions = useCallback(async () => {
    const [{ data: p }, { data: t }] = await Promise.all([
      supabase.from("patients").select("id, first_name, last_name, weight_lbs, status").order("last_name"),
      supabase.from("trucks").select("id, name").eq("active", true),
    ]);
    setPatients((p ?? []).map((x: any) => ({ id: x.id, name: `${x.first_name} ${x.last_name}`, weight: x.weight_lbs, status: x.status })));
    setTrucks((t ?? []).map((x: any) => ({ id: x.id, name: x.name })));
  }, []);

  const refresh = useCallback(() => {
    fetchLegs();
  }, [fetchLegs]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchLegs(), fetchOptions()]).finally(() => setLoading(false));
  }, [selectedDate, fetchLegs, fetchOptions]);

  return (
    <SchedulingContext.Provider
      value={{
        selectedDate, setSelectedDate,
        legs, patients, trucks, loading,
        legForm, setLegForm, resetLegForm,
        pendingLegType, setPendingLegType,
        dialogOpen, setDialogOpen,
        addingLeg, setAddingLeg,
        refresh,
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

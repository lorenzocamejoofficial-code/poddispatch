// Regular (patient) add-run form → the same consequence check the one-off form uses.
// Advisory only. The run's timing comes from that patient's PCR history when there
// is enough of it (withProspectiveStats → toFeasibilityLeg); otherwise planned/default.
import { toFeasibilityLeg } from "@/hooks/useTruckDayFeasibility";
import type { PatientTimeStats } from "./patient-time-prediction";
import { INTAKE_LEG_ID, withProspectiveStats, type IntakeForm } from "./intake-impact";
import type { FeasibilityLeg } from "./schedule-feasibility";

export interface RegularLegForm {
  patient_id: string; pickup_time: string; chair_time: string;
  pickup_location: string; destination_location: string; trip_type: string;
  estimated_duration_minutes: string; service_level: string;
}
export interface RegularPatient {
  id: string; first_name?: string | null; last_name?: string | null; weight_lbs?: number | null;
  chair_time?: string | null; run_duration_minutes?: number | null;
  chair_time_duration_hours?: number | null; chair_time_duration_minutes?: number | null;
}

export function buildRegularIntake(args: {
  form: RegularLegForm; legType: "A" | "B"; patient: RegularPatient | null;
  boardStats: Map<string, PatientTimeStats>; patientStats: PatientTimeStats | null | undefined;
  settings: any;
}): { timing: FeasibilityLeg; form: IntakeForm } {
  const { form, patient } = args;
  const stats = withProspectiveStats(args.boardStats, form.patient_id || null, args.patientStats);
  const timing = toFeasibilityLeg({
    id: INTAKE_LEG_ID, leg_type: args.legType, pickup_time: form.pickup_time || null,
    estimated_duration_minutes: form.estimated_duration_minutes ? parseInt(form.estimated_duration_minutes) : null,
    patient_id: form.patient_id || null,
    patient: patient
      ? { ...patient, chair_time: form.chair_time || patient.chair_time || null }
      : { first_name: "New run", last_name: "", chair_time: form.chair_time || null },
  }, 0, stats, args.settings);
  return {
    timing,
    // Endpoints are text only here; facility resolution uses the exact-name fallback.
    form: {
      pickup_location: form.pickup_location, destination_location: form.destination_location,
      trip_type: form.trip_type, service_level: form.service_level || "BLS",
      weight_lbs: patient?.weight_lbs != null ? String(patient.weight_lbs) : "",
      mobility: "", oxygen: false, chair_time: form.chair_time,
    },
  };
}

import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PCRCardType } from "@/lib/pcr-dropdowns";

export interface PCRTripData {
  id: string;
  leg_id: string | null;
  patient_id: string | null;
  run_date: string;
  truck_id: string | null;
  crew_id: string | null;
  company_id: string | null;
  status: string;
  pcr_status: string;
  pcr_type: string | null;
  trip_type: string | null;
  pickup_location: string | null;
  destination_location: string | null;
  scheduled_pickup_time: string | null;
  // Times
  dispatch_time: string | null;
  at_scene_time: string | null;
  patient_contact_time: string | null;
  arrived_pickup_at: string | null;
  left_scene_time: string | null;
  arrived_dropoff_at: string | null;
  loaded_at: string | null;
  dropped_at: string | null;
  in_service_time: string | null;
  // PCR fields
  attending_medic_id: string | null;
  attending_medic_name: string | null;
  attending_medic_cert: string | null;
  vitals_json: any[];
  assessment_json: any;
  physical_exam_json: any;
  equipment_used_json: any;
  signatures_json: any[];
  condition_on_arrival: any;
  sending_facility_json: any;
  hospital_outcome_json: any;
  medications_json: any[];
  procedures_json: any[];
  iv_access_json: any[];
  airway_json: any;
  narrative: string | null;
  pcr_completed_at: string | null;
  pcr_submitted_by: string | null;
  chief_complaint: string | null;
  primary_impression: string | null;
  secondary_impressions: any[];
  medical_necessity_reason: string | null;
  level_of_consciousness: string | null;
  skin_condition: string | null;
  patient_position: string | null;
  transport_condition: string | null;
  disposition: string | null;
  crew_updated_fields: any[];
  loaded_miles: number | null;
  // New PCR fields
  vehicle_id: string | null;
  odometer_at_scene: number | null;
  odometer_at_destination: number | null;
  odometer_in_service: number | null;
  stretcher_placement: string | null;
  patient_mobility: string | null;
  isolation_precautions: any;
  necessity_notes: string | null;
  // Kickback fields
  kickback_reasons: string[];
  kickback_note: string | null;
  kicked_back_by: string | null;
  kicked_back_at: string | null;
  // Leg info (joined from scheduling_legs)
  leg_type: string | null;
  chair_time: string | null;
  // Patient info (joined)
  patient?: any;
}

// Per-field debounce map — prevents editing one field from canceling a pending save for another
const fieldSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function usePCRData(tripId: string | null) {
  const [trip, setTrip] = useState<PCRTripData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchTrip = useCallback(async () => {
    if (!tripId) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("trip_records")
      .select("*")
      .eq("id", tripId)
      .maybeSingle();

    if (error) {
      console.error("Trip record fetch error:", error);
      setLoading(false);
      return;
    }

    if (data) {
      // Fetch leg data for leg_type and chair_time
      let leg_type: string | null = null;
      let chair_time: string | null = null;
      if (data.leg_id) {
        const { data: legData, error: legErr } = await supabase
          .from("scheduling_legs")
          .select("leg_type, chair_time")
          .eq("id", data.leg_id)
          .maybeSingle();
        if (legErr) {
          console.error("Scheduling leg fetch error for leg_id", data.leg_id, legErr);
        } else if (legData) {
          leg_type = legData.leg_type ?? null;
          chair_time = legData.chair_time ?? null;
        }
      }

      // Fetch patient data
      let patient = null;
      if (data.patient_id) {
        const { data: pData, error: pErr } = await supabase
          .from("patients")
          .select("*")
          .eq("id", data.patient_id)
          .maybeSingle();
        if (pErr) {
          console.error("Patient fetch error for patient_id", data.patient_id, pErr);
        }
        patient = pData;
      } else {
        console.warn(`Trip ${tripId} has no patient_id — patient info card will be empty`);
      }

      setTrip({
        ...data,
        vitals_json: Array.isArray(data.vitals_json) ? data.vitals_json : [],
        assessment_json: data.assessment_json || {},
        physical_exam_json: data.physical_exam_json || {},
        equipment_used_json: data.equipment_used_json || {},
        signatures_json: Array.isArray(data.signatures_json) ? data.signatures_json : [],
        condition_on_arrival: data.condition_on_arrival || {},
        sending_facility_json: data.sending_facility_json || {},
        hospital_outcome_json: data.hospital_outcome_json || {},
        medications_json: Array.isArray(data.medications_json) ? data.medications_json : [],
        procedures_json: Array.isArray(data.procedures_json) ? data.procedures_json : [],
        iv_access_json: Array.isArray(data.iv_access_json) ? data.iv_access_json : [],
        airway_json: data.airway_json || {},
        secondary_impressions: Array.isArray(data.secondary_impressions) ? data.secondary_impressions : [],
        crew_updated_fields: Array.isArray(data.crew_updated_fields) ? data.crew_updated_fields : [],
        isolation_precautions: data.isolation_precautions || {},
        kickback_reasons: Array.isArray((data as any).kickback_reasons) ? (data as any).kickback_reasons : [],
        kickback_note: (data as any).kickback_note ?? null,
        kicked_back_by: (data as any).kicked_back_by ?? null,
        kicked_back_at: (data as any).kicked_back_at ?? null,
        leg_type,
        chair_time,
        patient,
      } as PCRTripData);
    }
    setLoading(false);
  }, [tripId]);

  useEffect(() => { fetchTrip(); }, [fetchTrip]);

  const updateField = useCallback(async (field: string, value: any) => {
    if (!tripId || !trip) return;

    // Optimistic local update
    setTrip(prev => prev ? { ...prev, [field]: value } : prev);

    // Mark as in_progress if was not_started
    const extraFields: Record<string, any> = {};
    if (trip.pcr_status === "not_started") {
      extraFields.pcr_status = "in_progress";
      setTrip(prev => prev ? { ...prev, pcr_status: "in_progress" } : prev);
    }

    // Per-field debounce — each field has its own independent timer
    const existingTimer = fieldSaveTimers.get(field);
    if (existingTimer) clearTimeout(existingTimer);
    setSaving(true);
    const timer = setTimeout(async () => {
      fieldSaveTimers.delete(field);
      const { error } = await supabase
        .from("trip_records")
        .update({ [field]: value, updated_at: new Date().toISOString(), ...extraFields })
        .eq("id", tripId);
      if (fieldSaveTimers.size === 0) setSaving(false);
      if (error) console.error("PCR auto-save error:", error);
    }, 500);
    fieldSaveTimers.set(field, timer);
  }, [tripId, trip]);

  const updateMultipleFields = useCallback(async (fields: Record<string, any>) => {
    if (!tripId || !trip) return;

    setTrip(prev => prev ? { ...prev, ...fields } : prev);

    const extraFields: Record<string, any> = {};
    if (trip.pcr_status === "not_started") {
      extraFields.pcr_status = "in_progress";
      setTrip(prev => prev ? { ...prev, pcr_status: "in_progress" } : prev);
    }

    // Use a composite key for multi-field saves
    const compositeKey = `__multi_${Object.keys(fields).sort().join("_")}`;
    const existingTimer = fieldSaveTimers.get(compositeKey);
    if (existingTimer) clearTimeout(existingTimer);
    setSaving(true);
    const timer = setTimeout(async () => {
      fieldSaveTimers.delete(compositeKey);
      const { error } = await supabase
        .from("trip_records")
        .update({ ...fields, updated_at: new Date().toISOString(), ...extraFields })
        .eq("id", tripId);
      if (fieldSaveTimers.size === 0) setSaving(false);
      if (error) console.error("PCR auto-save error:", error);
    }, 500);
    fieldSaveTimers.set(compositeKey, timer);
  }, [tripId, trip]);

  // Record a time event and also push status to trip_records for realtime dispatch
  // Idempotency guard: if field already has a value, do not overwrite (prevents double-taps)
  const recordTime = useCallback(async (timeField: string, statusUpdate?: string) => {
    if (!tripId) return;
    // Idempotency: if the field already has a value, skip
    if (trip && (trip as any)[timeField] != null) return;
    const now = new Date().toISOString();
    const { data: { user } } = await supabase.auth.getUser();
    const updates: Record<string, any> = {
      [timeField]: now,
      updated_at: now,
    };
    if (statusUpdate) {
      updates.status = statusUpdate;
      updates.updated_by = user?.id ?? null;
    }
    if (trip?.pcr_status === "not_started") updates.pcr_status = "in_progress";

    setTrip(prev => prev ? { ...prev, [timeField]: now, ...(statusUpdate ? { status: statusUpdate } : {}), pcr_status: prev.pcr_status === "not_started" ? "in_progress" : prev.pcr_status } : prev);

    const { error } = await supabase
      .from("trip_records")
      .update(updates)
      .eq("id", tripId);
    if (error) console.error("Time record error:", error);
  }, [tripId, trip]);

  return { trip, loading, saving, updateField, updateMultipleFields, recordTime, refetch: fetchTrip };
}

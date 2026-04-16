export interface QAFlag {
  trip_id: string;
  company_id: string;
  flag_reason: string;
  severity: "red" | "yellow";
  flag_type: string;
  status: "pending";
}

export interface TripForQA {
  id: string;
  company_id: string | null;
  run_date: string;
  patient_id: string | null;
  dispatch_time: string | null;
  at_scene_time: string | null;
  left_scene_time: string | null;
  arrived_dropoff_at: string | null;
  in_service_time: string | null;
  patient_contact_time: string | null;
  loaded_miles: number | null;
  odometer_at_scene: number | null;
  odometer_at_destination: number | null;
  bed_confined: boolean | null;
  cannot_transfer_safely: boolean | null;
  requires_monitoring: boolean | null;
  oxygen_during_transport: boolean | null;
  signatures_json: any;
  service_level: string | null;
  pcr_type: string | null;
  trip_type: string | null;
  is_unscheduled: boolean | null;
}

interface PatientForQA {
  id: string;
  primary_payer: string | null;
  pcs_on_file: boolean | null;
  pcs_expiration_date: string | null;
}

interface PayerRuleForQA {
  payer_type: string;
  requires_pcs: boolean | null;
}

function push(flags: QAFlag[], tripId: string, companyId: string, reason: string, severity: "red" | "yellow", flagType: string) {
  flags.push({ trip_id: tripId, company_id: companyId, flag_reason: reason, severity, flag_type: flagType, status: "pending" });
}

export function checkTrip(
  trip: TripForQA,
  patient: PatientForQA | null,
  payerRules: PayerRuleForQA[],
  weeklyTripCounts: Map<string, number>,
): QAFlag[] {
  const flags: QAFlag[] = [];
  const cid = trip.company_id ?? "";

  // ═══ RED FLAGS ═══

  const requiredTimes: [string | null | undefined, string, string][] = [
    [trip.dispatch_time, "Dispatch time not recorded. This trip cannot be billed without a documented dispatch time.", "missing_dispatch_time"],
    [trip.at_scene_time, "At Scene time not recorded. Billing requires documentation of when the crew arrived at the pickup location.", "missing_at_scene_time"],
    [trip.left_scene_time, "Left Scene time not recorded. This timestamp is required to calculate transport duration for billing.", "missing_left_scene_time"],
    [trip.arrived_dropoff_at, "Arrival at destination not recorded. Billing requires documentation of when the patient was delivered.", "missing_arrived_dropoff"],
    [trip.in_service_time, "In Service time not recorded. This timestamp is required to close out the transport record.", "missing_in_service_time"],
  ];
  for (const [val, reason, ft] of requiredTimes) {
    if (!val) push(flags, trip.id, cid, reason, "red", ft);
  }

  if (!trip.bed_confined && !trip.cannot_transfer_safely && !trip.requires_monitoring && !trip.oxygen_during_transport) {
    push(flags, trip.id, cid, "No medical necessity criteria selected. Medicare requires at least one criterion to support ambulance-level transport.", "red", "no_medical_necessity");
  }

  const sigs = trip.signatures_json;
  if (!sigs || (Array.isArray(sigs) && sigs.length === 0)) {
    push(flags, trip.id, cid, "No crew signature on the PCR. A signed patient care report is required for billing submission.", "red", "missing_signature");
  }

  if (trip.loaded_miles == null || Number(trip.loaded_miles) === 0) {
    push(flags, trip.id, cid, "Loaded miles not recorded. This trip cannot be billed without documented mileage.", "red", "missing_loaded_miles");
  }

  if (trip.odometer_at_scene == null && trip.odometer_at_destination == null) {
    push(flags, trip.id, cid, "Both odometer readings are missing. At least scene and destination odometer values are required for a completed trip.", "red", "missing_odometers");
  }

  // PCS check — skip for emergency and unscheduled transports
  const isEmergency = (trip.pcr_type ?? trip.trip_type ?? "").toLowerCase() === "emergency";
  const isUnscheduled = !!trip.is_unscheduled;

  if (patient && !isEmergency) {
    const rule = payerRules.find(r => r.payer_type === (patient.primary_payer ?? "default"));
    if (rule?.requires_pcs) {
      if (!patient.pcs_on_file || (patient.pcs_expiration_date && patient.pcs_expiration_date < trip.run_date)) {
        const severity = isUnscheduled ? "yellow" : "red";
        const suffix = isUnscheduled ? " (Same-day unscheduled — may be waived.)" : "";
        push(flags, trip.id, cid, `PCS is missing or expired for this patient. An active Physician Certification Statement is required by the payer for billing.${suffix}`, severity, "pcs_missing_expired");
      }
    }
  }

  // ═══ YELLOW FLAGS ═══

  const sequence: [string | null | undefined, string | null | undefined, string, string][] = [
    [trip.dispatch_time, trip.at_scene_time, "At Scene time is earlier than Dispatch time. Verify that timestamps reflect the actual sequence of events.", "seq_scene_before_dispatch"],
    [trip.at_scene_time, trip.patient_contact_time, "Patient Contact time is earlier than At Scene time. Verify that timestamps reflect the actual sequence of events.", "seq_contact_before_scene"],
    [trip.patient_contact_time, trip.left_scene_time, "Left Scene time is earlier than Patient Contact time. Verify that timestamps reflect the actual sequence of events.", "seq_left_before_contact"],
    [trip.left_scene_time, trip.arrived_dropoff_at, "Arrival at Destination is earlier than Left Scene time. Verify that timestamps reflect the actual sequence of events.", "seq_arrived_before_left"],
    [trip.arrived_dropoff_at, trip.in_service_time, "In Service time is earlier than Arrival at Destination. Verify that timestamps reflect the actual sequence of events.", "seq_inservice_before_arrived"],
  ];
  for (const [before, after, reason, ft] of sequence) {
    if (before && after && new Date(after) < new Date(before)) {
      push(flags, trip.id, cid, reason, "yellow", ft);
    }
  }

  const timestamps = [trip.dispatch_time, trip.at_scene_time, trip.patient_contact_time, trip.left_scene_time, trip.arrived_dropoff_at, trip.in_service_time]
    .filter(Boolean)
    .map(t => new Date(t!).getTime());
  if (timestamps.length >= 3) {
    if (Math.max(...timestamps) - Math.min(...timestamps) < 60_000) {
      push(flags, trip.id, cid, "All recorded timestamps are within 60 seconds of each other. Verify that each time reflects when the event actually occurred rather than being entered simultaneously.", "yellow", "timestamps_simultaneous");
    }
  }

  if (trip.odometer_at_scene != null && trip.odometer_at_destination != null && Number(trip.odometer_at_destination) <= Number(trip.odometer_at_scene)) {
    push(flags, trip.id, cid, `Odometer at destination (${trip.odometer_at_destination}) is less than or equal to odometer at scene (${trip.odometer_at_scene}). Destination reading should be higher than scene reading.`, "yellow", "odometer_reversed");
  }

  if (trip.odometer_at_scene != null && trip.odometer_at_destination != null && trip.loaded_miles != null && Number(trip.odometer_at_destination) > Number(trip.odometer_at_scene)) {
    const odoMiles = Number(trip.odometer_at_destination) - Number(trip.odometer_at_scene);
    if (Math.abs(Number(trip.loaded_miles) - odoMiles) > 2) {
      push(flags, trip.id, cid, `Odometer readings show ${odoMiles.toFixed(1)} miles but loaded miles field shows ${Number(trip.loaded_miles).toFixed(1)}. These values should match within 2 miles.`, "yellow", "mileage_mismatch");
    }
  }

  if (trip.dispatch_time && trip.in_service_time) {
    if (new Date(trip.in_service_time).getTime() - new Date(trip.dispatch_time).getTime() > 8 * 60 * 60 * 1000) {
      push(flags, trip.id, cid, "In Service time is more than 8 hours after Dispatch time. This may indicate retroactive documentation. Verify that times are accurate.", "yellow", "excessive_duration");
    }
  }

  if (trip.patient_id) {
    const otherCount = weeklyTripCounts.get(trip.patient_id) ?? 0;
    if (otherCount >= 3) {
      push(flags, trip.id, cid, `This patient has ${otherCount + 1} completed transports this week. Medicare covers dialysis transport up to 3 times weekly. Additional trips require documented justification.`, "yellow", "weekly_transport_limit");
    }
  }

  return flags;
}

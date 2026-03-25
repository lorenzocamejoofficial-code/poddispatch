export const PCR_TOOLTIPS: Record<string, string> = {
  // Times
  dispatch_time: "Time the crew was notified and dispatched",
  enroute_time: "Time the crew began driving to the pickup location",
  at_scene_time: "Time the crew arrived at the pickup location",
  patient_contact_time: "Time the crew made first contact with the patient",
  left_scene_time: "Time the crew departed the pickup location with the patient",
  arrived_destination_time: "Time the crew arrived at the destination facility",
  in_service_time: "Time the crew cleared the call and became available again",
  odometer_at_scene: "Odometer reading when arriving at pickup. Used to calculate trip mileage",
  odometer_at_destination: "Odometer reading at dropoff. Used to verify loaded miles",
  odometer_in_service: "Odometer reading when back in service",
  vehicle_id: "Unit number or vehicle identifier for this transport",

  // Vitals
  systolic: "Top number of blood pressure. Normal range: 90–120 mmHg",
  diastolic: "Bottom number of blood pressure. Normal range: 60–80 mmHg",
  pulse: "Heart rate in beats per minute. Normal range: 60–100 bpm",
  pulse_quality: "Strength and rhythm of the pulse felt at the wrist or neck",
  spo2: "Oxygen saturation percentage measured by pulse oximeter. Normal: 95–100%",
  resp_rate: "Number of breaths per minute. Normal range: 12–20",
  resp_quality: "Character of the patient's breathing effort and pattern",
  temp: "Body temperature in Fahrenheit. Normal range: 97.0–99.0°F",
  bgl: "Blood glucose level in mg/dL. Normal fasting range: 70–100 mg/dL",
  pain: "Patient-reported pain on a scale of 0 to 10. 0 = no pain, 10 = worst imaginable",
  gcs: "Glasgow Coma Scale — measures level of consciousness via eye, verbal, and motor response. Maximum score is 15",
  gcs_eye: "Eye opening response. 4 = spontaneous, 1 = none",
  gcs_verbal: "Verbal response. 5 = oriented, 1 = none",
  gcs_motor: "Motor response. 6 = follows commands, 1 = none",

  // Assessment
  chief_complaint: "The primary reason the patient requires transport today",
  primary_impression: "The crew's clinical assessment of the patient's main condition",
  acute_symptoms: "Any new or worsening symptoms observed at the time of transport",
  level_of_consciousness: "Patient's awareness and responsiveness at time of contact",
  skin_condition: "Color, temperature, and moisture of the patient's skin",

  // Medical Necessity
  medical_necessity_reason: "The clinical reason that justifies ambulance transport. Required by Medicare and Medicaid for reimbursement",
  necessity_notes: "Additional detail supporting the medical necessity determination",

  // Chair Time
  chair_time: "Time the patient needs to be seated at the dialysis facility. Used to determine the earliest valid return pickup time for the B-leg.",

  // Stretcher & Mobility
  stretcher_placement: "Method used to move the patient onto the stretcher",
  patient_mobility: "How the patient is able to move independently",

  // Isolation
  isolation_required: "Whether the patient requires infection control precautions during transport",
  isolation_type: "The specific pathogen or condition requiring isolation precautions",
  isolation_active: "Whether the isolation condition is currently active or historical",

  // Signatures
  payment_authorization: "Authorizes the transport company to bill Medicare, Medicaid, or insurance on the patient's behalf. Required for all insurance claims",
  receiving_facility_signature: "Confirms the receiving facility accepted the patient and transfer of care was completed",
  crew_attestation: "Crew statement confirming the patient was unable to sign and documents the reason",
  patient_refusal: "Documents that the patient was informed of risks and chose to refuse transport or treatment",
};

export function deriveRunStatus(trip: {
  dispatch_time?: string | null;
  at_scene_time?: string | null;
  patient_contact_time?: string | null;
  left_scene_time?: string | null;
  arrived_dropoff_at?: string | null;
  in_service_time?: string | null;
  pcr_status?: string | null;
}): { label: string; color: string } {
  if (trip.pcr_status === 'submitted') return { label: 'PCR Submitted', color: 'green' };
  if (trip.in_service_time) return { label: 'Run Complete', color: 'green' };
  if (trip.arrived_dropoff_at) return { label: 'At Destination', color: 'blue' };
  if (trip.left_scene_time) return { label: 'En Route to Destination', color: 'blue' };
  if (trip.patient_contact_time) return { label: 'Patient Contact', color: 'amber' };
  if (trip.at_scene_time) return { label: 'On Scene', color: 'amber' };
  if (trip.dispatch_time) return { label: 'Dispatched', color: 'amber' };
  return { label: 'Scheduled', color: 'gray' };
}

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

/** One label per trip_records.status — shared by Trips & Clinical, Scheduling and Home. */
export const TRIP_STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  assigned: "Assigned",
  en_route: "En Route",
  arrived_pickup: "Arrived Pickup",
  loaded: "Loaded",
  arrived_dropoff: "Arrived Dropoff",
  completed: "Completed",
  ready_for_billing: "Ready for Billing",
  cancelled: "Cancelled",
  no_show: "No-Show",
  patient_not_ready: "Patient Not Ready",
  facility_delay: "Facility Delay",
  pending_cancellation: "Pending Cancellation",
};

export function tripStatusLabel(status: string | null | undefined): string | null {
  return status ? TRIP_STATUS_LABELS[status] ?? null : null;
}

/** Trip statuses that mean the run is finished in the field (ready_for_billing and beyond). */
export const FINISHED_TRIP_STATUSES = ["completed", "ready_for_billing"];

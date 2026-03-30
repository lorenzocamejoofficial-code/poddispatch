import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type RunStatus = Database["public"]["Enums"]["run_status"];

const statusConfig: Record<string, { label: string; className: string }> = {
  // run_status values
  pending: { label: "Pending", className: "status-pending" },
  en_route: { label: "En Route", className: "status-green" },
  arrived: { label: "Arrived", className: "status-green" },
  with_patient: { label: "With Patient", className: "status-yellow" },
  transporting: { label: "Transporting", className: "status-yellow" },
  completed: { label: "Completed", className: "status-green" },
  cancelled: { label: "Cancelled", className: "bg-destructive/15 text-destructive" },
  // trip_status values
  scheduled: { label: "Scheduled", className: "status-pending" },
  assigned: { label: "Assigned", className: "status-pending" },
  loaded: { label: "Loaded", className: "status-yellow" },
  ready_for_billing: { label: "Ready for Billing", className: "status-green" },
  arrived_pickup: { label: "At Pickup", className: "status-yellow" },
  arrived_dropoff: { label: "At Dropoff", className: "status-green" },
  no_show: { label: "No Show", className: "bg-destructive/15 text-destructive" },
  patient_not_ready: { label: "Patient Not Ready", className: "status-yellow" },
  facility_delay: { label: "Facility Delay", className: "status-yellow" },
  pending_cancellation: { label: "Pending Cancel", className: "bg-destructive/15 text-destructive" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? { label: status, className: "status-pending" };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}

export function StatusDot({ status }: { status: "green" | "yellow" | "red" }) {
  return (
    <span
      className={cn("inline-block h-2.5 w-2.5 rounded-full", {
        "bg-status-green": status === "green",
        "bg-status-yellow animate-pulse-status": status === "yellow",
        "bg-status-red animate-pulse-status": status === "red",
      })}
    />
  );
}

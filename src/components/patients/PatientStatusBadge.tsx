import { cn } from "@/lib/utils";

type PatientStatus = "active" | "in_hospital" | "out_of_hospital" | "vacation" | "paused";

const statusConfig: Record<PatientStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "status-green" },
  in_hospital: { label: "In Hospital", className: "status-yellow" },
  out_of_hospital: { label: "Out of Hospital", className: "status-pending" },
  vacation: { label: "Vacation", className: "status-pending" },
  paused: { label: "Paused", className: "status-red" },
};

export function PatientStatusBadge({ status }: { status: PatientStatus }) {
  const config = statusConfig[status] ?? statusConfig.active;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", config.className)}>
      {config.label}
    </span>
  );
}

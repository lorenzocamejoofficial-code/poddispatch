import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type RunStatus = Database["public"]["Enums"]["run_status"];

const statusConfig: Record<RunStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "status-pending" },
  en_route: { label: "En Route", className: "status-green" },
  arrived: { label: "Arrived", className: "status-green" },
  with_patient: { label: "With Patient", className: "status-yellow" },
  transporting: { label: "Transporting", className: "status-yellow" },
  completed: { label: "Completed", className: "status-green" },
  cancelled: { label: "Cancelled", className: "bg-destructive/15 text-destructive" },
};

export function StatusBadge({ status }: { status: RunStatus }) {
  const config = statusConfig[status];
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

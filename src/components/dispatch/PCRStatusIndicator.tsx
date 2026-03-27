import { CheckCircle } from "lucide-react";

interface PCRStatusIndicatorProps {
  pcr_status?: string | null;
}

export function PCRStatusIndicator({ pcr_status }: PCRStatusIndicatorProps) {
  if (!pcr_status) return null;

  switch (pcr_status) {
    case "not_started":
      return <p className="text-[10px] text-muted-foreground mt-1">PCR Not Started</p>;
    case "in_progress":
      return <p className="text-[10px] text-[hsl(var(--status-yellow))] font-medium mt-1">PCR In Progress</p>;
    case "completed":
      return <p className="text-[10px] text-[hsl(var(--status-green))] font-medium mt-1">PCR Complete</p>;
    case "submitted":
      return (
        <p className="text-[10px] text-[hsl(var(--status-green))] font-medium mt-1 inline-flex items-center gap-0.5">
          <CheckCircle className="h-2.5 w-2.5" /> PCR Submitted ✓
        </p>
      );
    default:
      return null;
  }
}

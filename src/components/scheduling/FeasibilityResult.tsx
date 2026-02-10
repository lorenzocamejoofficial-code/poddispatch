import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface FeasibilityResultProps {
  type: "acceptable" | "warning" | "reject";
  message: string;
  details?: string;
}

export function FeasibilityResult({ type, message, details }: FeasibilityResultProps) {
  const config = {
    acceptable: { icon: CheckCircle, className: "status-green", label: "Acceptable" },
    warning: { icon: AlertTriangle, className: "status-yellow", label: "Warning" },
    reject: { icon: XCircle, className: "status-red", label: "Conflict" },
  };

  const { icon: Icon, className, label } = config[type];

  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
      type === "reject" ? "border-[hsl(var(--status-red))]/30 bg-[hsl(var(--status-red-bg))]" :
      type === "warning" ? "border-[hsl(var(--status-yellow))]/30 bg-[hsl(var(--status-yellow-bg))]" :
      "border-[hsl(var(--status-green))]/30 bg-[hsl(var(--status-green-bg))]"
    }`}>
      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${
        type === "reject" ? "text-[hsl(var(--status-red))]" :
        type === "warning" ? "text-[hsl(var(--status-yellow))]" :
        "text-[hsl(var(--status-green))]"
      }`} />
      <div>
        <p className="font-medium">{label}: {message}</p>
        {details && <p className="mt-0.5 text-xs text-muted-foreground">{details}</p>}
      </div>
    </div>
  );
}

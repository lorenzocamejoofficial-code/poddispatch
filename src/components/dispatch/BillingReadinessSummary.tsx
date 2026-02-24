import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

type BillingStatus = "clean" | "missing_pcs" | "blocked_auth" | "blocked_other" | "not_ready" | null;

interface BillingReadinessSummaryProps {
  runs: { billing_status?: BillingStatus }[];
}

export function BillingReadinessSummary({ runs }: BillingReadinessSummaryProps) {
  const statusRuns = runs.filter(r => r.billing_status && r.billing_status !== "not_ready");
  if (statusRuns.length === 0) return null;

  const clean = statusRuns.filter(r => r.billing_status === "clean").length;
  const review = statusRuns.filter(r => r.billing_status === "missing_pcs").length;
  const blocked = statusRuns.filter(r => r.billing_status === "blocked_auth" || r.billing_status === "blocked_other").length;

  return (
    <div className="flex items-center gap-3 text-[10px] font-medium mt-2 pt-2 border-t border-border">
      {clean > 0 && (
        <span className="inline-flex items-center gap-0.5 text-[hsl(var(--status-green))]">
          <CheckCircle className="h-3 w-3" /> {clean} clean
        </span>
      )}
      {review > 0 && (
        <span className="inline-flex items-center gap-0.5 text-[hsl(var(--status-yellow))]">
          <AlertTriangle className="h-3 w-3" /> {review} review
        </span>
      )}
      {blocked > 0 && (
        <span className="inline-flex items-center gap-0.5 text-destructive">
          <XCircle className="h-3 w-3" /> {blocked} blocked
        </span>
      )}
    </div>
  );
}

import { DollarSign, RefreshCw, CheckCircle, XCircle, AlertTriangle, ShieldAlert, ArrowRight } from "lucide-react";

type ClaimStatus = "ready_to_bill" | "submitted" | "paid" | "denied" | "needs_correction" | "needs_review";

interface Claim {
  status: ClaimStatus;
  total_charge: number;
  amount_paid?: number | null;
}

interface Props {
  claims: Claim[];
  activeStatus: ClaimStatus;
  onSelect: (status: ClaimStatus) => void;
}

const STAGES: { status: ClaimStatus; label: string; icon: typeof DollarSign; attention?: boolean }[] = [
  { status: "ready_to_bill",    label: "Ready to Bill",    icon: DollarSign },
  { status: "submitted",        label: "Submitted",        icon: RefreshCw },
  { status: "paid",             label: "Paid",             icon: CheckCircle },
  { status: "denied",           label: "Denied",           icon: XCircle, attention: true },
  { status: "needs_correction", label: "Needs Correction", icon: AlertTriangle, attention: true },
  { status: "needs_review",     label: "Needs Review",     icon: ShieldAlert, attention: true },
];

function fmt(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(n)}`;
}

/**
 * Visual 6-stage claim pipeline. Pure presentation — reads counts and dollar
 * totals from the same `claims` array the page already loads. Clicking a
 * stage selects that status tab. Empty stages render grayed-out (never
 * hidden) so the bar's shape stays stable as work flows through. The three
 * "attention" stages pulse softly while they hold > 0 items.
 */
export function BillingPipelineHeader({ claims, activeStatus, onSelect }: Props) {
  const byStatus = new Map<ClaimStatus, { count: number; total: number }>();
  for (const s of STAGES) byStatus.set(s.status, { count: 0, total: 0 });
  for (const c of claims) {
    const bucket = byStatus.get(c.status);
    if (!bucket) continue;
    bucket.count += 1;
    bucket.total += Number(c.total_charge ?? 0);
  }

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Claim Pipeline
        </span>
        <span className="text-[10px] text-muted-foreground">
          PCR submission → payment
        </span>
      </div>
      <div className="flex items-stretch gap-1 overflow-x-auto">
        {STAGES.map((stage, i) => {
          const data = byStatus.get(stage.status) ?? { count: 0, total: 0 };
          const isActive = stage.status === activeStatus;
          const isEmpty = data.count === 0;
          const shouldPulse = !!stage.attention && data.count > 0;
          const Icon = stage.icon;

          return (
            <div key={stage.status} className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onSelect(stage.status)}
                className={`relative flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition-all min-w-[120px] ${
                  isActive
                    ? "border-primary bg-primary/10 shadow-sm"
                    : isEmpty
                      ? "border-border/60 bg-muted/30 text-muted-foreground hover:border-border"
                      : "border-border bg-background hover:border-primary/40 hover:bg-muted/40"
                }`}
              >
                {shouldPulse && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-60" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
                  </span>
                )}
                <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider">
                  <Icon className="h-3 w-3" />
                  {stage.label}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-lg font-bold leading-none ${isEmpty ? "text-muted-foreground/60" : "text-foreground"}`}>
                    {data.count}
                  </span>
                  <span className={`text-[11px] font-medium ${isEmpty ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
                    {fmt(data.total)}
                  </span>
                </div>
              </button>
              {i < STAGES.length - 1 && (
                <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
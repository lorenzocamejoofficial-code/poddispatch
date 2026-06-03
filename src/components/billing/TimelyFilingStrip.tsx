import { useMemo } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { timelyFilingDays } from "@/lib/edi-837p-generator";

interface ClaimLite {
  id: string;
  patient_name?: string;
  run_date: string;
  payer_type: string | null;
  total_charge: number;
  status: string;
}

interface Props {
  claims: ClaimLite[];
  /** Only count statuses where filing still matters. Paid/denied are out. */
  activeStatuses?: string[];
  /** Highlight window in days. Anything inside this many days of the deadline
   *  surfaces in the strip. Past-due always shows. */
  warnWithinDays?: number;
  billingState?: string | null;
  onClickClaim?: (claimId: string) => void;
}

/**
 * Compact, scannable "claims about to age out" strip — surfaces the buried
 * timely-filing logic right above the claims board so billers see at-risk
 * money without having to chase a separate report.
 *
 * Read-only: just highlights. Action lives on the claim card itself.
 */
export function TimelyFilingStrip({
  claims,
  activeStatuses = ["ready_to_bill", "needs_correction", "needs_review", "denied"],
  warnWithinDays = 14,
  billingState = null,
  onClickClaim,
}: Props) {
  const items = useMemo(() => {
    const now = Date.now();
    const out: { c: ClaimLite; daysLeft: number; past: boolean }[] = [];
    for (const c of claims) {
      if (!activeStatuses.includes(c.status)) continue;
      if (!c.run_date || !/^\d{4}-\d{2}-\d{2}$/.test(c.run_date)) continue;
      const limit = timelyFilingDays(c.payer_type, billingState);
      const dos = new Date(c.run_date + "T00:00:00").getTime();
      const deadline = dos + limit * 24 * 60 * 60 * 1000;
      const daysLeft = Math.floor((deadline - now) / (1000 * 60 * 60 * 24));
      if (daysLeft <= warnWithinDays) {
        out.push({ c, daysLeft, past: daysLeft < 0 });
      }
    }
    return out.sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 5);
  }, [claims, activeStatuses, warnWithinDays, billingState]);

  if (items.length === 0) return null;

  const pastCount = items.filter((i) => i.past).length;
  const dollarsAtRisk = items.reduce((s, i) => s + (Number(i.c.total_charge) || 0), 0);

  return (
    <div className="rounded-md border border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/15 px-3 py-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
        <span className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          Timely Filing Watch
          {pastCount > 0 && (
            <span className="ml-1 rounded bg-destructive/15 px-1.5 py-0.5 text-[9px] text-destructive">
              {pastCount} past due
            </span>
          )}
        </span>
        <span className="text-[10px] font-normal text-amber-700/80 dark:text-amber-300/80">
          ${dollarsAtRisk.toFixed(0)} at risk · top {items.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map(({ c, daysLeft, past }) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onClickClaim?.(c.id)}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
              past
                ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15"
                : "border-amber-400/50 bg-amber-100/70 text-amber-900 hover:bg-amber-200/70 dark:bg-amber-900/30 dark:text-amber-200"
            }`}
            title={`${c.patient_name ?? "Unknown"} — DOS ${c.run_date} — $${Number(c.total_charge).toFixed(2)}`}
          >
            <Clock className="h-2.5 w-2.5" />
            <span className="max-w-[8rem] truncate">{c.patient_name ?? "Unknown"}</span>
            <span className="opacity-80">·</span>
            <span>{past ? `${Math.abs(daysLeft)}d over` : `${daysLeft}d left`}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
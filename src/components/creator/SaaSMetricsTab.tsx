import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign, Users, TrendingUp, TrendingDown, Activity,
  AlertTriangle, RefreshCw, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

interface SaaSData {
  mrr: number;
  arr: number;
  arpa: number;
  activeCount: number;
  trialCount: number;
  trialAvgDaysLeft: number;
  churnedThisMonth: number;
  churnRate: number;
  grr: number;
  ltv: number;
  cac: number;
  newBizMrr: number;
  churnMrr: number;
  reactivationMrr: number;
  netMrrChange: number;
}

export function SaaSMetricsTab() {
  const [data, setData] = useState<SaaSData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const [{ data: subs }, { data: cacSetting }] = await Promise.all([
        supabase.from("subscription_records").select("*"),
        supabase.from("creator_settings").select("value").eq("key", "cac_per_customer").maybeSingle(),
      ]);

      const records = subs ?? [];
      const cac = parseFloat(cacSetting?.value ?? "0") || 0;
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Active & trial
      const active = records.filter((r) => r.subscription_status === "active");
      const trials = records.filter((r) => r.subscription_status === "trial");

      // MRR from active + trial
      const payingRecords = [...active, ...trials];
      const mrr = payingRecords.reduce((sum, r) => sum + ((r as any).monthly_amount_cents ?? 59900), 0) / 100;
      const arr = mrr * 12;
      const payingCount = active.length || 1;
      const arpa = active.length > 0 ? mrr / payingCount : 0;

      // Trial avg days left
      let trialAvgDaysLeft = 0;
      if (trials.length > 0) {
        const totalDays = trials.reduce((sum, t) => {
          if ((t as any).trial_ends_at) {
            const daysLeft = Math.max(0, Math.ceil((new Date((t as any).trial_ends_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
            return sum + daysLeft;
          }
          return sum;
        }, 0);
        trialAvgDaysLeft = Math.round(totalDays / trials.length);
      }

      // Churned this month
      const churned = records.filter(
        (r) =>
          (r.subscription_status === "trial_expired" || r.subscription_status === "suspended") &&
          r.updated_at && new Date(r.updated_at) >= thirtyDaysAgo
      );

      const totalAtStart = records.length || 1;
      const churnRate = (churned.length / totalAtStart) * 100;

      // GRR approximation
      const grr = Math.max(0, 100 - churnRate);

      // LTV = ARPA * 0.8 / (churnRate/100) — avoid div by zero
      const ltv = churnRate > 0 ? (arpa * 0.8) / (churnRate / 100) : 0;

      // MRR Movements
      // New biz: companies that became active this month (trial_converted_at or updated_at in this month with status=active)
      const newBiz = active.filter((r) => {
        const updatedAt = new Date(r.updated_at);
        return updatedAt >= monthStart;
      });
      const newBizMrr = newBiz.length * 599; // $599/mo standard plan

      const churnMrr = churned.reduce((sum, r) => sum + (((r as any).monthly_amount_cents ?? 59900) / 100), 0);

      // Reactivation: companies that went from expired back to active this month
      // Approximate: active companies updated this month that aren't "new"
      const reactivationMrr = 0; // Placeholder — needs status history tracking

      const netMrrChange = newBizMrr - churnMrr + reactivationMrr;

      setData({
        mrr, arr, arpa, activeCount: active.length, trialCount: trials.length,
        trialAvgDaysLeft, churnedThisMonth: churned.length, churnRate,
        grr, ltv, cac, newBizMrr, churnMrr, reactivationMrr, netMrrChange,
      });
    } catch (err) {
      console.error("Failed to load SaaS metrics:", err);
    }
    setLoading(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading SaaS metrics...</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Failed to load metrics.</p>;

  const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const fmtDec = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      {/* Revenue Metrics */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Revenue</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard icon={DollarSign} label="MRR" value={fmt(data.mrr)} sub="Monthly Recurring Revenue" color="text-emerald-500" />
          <MetricCard icon={TrendingUp} label="ARR" value={fmt(data.arr)} sub="Annualized Run Rate" color="text-emerald-500" />
          <MetricCard icon={Activity} label="ARPA" value={fmtDec(data.arpa)} sub="Avg Revenue Per Account" color="text-emerald-500" />
        </div>
      </div>

      {/* Customer Metrics */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Customers</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard icon={Users} label="Active" value={String(data.activeCount)} sub="Paying companies" color="text-primary" />
          <MetricCard
            icon={RefreshCw}
            label="Trial"
            value={String(data.trialCount)}
            sub={data.trialCount > 0 ? `~${data.trialAvgDaysLeft}d avg remaining` : "No active trials"}
            color="text-amber-500"
          />
          <MetricCard
            icon={TrendingDown}
            label="Churned (30d)"
            value={String(data.churnedThisMonth)}
            sub="Expired or suspended"
            color={data.churnedThisMonth > 0 ? "text-destructive" : "text-muted-foreground"}
          />
          <MetricCard
            icon={AlertTriangle}
            label="Churn Rate"
            value={`${data.churnRate.toFixed(1)}%`}
            sub="Last 30 days"
            color={data.churnRate > 10 ? "text-destructive" : data.churnRate > 5 ? "text-amber-500" : "text-emerald-500"}
          />
        </div>
      </div>

      {/* Health Metrics */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Health</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">GRR — Gross Revenue Retention</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{data.grr.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Approximation: 100% − Churn Rate. Accurate GRR requires 12+ months of history.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">LTV — Customer Lifetime Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{data.ltv > 0 ? fmt(Math.round(data.ltv)) : "—"}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Formula: ARPA × 0.8 margin ÷ churn rate{data.churnRate === 0 ? " (needs churn data)" : ""}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">CAC — Customer Acquisition Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{fmt(data.cac)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Set in Creator Settings. {data.ltv > 0 && data.cac > 0 ? `LTV:CAC = ${(data.ltv / data.cac).toFixed(1)}x` : "Enter CAC to see LTV:CAC ratio."}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* MRR Movements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> MRR Movements — This Month
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              <MrrRow icon={ArrowUpRight} label="New Business MRR" value={data.newBizMrr} color="text-emerald-500" />
              <MrrRow icon={ArrowUpRight} label="Expansion MRR" value={0} color="text-muted-foreground" note="Requires multiple pricing tiers" />
              <MrrRow icon={ArrowDownRight} label="Contraction MRR" value={0} color="text-muted-foreground" note="Requires multiple pricing tiers" />
              <MrrRow icon={ArrowDownRight} label="Churn MRR" value={-data.churnMrr} color={data.churnMrr > 0 ? "text-destructive" : "text-muted-foreground"} />
              <MrrRow icon={RefreshCw} label="Reactivation MRR" value={data.reactivationMrr} color="text-muted-foreground" note="Requires status history tracking" />
              <tr className="border-t-2">
                <td className="py-3 font-semibold text-foreground" colSpan={2}>Net MRR Change</td>
                <td className={`py-3 text-right font-bold text-lg ${data.netMrrChange >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                  {data.netMrrChange >= 0 ? "+" : ""}{fmt(data.netMrrChange)}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string; sub: string; color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-[10px] text-muted-foreground/70">{sub}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MrrRow({ icon: Icon, label, value, color, note }: {
  icon: any; label: string; value: number; color: string; note?: string;
}) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-2.5">
        <div className="flex items-center gap-2">
          <Icon className={`h-3.5 w-3.5 ${color}`} />
          <span className="text-foreground">{label}</span>
          {note && <Badge variant="outline" className="text-[9px] ml-1">{note}</Badge>}
        </div>
      </td>
      <td className={`py-2.5 text-right font-medium ${color}`}>
        {value === 0 ? "$0" : `${value >= 0 ? "+" : ""}$${Math.abs(value).toLocaleString()}`}
      </td>
    </tr>
  );
}

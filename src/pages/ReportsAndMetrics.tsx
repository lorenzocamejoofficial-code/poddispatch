import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Truck, AlertTriangle, XCircle, CheckCircle, Clock, DollarSign } from "lucide-react";
import { computeAgingBuckets, computeAverageDaysToPayment } from "@/lib/billing-utils";

interface TruckMetric {
  truck_id: string;
  truck_name: string;
  trip_count: number;
}

export default function ReportsAndMetrics() {
  const [range, setRange] = useState("week");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [loading, setLoading] = useState(true);

  const [metrics, setMetrics] = useState({
    trips_total: 0, trips_completed: 0, trips_cancelled: 0,
    revenue_collected: 0, revenue_pending: 0, denial_count: 0,
    not_ready_count: 0, on_time_pct: 0,
  });
  const [truckMetrics, setTruckMetrics] = useState<TruckMetric[]>([]);
  const [topDenialReasons, setTopDenialReasons] = useState<{ reason: string; count: number }[]>([]);
  const [agingBuckets, setAgingBuckets] = useState<ReturnType<typeof computeAgingBuckets>>([]);
  const [avgDaysToPay, setAvgDaysToPay] = useState<number | null>(null);
  const [allClaims, setAllClaims] = useState<any[]>([]);

  const getDateRange = useCallback(() => {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    if (range === "day") return { start: fmt(today), end: fmt(today) };
    if (range === "week") {
      const mon = new Date(today); mon.setDate(today.getDate() - today.getDay() + 1);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { start: fmt(mon), end: fmt(sun) };
    }
    if (range === "month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { start: fmt(start), end: fmt(end) };
    }
    return { start: customStart, end: customEnd };
  }, [range, customStart, customEnd]);

  const fetchMetrics = useCallback(async () => {
    const { start, end } = getDateRange();
    if (!start || !end) return;
    setLoading(true);
    try {
      const [
        { data: trips },
        { data: claims },
        { data: alerts },
        { data: trucks },
        { data: allClaimsData },
      ] = await Promise.all([
        supabase.from("trip_records" as any).select("id, status, truck_id").gte("run_date", start).lte("run_date", end),
        supabase.from("claim_records" as any).select("id, status, total_charge, amount_paid, denial_reason, submitted_at, paid_at").gte("run_date", start).lte("run_date", end),
        supabase.from("operational_alerts" as any).select("id").gte("run_date", start).lte("run_date", end).eq("status", "open"),
        supabase.from("trucks").select("id, name"),
        // All claims for AR aging (not date filtered)
        supabase.from("claim_records" as any).select("id, status, total_charge, submitted_at, paid_at"),
      ]);

      const tripList = (trips ?? []) as any[];
      const claimList = (claims ?? []) as any[];
      const allClaimsList = (allClaimsData ?? []) as any[];

      // Truck metrics
      const truckMap = new Map((trucks ?? []).map((t: any) => [t.id, t.name]));
      const truckTrips = new Map<string, number>();
      tripList.forEach(t => {
        truckTrips.set(t.truck_id, (truckTrips.get(t.truck_id) ?? 0) + 1);
      });
      const tmArr: TruckMetric[] = (trucks ?? []).map((t: any) => ({
        truck_id: t.id,
        truck_name: t.name,
        trip_count: truckTrips.get(t.id) ?? 0,
      })).filter(m => m.trip_count > 0).sort((a, b) => b.trip_count - a.trip_count);

      // Denial reasons
      const reasonMap = new Map<string, number>();
      claimList.filter((c: any) => c.status === "denied" && c.denial_reason).forEach((c: any) => {
        reasonMap.set(c.denial_reason, (reasonMap.get(c.denial_reason) ?? 0) + 1);
      });
      const reasons = Array.from(reasonMap.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const revenue_collected = claimList.filter((c: any) => c.status === "paid").reduce((s: number, c: any) => s + (c.amount_paid ?? 0), 0);
      const revenue_pending = claimList.filter((c: any) => ["ready_to_bill", "submitted"].includes(c.status)).reduce((s: number, c: any) => s + c.total_charge, 0);

      setMetrics({
        trips_total: tripList.length,
        trips_completed: tripList.filter(t => t.status === "completed" || t.status === "ready_for_billing").length,
        trips_cancelled: tripList.filter(t => t.status === "cancelled").length,
        revenue_collected,
        revenue_pending,
        denial_count: claimList.filter((c: any) => c.status === "denied").length,
        not_ready_count: (alerts ?? []).length,
        on_time_pct: tripList.length > 0 ? Math.round((tripList.filter(t => t.status !== "cancelled").length / tripList.length) * 100) : 0,
      });
      setTruckMetrics(tmArr);
      setTopDenialReasons(reasons);

      // AR aging (all time)
      setAgingBuckets(computeAgingBuckets(allClaimsList));
      setAvgDaysToPay(computeAverageDaysToPayment(allClaimsList));
      setAllClaims(allClaimsList);
    } finally {
      setLoading(false);
    }
  }, [getDateRange]);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  const kpis = [
    { label: "Total Trips", value: metrics.trips_total, icon: <Clock className="h-5 w-5" />, color: "text-foreground" },
    { label: "Completed", value: metrics.trips_completed, sub: `${metrics.trips_total > 0 ? Math.round((metrics.trips_completed / metrics.trips_total) * 100) : 0}%`, icon: <CheckCircle className="h-5 w-5" />, color: "text-[hsl(var(--status-green))]" },
    { label: "Cancelled", value: metrics.trips_cancelled, icon: <XCircle className="h-5 w-5" />, color: "text-destructive" },
    { label: "Revenue Collected", value: `$${metrics.revenue_collected.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, icon: <TrendingUp className="h-5 w-5" />, color: "text-[hsl(var(--status-green))]" },
    { label: "Pending A/R", value: `$${metrics.revenue_pending.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, icon: <TrendingUp className="h-5 w-5" />, color: "text-foreground" },
    { label: "Denied Claims", value: metrics.denial_count, icon: <AlertTriangle className="h-5 w-5" />, color: "text-destructive" },
    { label: "Patient Not Ready", value: metrics.not_ready_count, icon: <AlertTriangle className="h-5 w-5" />, color: "text-[hsl(var(--status-yellow))]" },
    { label: "Utilization", value: `${metrics.on_time_pct}%`, sub: "trips completed", icon: <Truck className="h-5 w-5" />, color: "text-primary" },
  ];

  const totalOutstanding = agingBuckets.reduce((s, b) => s + b.total, 0);

  return (
    <AdminLayout>
      <Tabs defaultValue="overview" className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="ar-aging"><DollarSign className="h-3.5 w-3.5 mr-1" />AR Aging</TabsTrigger>
          </TabsList>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          {range === "custom" && (
            <>
              <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-40" />
              <span className="text-muted-foreground text-sm">to</span>
              <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-40" />
            </>
          )}
        </div>

        <TabsContent value="overview" className="m-0 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">Loading metrics…</div>
          ) : (
            <>
              {/* KPI grid */}
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                {kpis.map(k => (
                  <div key={k.label} className="rounded-lg border bg-card p-4 space-y-1">
                    <div className={`${k.color}`}>{k.icon}</div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{k.label}</p>
                    <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                    {k.sub && <p className="text-xs text-muted-foreground">{k.sub}</p>}
                  </div>
                ))}
              </div>

              {/* Truck utilization */}
              {truckMetrics.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trips by Truck</p>
                  <div className="rounded-lg border bg-card overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          <th className="px-4 py-3 text-left">Truck</th>
                          <th className="px-4 py-3 text-right">Trips</th>
                          <th className="px-4 py-3 text-right">Utilization</th>
                        </tr>
                      </thead>
                      <tbody>
                        {truckMetrics.map(tm => (
                          <tr key={tm.truck_id} className="border-b hover:bg-muted/30">
                            <td className="px-4 py-3 font-medium flex items-center gap-2">
                              <Truck className="h-3.5 w-3.5 text-muted-foreground" />{tm.truck_name}
                            </td>
                            <td className="px-4 py-3 text-right">{tm.trip_count}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (tm.trip_count / 10) * 100)}%` }} />
                                </div>
                                <span className="text-xs text-muted-foreground">{Math.min(100, Math.round((tm.trip_count / 10) * 100))}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Top denial reasons */}
              {topDenialReasons.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top Denial Reasons</p>
                  <div className="rounded-lg border bg-card overflow-hidden">
                    {topDenialReasons.map((r, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 border-b last:border-0">
                        <span className="rounded-full bg-destructive/10 text-destructive text-xs font-bold w-6 h-6 flex items-center justify-center shrink-0">{i + 1}</span>
                        <span className="text-sm flex-1 text-foreground">{r.reason}</span>
                        <span className="text-sm font-semibold text-destructive">{r.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* AR Aging Dashboard */}
        <TabsContent value="ar-aging" className="m-0 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">Loading…</div>
          ) : (
            <>
              {/* Hero metric */}
              <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
                <div className="rounded-lg border bg-card p-5 col-span-2 md:col-span-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Outstanding</p>
                  <p className="text-3xl font-bold text-foreground">${totalOutstanding.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="rounded-lg border bg-card p-5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Avg Days to Payment</p>
                  <p className="text-3xl font-bold text-primary">{avgDaysToPay !== null ? `${avgDaysToPay}d` : "—"}</p>
                </div>
                <div className="rounded-lg border bg-card p-5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Open Claims</p>
                  <p className="text-3xl font-bold text-foreground">{agingBuckets.reduce((s, b) => s + b.count, 0)}</p>
                </div>
              </div>

              {/* Aging buckets */}
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                {agingBuckets.map(b => (
                  <div key={b.label} className={`rounded-lg border bg-card p-4 ${
                    b.min >= 91 ? "border-destructive/40" : b.min >= 61 ? "border-[hsl(var(--status-yellow))]/40" : ""
                  }`}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{b.label}</p>
                    <p className={`text-xl font-bold ${
                      b.min >= 91 ? "text-destructive" : b.min >= 61 ? "text-[hsl(var(--status-yellow))]" : "text-foreground"
                    }`}>
                      ${b.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground">{b.count} claim{b.count !== 1 ? "s" : ""}</p>
                  </div>
                ))}
              </div>

              {/* Visual bar */}
              {totalOutstanding > 0 && (
                <div className="rounded-lg border bg-card p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Distribution</p>
                  <div className="flex h-6 rounded-full overflow-hidden bg-muted">
                    {agingBuckets.map((b, i) => {
                      const pct = (b.total / totalOutstanding) * 100;
                      if (pct === 0) return null;
                      const colors = [
                        "bg-[hsl(var(--status-green))]",
                        "bg-primary",
                        "bg-[hsl(var(--status-yellow))]",
                        "bg-destructive",
                      ];
                      return (
                        <div
                          key={b.label}
                          className={`${colors[i]} flex items-center justify-center text-[10px] font-bold text-white`}
                          style={{ width: `${pct}%` }}
                          title={`${b.label}: $${b.total.toFixed(2)}`}
                        >
                          {pct > 8 ? `${Math.round(pct)}%` : ""}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-3 text-[10px]">
                    {agingBuckets.map((b, i) => {
                      const dotColors = [
                        "bg-[hsl(var(--status-green))]",
                        "bg-primary",
                        "bg-[hsl(var(--status-yellow))]",
                        "bg-destructive",
                      ];
                      return (
                        <span key={b.label} className="flex items-center gap-1 text-muted-foreground">
                          <span className={`w-2 h-2 rounded-full ${dotColors[i]}`} />
                          {b.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}

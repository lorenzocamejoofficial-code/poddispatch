import { useEffect, useState, useCallback } from "react";
import { PageLoader } from "@/components/ui/page-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Truck, AlertTriangle, XCircle, CheckCircle, Clock, DollarSign } from "lucide-react";
import { computeAgingBuckets, computeAverageDaysToPayment } from "@/lib/billing-utils";
import { isBLegTooEarly } from "@/lib/dialysis-validation";
import { cn } from "@/lib/utils";

interface TruckMetric {
  truck_id: string;
  truck_name: string;
  trip_count: number;
}

interface DailyTruckMetric {
  truck_id: string;
  truck_name: string;
  on_time_pct: number;
  avg_facility_wait_min: number;
  operational_risk_score: number;
  total_trips: number;
  on_time_count: number;
  late_count: number;
  late_causes: Record<string, number>;
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
  const [dailyTruckMetrics, setDailyTruckMetrics] = useState<DailyTruckMetric[]>([]);

  // KPI state
  const [kpiBilling, setKpiBilling] = useState({ rate: 0, num: 0, den: 0 });
  const [kpiLate, setKpiLate] = useState({ rate: 0, num: 0, den: 0 });
  const [kpiConflict, setKpiConflict] = useState({ rate: 0, num: 0, den: 0 });
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
        { data: dtmData },
      ] = await Promise.all([
        supabase.from("trip_records" as any).select("id, status, truck_id, pcr_status, at_scene_time, leg_id, run_date").gte("run_date", start).lte("run_date", end),
        supabase.from("claim_records" as any).select("id, status, total_charge, amount_paid, denial_reason, submitted_at, paid_at").gte("run_date", start).lte("run_date", end),
        supabase.from("operational_alerts" as any).select("id").gte("run_date", start).lte("run_date", end).eq("status", "open"),
        supabase.from("trucks").select("id, name"),
        // All claims for AR aging (not date filtered)
        supabase.from("claim_records" as any).select("id, status, total_charge, submitted_at, paid_at"),
        // Daily truck metrics for OTP/risk
        supabase.from("daily_truck_metrics" as any).select("*").gte("run_date", start).lte("run_date", end),
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

      // Daily truck metrics
      const dtmList = (dtmData ?? []) as any[];
      const truckNameMap = new Map((trucks ?? []).map((t: any) => [t.id, t.name]));
      // Aggregate across dates per truck
      const dtmAgg = new Map<string, DailyTruckMetric>();
      for (const row of dtmList) {
        const existing = dtmAgg.get(row.truck_id);
        if (!existing) {
          dtmAgg.set(row.truck_id, {
            truck_id: row.truck_id,
            truck_name: truckNameMap.get(row.truck_id) ?? "Unknown",
            on_time_pct: Number(row.on_time_pct),
            avg_facility_wait_min: Number(row.avg_facility_wait_min),
            operational_risk_score: Number(row.operational_risk_score),
            total_trips: Number(row.total_trips),
            on_time_count: Number(row.on_time_count),
            late_count: Number(row.late_count),
            late_causes: row.late_causes ?? {},
          });
        } else {
          // Average across days
          const total = existing.total_trips + Number(row.total_trips);
          existing.on_time_count += Number(row.on_time_count);
          existing.late_count += Number(row.late_count);
          existing.total_trips = total;
          existing.on_time_pct = total > 0 ? Math.round(((existing.on_time_count) / total) * 100) : 0;
          existing.avg_facility_wait_min = Math.round(((existing.avg_facility_wait_min + Number(row.avg_facility_wait_min)) / 2) * 10) / 10;
          existing.operational_risk_score = Math.max(existing.operational_risk_score, Number(row.operational_risk_score));
          for (const [k, v] of Object.entries(row.late_causes ?? {})) {
            existing.late_causes[k] = (existing.late_causes[k] ?? 0) + (v as number);
          }
        }
      }
      setDailyTruckMetrics(Array.from(dtmAgg.values()).sort((a, b) => b.operational_risk_score - a.operational_risk_score));

      // ── KPI calculations ──

      // 1. Billing Complete Rate
      const submittedTrips = tripList.filter(t => t.pcr_status === "submitted");
      const cleanClaims = claimList.filter((c: any) => ["ready_to_bill", "submitted", "paid"].includes(c.status));
      const billingDen = submittedTrips.length;
      const billingNum = cleanClaims.length;
      setKpiBilling({
        rate: billingDen > 0 ? Math.round((billingNum / billingDen) * 100) : 0,
        num: billingNum,
        den: billingDen,
      });

      // 2. Late Pickup Rate — need scheduling_legs for pickup_time
      const tripsWithScene = tripList.filter((t: any) => t.at_scene_time && t.leg_id);
      const legIdsForLate = tripsWithScene.map((t: any) => t.leg_id).filter(Boolean) as string[];
      let lateNum = 0, lateDen = 0;
      if (legIdsForLate.length > 0) {
        // batch in chunks of 50
        const chunks: string[][] = [];
        for (let i = 0; i < legIdsForLate.length; i += 50) chunks.push(legIdsForLate.slice(i, i + 50));
        const allLegs: any[] = [];
        for (const chunk of chunks) {
          const { data: legData } = await supabase.from("scheduling_legs").select("id, pickup_time").in("id", chunk);
          if (legData) allLegs.push(...legData);
        }
        const legTimeMap = new Map(allLegs.map((l: any) => [l.id, l.pickup_time]));

        for (const trip of tripsWithScene) {
          const scheduledTime = legTimeMap.get(trip.leg_id);
          if (!scheduledTime) continue;
          lateDen++;
          // Convert pickup_time (HH:MM) to timestamp on run_date
          const [h, m] = scheduledTime.split(":").map(Number);
          const scheduled = new Date(`${trip.run_date}T00:00:00`);
          scheduled.setHours(h, m, 0, 0);
          const actual = new Date(trip.at_scene_time);
          const diffMin = (actual.getTime() - scheduled.getTime()) / 60000;
          if (diffMin > 15) lateNum++;
        }
      }
      setKpiLate({
        rate: lateDen > 0 ? Math.round((lateNum / lateDen) * 100) : 0,
        num: lateNum,
        den: lateDen,
      });

      // 3. Schedule Conflict Rate — B-legs with early pickup
      const { data: bLegs } = await supabase
        .from("scheduling_legs")
        .select("id, pickup_time, patient_id, leg_type")
        .eq("leg_type", "b_leg" as any);
      const bLegList = (bLegs ?? []) as any[];
      const patientIdsForConflict = [...new Set(bLegList.map((l: any) => l.patient_id).filter(Boolean))] as string[];
      let conflictNum = 0, conflictDen = 0;
      if (patientIdsForConflict.length > 0) {
        const pChunks: string[][] = [];
        for (let i = 0; i < patientIdsForConflict.length; i += 50) pChunks.push(patientIdsForConflict.slice(i, i + 50));
        const allPatients: any[] = [];
        for (const chunk of pChunks) {
          const { data: pd } = await supabase.from("patients").select("id, chair_time, chair_time_duration_hours, chair_time_duration_minutes").in("id", chunk);
          if (pd) allPatients.push(...pd);
        }
        const patientMap = new Map(allPatients.map((p: any) => [p.id, p]));

        for (const leg of bLegList) {
          const patient = leg.patient_id ? patientMap.get(leg.patient_id) : null;
          if (!patient || !patient.chair_time) continue;
          conflictDen++;
          if (isBLegTooEarly(leg.pickup_time, patient.chair_time, patient.chair_time_duration_hours ?? 0, patient.chair_time_duration_minutes ?? 0)) {
            conflictNum++;
          }
        }
      }
      setKpiConflict({
        rate: conflictDen > 0 ? Math.round((conflictNum / conflictDen) * 100) : 0,
        num: conflictNum,
        den: conflictDen,
      });

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
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="otp"><Clock className="h-3.5 w-3.5 mr-1" />OTP & Risk</TabsTrigger>
            <TabsTrigger value="ar-aging"><DollarSign className="h-3.5 w-3.5 mr-1" />AR Aging</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">
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
        </div>

        <TabsContent value="overview" className="m-0 space-y-6">
          {loading ? (
            <PageLoader label="Loading metrics…" />
          ) : (
            <>
              {/* Operational metrics row */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Operational</p>
                <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
                  {[
                    { label: "Total Trips", value: metrics.trips_total, icon: <Clock className="h-5 w-5" />, color: "text-foreground" },
                    { label: "Completed", value: metrics.trips_completed, sub: `${metrics.trips_total > 0 ? Math.round((metrics.trips_completed / metrics.trips_total) * 100) : 0}%`, icon: <CheckCircle className="h-5 w-5" />, color: "text-[hsl(var(--status-green))]" },
                    { label: "Cancelled", value: metrics.trips_cancelled, icon: <XCircle className="h-5 w-5" />, color: "text-destructive" },
                    { label: "Late Pickups", value: kpiLate.num, sub: `${kpiLate.rate}% rate`, icon: <AlertTriangle className="h-5 w-5" />, color: kpiLate.rate > 15 ? "text-destructive" : "text-[hsl(var(--status-yellow))]" },
                    { label: "Schedule Conflicts", value: kpiConflict.num, sub: `${kpiConflict.rate}% rate`, icon: <AlertTriangle className="h-5 w-5" />, color: kpiConflict.rate > 10 ? "text-destructive" : "text-foreground" },
                  ].map(k => (
                    <div key={k.label} className="rounded-lg border bg-card p-4 space-y-1">
                      <div className={`${k.color}`}>{k.icon}</div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">{k.label}</p>
                      <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                      {k.sub && <p className="text-xs text-muted-foreground">{k.sub}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial metrics row */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Financial</p>
                <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
                  {[
                    { label: "Revenue Collected", value: `$${metrics.revenue_collected.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, icon: <TrendingUp className="h-5 w-5" />, color: "text-[hsl(var(--status-green))]" },
                    { label: "Pending A/R", value: `$${metrics.revenue_pending.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, icon: <DollarSign className="h-5 w-5" />, color: "text-foreground" },
                    { label: "Denied Claims", value: metrics.denial_count, icon: <AlertTriangle className="h-5 w-5" />, color: "text-destructive" },
                    { label: "Billing Complete", value: `${kpiBilling.rate}%`, sub: `${kpiBilling.num} of ${kpiBilling.den}`, icon: <CheckCircle className="h-5 w-5" />, color: kpiBilling.rate >= 80 ? "text-[hsl(var(--status-green))]" : "text-[hsl(var(--status-yellow))]" },
                    { label: "Utilization", value: `${metrics.on_time_pct}%`, sub: "trips completed", icon: <Truck className="h-5 w-5" />, color: "text-primary" },
                  ].map(k => (
                    <div key={k.label} className="rounded-lg border bg-card p-4 space-y-1">
                      <div className={`${k.color}`}>{k.icon}</div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">{k.label}</p>
                      <p className={`text-xl font-bold ${k.color}`}>{typeof k.value === "number" ? k.value : k.value}</p>
                      {k.sub && <p className="text-xs text-muted-foreground">{k.sub}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Truck utilization */}
              {truckMetrics.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trips by Truck</p>
                  <div className="rounded-lg border bg-card overflow-x-auto">
                    <table className="w-full text-sm min-w-[500px]">
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

        {/* OTP & Operational Risk */}
        <TabsContent value="otp" className="m-0 space-y-6">
          {loading ? (
            <PageLoader label="Loading performance data…" />
          ) : dailyTruckMetrics.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title="No performance data"
              description="No on-time performance data for this period. Run a simulation to populate metrics."
            />
          ) : (
            <>
              {/* OTP Summary KPIs */}
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Avg On-Time %</p>
                  <p className={`text-2xl font-bold ${
                    dailyTruckMetrics.reduce((s, d) => s + d.on_time_pct, 0) / dailyTruckMetrics.length >= 80
                      ? "text-[hsl(var(--status-green))]" : "text-destructive"
                  }`}>
                    {Math.round(dailyTruckMetrics.reduce((s, d) => s + d.on_time_pct, 0) / dailyTruckMetrics.length)}%
                  </p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Avg Facility Wait</p>
                  <p className="text-2xl font-bold text-foreground">
                    {(dailyTruckMetrics.reduce((s, d) => s + d.avg_facility_wait_min, 0) / dailyTruckMetrics.length).toFixed(1)}m
                  </p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Max Risk Score</p>
                  <p className={`text-2xl font-bold ${
                    Math.max(...dailyTruckMetrics.map(d => d.operational_risk_score)) > 50
                      ? "text-destructive" : "text-foreground"
                  }`}>
                    {Math.max(...dailyTruckMetrics.map(d => d.operational_risk_score))}
                  </p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Late</p>
                  <p className="text-2xl font-bold text-destructive">
                    {dailyTruckMetrics.reduce((s, d) => s + d.late_count, 0)}
                  </p>
                </div>
              </div>

              {/* Per-truck OTP table */}
              <div className="rounded-lg border bg-card overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3 text-left">Truck</th>
                      <th className="px-4 py-3 text-right">Trips</th>
                      <th className="px-4 py-3 text-right">On-Time %</th>
                      <th className="px-4 py-3 text-right">Late</th>
                      <th className="px-4 py-3 text-right">Avg Wait</th>
                      <th className="px-4 py-3 text-right">Risk Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyTruckMetrics.map(dtm => (
                      <tr key={dtm.truck_id} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium flex items-center gap-2">
                          <Truck className="h-3.5 w-3.5 text-muted-foreground" />{dtm.truck_name}
                        </td>
                        <td className="px-4 py-3 text-right">{dtm.total_trips}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={dtm.on_time_pct >= 80 ? "text-[hsl(var(--status-green))]" : "text-destructive"}>
                            {dtm.on_time_pct}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-destructive">{dtm.late_count}</td>
                        <td className="px-4 py-3 text-right">{dtm.avg_facility_wait_min}m</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex items-center justify-center w-8 h-6 rounded text-xs font-bold ${
                            dtm.operational_risk_score > 50 ? "bg-destructive/10 text-destructive" :
                            dtm.operational_risk_score > 25 ? "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]" :
                            "bg-[hsl(var(--status-green))]/10 text-[hsl(var(--status-green))]"
                          }`}>
                            {dtm.operational_risk_score}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Late cause breakdown */}
              {(() => {
                const allCauses: Record<string, number> = {};
                dailyTruckMetrics.forEach(d => {
                  for (const [k, v] of Object.entries(d.late_causes)) {
                    allCauses[k] = (allCauses[k] ?? 0) + v;
                  }
                });
                const sorted = Object.entries(allCauses).sort(([,a], [,b]) => b - a);
                if (sorted.length === 0) return null;
                return (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Late Root Causes</p>
                    <div className="rounded-lg border bg-card overflow-hidden">
                      {sorted.map(([cause, count], i) => (
                        <div key={cause} className="flex items-center gap-3 px-4 py-3 border-b last:border-0">
                          <span className="rounded-full bg-destructive/10 text-destructive text-xs font-bold w-6 h-6 flex items-center justify-center shrink-0">{i + 1}</span>
                          <span className="text-sm flex-1 text-foreground">{cause.replace(/_/g, " ")}</span>
                          <span className="text-sm font-semibold text-destructive">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </TabsContent>

        {/* AR Aging Dashboard */}
        <TabsContent value="ar-aging" className="m-0 space-y-6">
          {loading ? (
            <PageLoader label="Loading AR aging…" />
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

interface KpiCardProps {
  label: string;
  subtitle: string;
  value: number;
  num: number;
  den: number;
  unit: string;
  greenIf: (v: number) => boolean;
  amberIf: (v: number) => boolean;
  invertColors?: boolean; // for metrics where lower is better
}

function KpiCard({ label, subtitle, value, num, den, unit, greenIf, amberIf }: KpiCardProps) {
  const isGreen = greenIf(value);
  const isAmber = !isGreen && amberIf(value);
  const isRed = !isGreen && !isAmber;

  const colorClass = isGreen
    ? "text-emerald-600 dark:text-emerald-400"
    : isAmber
    ? "text-amber-600 dark:text-amber-400"
    : "text-destructive";

  const bgClass = isGreen
    ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-950/20"
    : isAmber
    ? "border-amber-200 bg-amber-50/50 dark:border-amber-800/40 dark:bg-amber-950/20"
    : "border-destructive/30 bg-destructive/5";

  return (
    <div className={cn("rounded-xl border-2 p-6 space-y-2 transition-colors", bgClass)}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("text-5xl font-bold tabular-nums tracking-tight", colorClass)}>
        {value}%
      </p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
      <p className="text-sm font-medium text-foreground pt-1">
        {num} of {den} {unit}
      </p>
    </div>
  );
}

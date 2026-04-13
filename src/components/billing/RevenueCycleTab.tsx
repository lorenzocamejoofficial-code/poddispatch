import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChartContainer } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import { getDenialTranslation } from "@/lib/denial-code-translations";
import { DollarSign, TrendingUp, AlertTriangle, Shield } from "lucide-react";

interface ClaimRecord {
  id: string;
  total_charge: number;
  amount_paid: number | null;
  status: string;
  submitted_at: string | null;
  paid_at: string | null;
  denial_code: string | null;
  denial_reason: string | null;
  payer_type: string;
  payer_name: string | null;
  adjustment_codes?: string[] | null;
  patient_secondary_payer?: string | null;
  secondary_claim_generated?: boolean;
  patient_responsibility_amount?: number | null;
}

interface RevenueCycleTabProps {
  claims: ClaimRecord[];
}

export function RevenueCycleTab({ claims }: RevenueCycleTabProps) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const thisMonthClaims = useMemo(
    () => claims.filter(c => new Date(c.paid_at || c.submitted_at || c.submitted_at || `${c.run_date ?? new Date().toISOString().slice(0, 10)}T00:00:00`) >= monthStart),
    [claims, monthStart]
  );

  // Summary metrics
  const totalBilled = thisMonthClaims.reduce((s, c) => s + c.total_charge, 0);
  const totalCollected = thisMonthClaims.filter(c => c.status === "paid").reduce((s, c) => s + (c.amount_paid ?? 0), 0);
  const totalPending = thisMonthClaims.filter(c => c.status === "submitted" || c.status === "ready_to_bill").reduce((s, c) => s + c.total_charge, 0);
  const totalDenied = thisMonthClaims.filter(c => c.status === "denied").reduce((s, c) => s + c.total_charge, 0);
  const collectionRate = totalBilled > 0 ? ((totalCollected / totalBilled) * 100).toFixed(1) : "0.0";
  const deniedCount = thisMonthClaims.filter(c => c.status === "denied").length;
  const denialRate = thisMonthClaims.length > 0 ? ((deniedCount / thisMonthClaims.length) * 100).toFixed(1) : "0.0";

  // AR Aging
  const arAging = useMemo(() => {
    const submitted = claims.filter(c => c.submitted_at && c.status === "submitted");
    const buckets = [
      { label: "0–30 days", min: 0, max: 30, count: 0, amount: 0, color: "hsl(var(--status-green))" },
      { label: "31–60 days", min: 31, max: 60, count: 0, amount: 0, color: "hsl(var(--status-yellow))" },
      { label: "61–90 days", min: 61, max: 90, count: 0, amount: 0, color: "hsl(38, 80%, 40%)" },
      { label: "90+ days", min: 91, max: 9999, count: 0, amount: 0, color: "hsl(var(--status-red))" },
    ];
    submitted.forEach(c => {
      const days = Math.floor((now.getTime() - new Date(c.submitted_at!).getTime()) / 86400000);
      const bucket = buckets.find(b => days >= b.min && days <= b.max);
      if (bucket) { bucket.count++; bucket.amount += c.total_charge; }
    });
    return buckets;
  }, [claims, now]);

  // Denial breakdown
  const denialBreakdown = useMemo(() => {
    const map = new Map<string, { code: string; count: number; amount: number }>();
    claims.filter(c => c.status === "denied" && c.denial_code).forEach(c => {
      const code = c.denial_code!;
      const existing = map.get(code) || { code, count: 0, amount: 0 };
      existing.count++;
      existing.amount += c.total_charge;
      map.set(code, existing);
    });
    // Also parse adjustment_codes
    claims.forEach(c => {
      (c.adjustment_codes ?? []).forEach(code => {
        if (!map.has(code)) {
          const existing = map.get(code) || { code, count: 0, amount: 0 };
          existing.count++;
          existing.amount += 0;
          map.set(code, existing);
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [claims]);

  // Payer performance
  const payerPerformance = useMemo(() => {
    const map = new Map<string, { payer: string; billed: number; collected: number; deniedCount: number; totalCount: number; daysToPay: number[]; }>();
    claims.forEach(c => {
      const payer = c.payer_type || "unknown";
      const existing = map.get(payer) || { payer, billed: 0, collected: 0, deniedCount: 0, totalCount: 0, daysToPay: [] };
      existing.billed += c.total_charge;
      existing.totalCount++;
      if (c.status === "paid") {
        existing.collected += c.amount_paid ?? 0;
        if (c.submitted_at && c.paid_at) {
          const days = Math.floor((new Date(c.paid_at).getTime() - new Date(c.submitted_at).getTime()) / 86400000);
          existing.daysToPay.push(days);
        }
      }
      if (c.status === "denied") existing.deniedCount++;
      map.set(payer, existing);
    });
    return Array.from(map.values()).map(p => ({
      payer: p.payer,
      billed: p.billed,
      collected: p.collected,
      collectionRate: p.billed > 0 ? ((p.collected / p.billed) * 100).toFixed(1) : "0.0",
      denialRate: p.totalCount > 0 ? ((p.deniedCount / p.totalCount) * 100).toFixed(1) : "0.0",
      avgDaysToPay: p.daysToPay.length > 0 ? Math.round(p.daysToPay.reduce((a, b) => a + b, 0) / p.daysToPay.length) : null,
    }));
  }, [claims]);

  // Revenue trend (last 6 months)
  const revenueTrend = useMemo(() => {
    const months: { month: string; collected: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
      const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const collected = claims
        .filter(c => c.status === "paid" && c.paid_at && new Date(c.paid_at) >= d && new Date(c.paid_at) < nextMonth)
        .reduce((s, c) => s + (c.amount_paid ?? 0), 0);
      months.push({ month: label, collected });
    }
    return months;
  }, [claims, now]);

  // Secondary opportunities
  const secondaryOpp = useMemo(() => {
    const eligible = claims.filter(c => c.status === "paid" && c.patient_secondary_payer && !c.secondary_claim_generated);
    const totalRecoverable = eligible.reduce((s, c) => s + (c.patient_responsibility_amount ?? 0), 0);
    return { count: eligible.length, amount: totalRecoverable };
  }, [claims]);

  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      {/* Summary Row */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Total Billed", value: `$${fmt(totalBilled)}`, color: "text-foreground" },
          { label: "Total Collected", value: `$${fmt(totalCollected)}`, color: "text-[hsl(var(--status-green))]" },
          { label: "Pending", value: `$${fmt(totalPending)}`, color: "text-[hsl(var(--status-yellow))]" },
          { label: "Total Denied", value: `$${fmt(totalDenied)}`, color: "text-destructive" },
          { label: "Collection Rate", value: `${collectionRate}%`, color: parseFloat(collectionRate) >= 80 ? "text-[hsl(var(--status-green))]" : "text-destructive" },
          { label: "Denial Rate", value: `${denialRate}%`, color: parseFloat(denialRate) > 10 ? "text-destructive" : parseFloat(denialRate) > 5 ? "text-[hsl(var(--status-yellow))]" : "text-[hsl(var(--status-green))]" },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-lg border bg-card p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{kpi.label}</p>
            <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">This month</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* AR Aging Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              A/R Aging
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={arAging} barSize={36}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => [`$${fmt(value)}`, "Amount"]}
                    labelFormatter={l => l}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-2">
              {arAging.map(b => (
                <div key={b.label} className="text-center flex-1">
                  <div className="h-2 rounded-full mb-1" style={{ backgroundColor: b.color }} />
                  <p className="text-[10px] text-muted-foreground">{b.count} claims</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Revenue Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Revenue Trend (6 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => [`$${fmt(value)}`, "Collected"]} />
                  <Line type="monotone" dataKey="collected" stroke="hsl(var(--status-green))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Denial Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            Denial Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {denialBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No denials recorded</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Code</TableHead>
                    <TableHead className="text-xs">Explanation</TableHead>
                    <TableHead className="text-xs text-right">Claims</TableHead>
                    <TableHead className="text-xs text-right">Amount</TableHead>
                    <TableHead className="text-xs text-center">Recoverable</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {denialBreakdown.map(d => {
                    const translation = getDenialTranslation(d.code);
                    return (
                      <TableRow key={d.code}>
                        <TableCell className="text-xs font-mono font-medium">{d.code}</TableCell>
                        <TableCell className="text-xs max-w-[300px]">
                          {translation?.plain_english_explanation ?? "Unknown denial code"}
                        </TableCell>
                        <TableCell className="text-xs text-right">{d.count}</TableCell>
                        <TableCell className="text-xs text-right font-medium">${fmt(d.amount)}</TableCell>
                        <TableCell className="text-center">
                          {translation?.is_recoverable ? (
                            <Badge variant="outline" className="text-[10px] border-[hsl(var(--status-green))]/40 text-[hsl(var(--status-green))]">Yes</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">No</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payer Performance */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Payer Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Payer</TableHead>
                  <TableHead className="text-xs text-right">Avg Days to Pay</TableHead>
                  <TableHead className="text-xs text-right">Total Billed</TableHead>
                  <TableHead className="text-xs text-right">Total Collected</TableHead>
                  <TableHead className="text-xs text-right">Collection Rate</TableHead>
                  <TableHead className="text-xs text-right">Denial Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payerPerformance.map(p => (
                  <TableRow key={p.payer}>
                    <TableCell className="text-xs font-medium capitalize">{p.payer}</TableCell>
                    <TableCell className="text-xs text-right">{p.avgDaysToPay !== null ? `${p.avgDaysToPay}d` : "—"}</TableCell>
                    <TableCell className="text-xs text-right">${fmt(p.billed)}</TableCell>
                    <TableCell className="text-xs text-right">${fmt(p.collected)}</TableCell>
                    <TableCell className="text-xs text-right">
                      <span className={parseFloat(p.collectionRate) >= 80 ? "text-[hsl(var(--status-green))]" : "text-destructive"}>
                        {p.collectionRate}%
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      <span className={parseFloat(p.denialRate) > 10 ? "text-destructive" : "text-foreground"}>
                        {p.denialRate}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Secondary Opportunities */}
      {secondaryOpp.count > 0 && (
        <Card className="border-[hsl(var(--status-yellow))]/30 bg-[hsl(var(--status-yellow-bg))]">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {secondaryOpp.count} Secondary Insurance {secondaryOpp.count === 1 ? "Opportunity" : "Opportunities"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Potentially recoverable: <span className="font-bold text-foreground">${fmt(secondaryOpp.amount)}</span>
                </p>
              </div>
              <Badge className="bg-[hsl(var(--status-yellow))] text-white">${fmt(secondaryOpp.amount)}</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

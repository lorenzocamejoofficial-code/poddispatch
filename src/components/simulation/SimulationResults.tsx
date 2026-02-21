import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  CheckCircle2, AlertTriangle, XCircle, TrendingUp, DollarSign,
  Truck, FileText, BarChart3, ArrowLeft, Activity, ShieldCheck, Zap,
} from "lucide-react";
import type { SimulationResult, CompanyProfile } from "@/lib/simulation-engine";

interface SimulationResultsProps {
  result: SimulationResult;
  profile: CompanyProfile;
  onReset: () => void;
}

function VerdictIcon({ verdict }: { verdict: "green" | "yellow" | "red" }) {
  if (verdict === "green") return <CheckCircle2 className="h-5 w-5 text-[hsl(var(--status-green))]" />;
  if (verdict === "yellow") return <AlertTriangle className="h-5 w-5 text-[hsl(var(--status-yellow))]" />;
  return <XCircle className="h-5 w-5 text-destructive" />;
}

function VerdictBadge({ verdict }: { verdict: "green" | "yellow" | "red" }) {
  const label = verdict === "green" ? "Handles Cleanly" : verdict === "yellow" ? "Needs Adjustment" : "Would Fail";
  const classes = verdict === "green"
    ? "bg-[hsl(var(--status-green))]/15 text-[hsl(var(--status-green))] border-[hsl(var(--status-green))]/30"
    : verdict === "yellow"
      ? "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))] border-[hsl(var(--status-yellow))]/30"
      : "bg-destructive/10 text-destructive border-destructive/30";
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}><VerdictIcon verdict={verdict} />{label}</span>;
}

function fmt(n: number) {
  return "$" + n.toLocaleString();
}

export function SimulationResults({ result, profile, onReset }: SimulationResultsProps) {
  const { summary, stressVerdict, days } = result;

  return (
    <div className="space-y-6">
      {/* Overall Verdict Banner */}
      <Card className={
        stressVerdict.overall === "green"
          ? "border-[hsl(var(--status-green))]/30 bg-[hsl(var(--status-green))]/5"
          : stressVerdict.overall === "yellow"
            ? "border-[hsl(var(--status-yellow))]/30 bg-[hsl(var(--status-yellow-bg))]"
            : "border-destructive/30 bg-destructive/5"
      }>
        <CardContent className="pt-5 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Closed-Loop Stress Test Verdict
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                "Would PodDispatch reduce chaos in this company?"
              </p>
            </div>
            <VerdictBadge verdict={stressVerdict.overall} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="ceo">
        <TabsList className="flex-wrap">
          <TabsTrigger value="ceo" className="gap-1.5"><BarChart3 className="h-4 w-4" /> CEO View</TabsTrigger>
          <TabsTrigger value="ops" className="gap-1.5"><Truck className="h-4 w-4" /> Operations</TabsTrigger>
          <TabsTrigger value="stress" className="gap-1.5"><Activity className="h-4 w-4" /> Stress Test</TabsTrigger>
          <TabsTrigger value="denials" className="gap-1.5"><XCircle className="h-4 w-4" /> Denials</TabsTrigger>
          <TabsTrigger value="daily" className="gap-1.5"><FileText className="h-4 w-4" /> Daily Log</TabsTrigger>
        </TabsList>

        {/* CEO VIEW */}
        <TabsContent value="ceo" className="mt-6 space-y-6">
          <h3 className="text-base font-semibold text-foreground">If PodDispatch ran this company for 30 days:</h3>

          {/* Revenue row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Revenue Captured" value={fmt(summary.totalRevenueGenerated)} sub={`${summary.totalCleanClaims} clean claims`} icon={<DollarSign className="h-4 w-4 text-[hsl(var(--status-green))]" />} />
            <MetricCard label="Revenue At Risk" value={fmt(summary.totalRevenueBlocked)} sub={`${summary.totalBlockedClaims} blocked trips`} icon={<XCircle className="h-4 w-4 text-destructive" />} />
            <MetricCard label="Revenue Delayed" value={fmt(summary.totalRevenueDelayed)} sub={`${summary.totalReviewClaims} in review`} icon={<AlertTriangle className="h-4 w-4 text-[hsl(var(--status-yellow))]" />} />
            <MetricCard label="Clean Claim Rate" value={`${summary.cleanClaimPercent}%`} sub={`${summary.totalCleanClaims}/${summary.totalCompleted} trips`} icon={<CheckCircle2 className="h-4 w-4 text-[hsl(var(--status-green))]" />} />
          </div>

          {/* Ops row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Dispatch Efficiency" value={`${summary.dispatchEfficiency}%`} sub={`${summary.totalCompleted}/${summary.totalTrips} trips`} icon={<Truck className="h-4 w-4 text-primary" />} />
            <MetricCard label="Cascade Delays" value={summary.totalCascadeDelays.toString()} sub={`${summary.totalLatePatients} late patients`} icon={<Zap className="h-4 w-4 text-[hsl(var(--status-yellow))]" />} />
            <MetricCard label="Missing Docs" value={summary.totalMissingDocs.toString()} sub="trips with doc blockers" icon={<FileText className="h-4 w-4 text-[hsl(var(--status-yellow))]" />} />
            <MetricCard label="Avg Days to Payment" value={`${summary.avgDaysToPayment}`} sub={`was ${profile.avgPaymentDays} days`} icon={<TrendingUp className="h-4 w-4 text-primary" />} />
          </div>

          {/* PodDispatch improvement projection */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> PodDispatch Impact Projection</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">With PodDispatch</p>
                  <p className="text-lg font-bold text-[hsl(var(--status-green))]">{fmt(summary.revenueCapturedWithPodDispatch)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Still Blocked</p>
                  <p className="text-lg font-bold text-destructive">{fmt(summary.revenueBlockedWithPodDispatch)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Revenue Recovered</p>
                  <p className="text-lg font-bold text-primary">+{fmt(summary.improvementDelta)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AR Aging */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">AR Aging Projection</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3">
                {summary.arAging.map(b => (
                  <div key={b.bucket} className="text-center">
                    <p className="text-xs text-muted-foreground">{b.bucket}</p>
                    <p className="text-lg font-bold text-foreground">{fmt(b.amount)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* OPERATIONS */}
        <TabsContent value="ops" className="mt-6 space-y-4">
          {/* Event counts */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="No-Shows" value={summary.totalNoShows.toString()} sub={`${profile.noShowPercent}% rate`} icon={<XCircle className="h-4 w-4 text-destructive" />} />
            <MetricCard label="Late Patients" value={summary.totalLatePatients.toString()} sub={`${profile.latePatientPercent}% rate`} icon={<AlertTriangle className="h-4 w-4 text-[hsl(var(--status-yellow))]" />} />
            <MetricCard label="Facility Delays" value={summary.totalFacilityDelays.toString()} sub="late facilities" icon={<Truck className="h-4 w-4 text-[hsl(var(--status-yellow))]" />} />
            <MetricCard label="Patient Not Ready" value={summary.totalPatientNotReady.toString()} sub="on arrival" icon={<AlertTriangle className="h-4 w-4 text-destructive" />} />
          </div>

          {summary.operationalFailures.length > 0 && (
            <Card className="border-destructive/20">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                  <XCircle className="h-4 w-4" /> Operational Failures
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {summary.operationalFailures.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-destructive mt-0.5">•</span>
                    <span>{f}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {summary.dispatchBottleneckDetails.length > 0 && (
            <Card className="border-[hsl(var(--status-yellow))]/20">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2 text-[hsl(var(--status-yellow))]">
                  <AlertTriangle className="h-4 w-4" /> Dispatch Bottlenecks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {summary.dispatchBottleneckDetails.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-[hsl(var(--status-yellow))] mt-0.5">•</span>
                    <span>{f}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {summary.docFailureDetails.length > 0 && (
            <Card className="border-[hsl(var(--status-yellow))]/20">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2 text-[hsl(var(--status-yellow))]">
                  <FileText className="h-4 w-4" /> Documentation Failures
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {summary.docFailureDetails.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-[hsl(var(--status-yellow))] mt-0.5">•</span>
                    <span>{f}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* STRESS TEST */}
        <TabsContent value="stress" className="mt-6 space-y-4">
          <h3 className="text-base font-semibold">System Evaluation by Area</h3>
          {stressVerdict.areas.map(area => (
            <Card key={area.area}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start gap-3">
                  <VerdictIcon verdict={area.verdict} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold">{area.area}</span>
                      <VerdictBadge verdict={area.verdict} />
                    </div>
                    <p className="text-sm text-muted-foreground">{area.detail}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* DENIAL BREAKDOWN */}
        <TabsContent value="denials" className="mt-6 space-y-4">
          <h3 className="text-base font-semibold">Denial Analysis (30-Day Projection)</h3>
          {summary.denialBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No denials projected at {profile.denialPercent}% rate.</p>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Denial Reason</TableHead>
                      <TableHead className="text-xs text-right">Count</TableHead>
                      <TableHead className="text-xs text-right">Revenue Impact</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.denialBreakdown.map((d, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{d.category}</TableCell>
                        <TableCell className="text-sm text-right">{d.count}</TableCell>
                        <TableCell className="text-sm text-right text-destructive">{fmt(d.revenue)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{summary.denialBreakdown.reduce((s, d) => s + d.count, 0)}</TableCell>
                      <TableCell className="text-right text-destructive">{fmt(summary.denialBreakdown.reduce((s, d) => s + d.revenue, 0))}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* DAILY LOG */}
        <TabsContent value="daily" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">30-Day Simulation Log</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Day</TableHead>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs text-right">Trips</TableHead>
                      <TableHead className="text-xs text-right">Done</TableHead>
                      <TableHead className="text-xs text-right">No-Show</TableHead>
                      <TableHead className="text-xs text-right">Late</TableHead>
                      <TableHead className="text-xs text-right">Clean</TableHead>
                      <TableHead className="text-xs text-right">Blocked</TableHead>
                      <TableHead className="text-xs text-right">Revenue</TableHead>
                      <TableHead className="text-xs text-right">Cascades</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {days.map(d => (
                      <TableRow key={d.day}>
                        <TableCell className="text-xs font-medium">{d.day}</TableCell>
                        <TableCell className="text-xs">{d.date}</TableCell>
                        <TableCell className="text-xs text-right">{d.totalTrips}</TableCell>
                        <TableCell className="text-xs text-right">{d.completedTrips}</TableCell>
                        <TableCell className="text-xs text-right">{d.noShows}</TableCell>
                        <TableCell className="text-xs text-right">{d.latePatients}</TableCell>
                        <TableCell className="text-xs text-right text-[hsl(var(--status-green))]">{d.cleanClaims}</TableCell>
                        <TableCell className="text-xs text-right text-destructive">{d.blockedClaims}</TableCell>
                        <TableCell className="text-xs text-right">{fmt(d.revenueGenerated)}</TableCell>
                        <TableCell className="text-xs text-right text-[hsl(var(--status-yellow))]">{d.cascadeDelays}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Button variant="outline" onClick={onReset} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Re-run with Different Inputs
      </Button>
    </div>
  );
}

function MetricCard({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        <p className="text-xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

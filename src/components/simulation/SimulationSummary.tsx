import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, CheckCircle2, XCircle, Truck, DollarSign,
  ShieldAlert, Clock, FileWarning, TrendingDown, Activity,
} from "lucide-react";

interface SummaryData {
  overview: {
    totalTrips: number;
    completed: number;
    cancelled: number;
    inProgress: number;
    patientNotReady: number;
    lateTrips: number;
  };
  safety: {
    missingNeeds: number;
    heavyPatients: number;
    oxygenPatients: number;
    bLegRisk: number;
    overridesUsed: number;
  };
  billing: {
    billingReady: number;
    billingBlocked: number;
    missingPcs: number;
    missingSig: number;
    missingDoc: number;
  };
  revenue: {
    total: number;
    ready: number;
    atRisk: number;
    lost: number;
  };
  trucks: {
    truckName: string;
    truckId: string;
    active: boolean;
    totalTrips: number;
    completedTrips: number;
    lateTrips: number;
    revenue: number;
    billingReady: number;
    billingBlocked: number;
    hasBariKit: boolean;
    hasO2: boolean;
    hasStairChair: boolean;
    hasPowerStretcher: boolean;
  }[];
  flags: { flag: string; severity: "critical" | "warning" | "info"; detail: string }[];
}

const severityStyles = {
  critical: "bg-destructive/10 text-destructive border-destructive/20",
  warning: "bg-[hsl(var(--status-yellow))]/10 text-[hsl(var(--status-yellow))] border-[hsl(var(--status-yellow))]/20",
  info: "bg-primary/10 text-primary border-primary/20",
};

const severityIcon = {
  critical: XCircle,
  warning: AlertTriangle,
  info: Activity,
};

export function SimulationSummary({ data }: { data: SummaryData }) {
  const { overview, safety, billing, revenue, trucks, flags } = data;

  return (
    <div className="space-y-4">
      {/* Cascade Flags */}
      {flags.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cascade Failure Flags</p>
          {flags.map((f, i) => {
            const Icon = severityIcon[f.severity];
            return (
              <div key={i} className={`flex items-start gap-2 rounded-md border p-2.5 ${severityStyles[f.severity]}`}>
                <Icon className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold">{f.flag}</p>
                  <p className="text-[10px] opacity-80">{f.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Overview Grid */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <MetricBox label="Total Trips" value={overview.totalTrips} />
        <MetricBox label="Completed" value={overview.completed} color="green" />
        <MetricBox label="Late" value={overview.lateTrips} color={overview.lateTrips > 0 ? "yellow" : undefined} />
        <MetricBox label="Cancelled" value={overview.cancelled} color={overview.cancelled > 0 ? "red" : undefined} />
        <MetricBox label="Not Ready" value={overview.patientNotReady} color={overview.patientNotReady > 0 ? "yellow" : undefined} />
        <MetricBox label="In Progress" value={overview.inProgress} />
      </div>

      {/* Safety + Billing + Revenue Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Safety */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
              Safety Risks
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-1">
            <SummaryRow label="Missing Patient Needs" value={safety.missingNeeds} warn={safety.missingNeeds > 0} />
            <SummaryRow label="Heavy Patients (300+)" value={safety.heavyPatients} />
            <SummaryRow label="Oxygen Required" value={safety.oxygenPatients} />
            <SummaryRow label="B-Leg Timing Risk" value={safety.bLegRisk} warn={safety.bLegRisk > 2} />
            <SummaryRow label="Overrides Used" value={safety.overridesUsed} warn={safety.overridesUsed > 0} />
          </CardContent>
        </Card>

        {/* PCR / Billing */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <FileWarning className="h-3.5 w-3.5 text-[hsl(var(--status-yellow))]" />
              PCR & Billing
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-1">
            <SummaryRow label="Billing Ready" value={billing.billingReady} good />
            <SummaryRow label="Billing Blocked" value={billing.billingBlocked} warn={billing.billingBlocked > 0} />
            <SummaryRow label="Missing PCS" value={billing.missingPcs} warn={billing.missingPcs > 0} />
            <SummaryRow label="Missing Signatures" value={billing.missingSig} warn={billing.missingSig > 0} />
            <SummaryRow label="Incomplete Docs" value={billing.missingDoc} warn={billing.missingDoc > 0} />
          </CardContent>
        </Card>

        {/* Revenue */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-[hsl(var(--status-green))]" />
              Revenue Impact
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-1">
            <SummaryRow label="Total Expected" value={`$${revenue.total.toLocaleString()}`} />
            <SummaryRow label="Ready to Bill" value={`$${revenue.ready.toLocaleString()}`} good />
            <SummaryRow label="At Risk" value={`$${revenue.atRisk.toLocaleString()}`} warn={revenue.atRisk > 0} />
            <SummaryRow label="Lost (Cancelled)" value={`$${revenue.lost.toLocaleString()}`} warn={revenue.lost > 0} />
          </CardContent>
        </Card>
      </div>

      {/* Per-Truck Breakdown */}
      <Card>
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5 text-primary" />
            Per-Truck Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-1.5 font-semibold">Truck</th>
                  <th className="text-center py-1.5 font-semibold">Trips</th>
                  <th className="text-center py-1.5 font-semibold">Late</th>
                  <th className="text-center py-1.5 font-semibold">Ready</th>
                  <th className="text-center py-1.5 font-semibold">Blocked</th>
                  <th className="text-right py-1.5 font-semibold">Revenue</th>
                  <th className="text-center py-1.5 font-semibold">Equip</th>
                </tr>
              </thead>
              <tbody>
                {trucks.map(t => (
                  <tr key={t.truckId} className={`border-b border-border/50 ${!t.active ? "opacity-40" : ""}`}>
                    <td className="py-1.5 font-medium text-foreground">
                      {t.truckName}
                      {!t.active && <Badge variant="destructive" className="text-[8px] ml-1 px-1 py-0">DOWN</Badge>}
                    </td>
                    <td className="text-center text-foreground">{t.totalTrips}</td>
                    <td className="text-center">
                      <span className={t.lateTrips > 0 ? "text-[hsl(var(--status-yellow))] font-bold" : "text-muted-foreground"}>
                        {t.lateTrips}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className="text-[hsl(var(--status-green))]">{t.billingReady}</span>
                    </td>
                    <td className="text-center">
                      <span className={t.billingBlocked > 0 ? "text-destructive font-bold" : "text-muted-foreground"}>
                        {t.billingBlocked}
                      </span>
                    </td>
                    <td className="text-right text-foreground">${t.revenue.toLocaleString()}</td>
                    <td className="text-center">
                      <div className="flex gap-0.5 justify-center">
                        {t.hasPowerStretcher && <span title="Power Stretcher" className="text-primary">P</span>}
                        {t.hasStairChair && <span title="Stair Chair" className="text-primary">S</span>}
                        {t.hasBariKit && <span title="Bariatric Kit" className="text-primary">B</span>}
                        {t.hasO2 && <span title="O2 Mount" className="text-primary">O</span>}
                        {!t.hasPowerStretcher && !t.hasStairChair && !t.hasBariKit && !t.hasO2 && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Cascade Story */}
      {flags.length > 0 && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-xs flex items-center gap-1.5 text-destructive">
              <TrendingDown className="h-3.5 w-3.5" />
              Cascade Failure Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className="text-[10px] text-foreground leading-relaxed">
              <strong>Dispatch Structure</strong> → {overview.lateTrips > 0 ? `${overview.lateTrips} late pickups` : "on-time"}
              {safety.missingNeeds > 0 ? ` + ${safety.missingNeeds} unknown patient needs` : ""}
              {safety.bLegRisk > 0 ? ` + ${safety.bLegRisk} B-leg timing risks` : ""}
              <br />
              <strong>Crew Reality</strong> → {billing.missingPcs > 0 ? `${billing.missingPcs} missing PCS` : "PCS captured"}
              {billing.missingSig > 0 ? ` + ${billing.missingSig} unsigned` : ""}
              {safety.overridesUsed > 0 ? ` + ${safety.overridesUsed} safety overrides` : ""}
              <br />
              <strong>Billing Outcome</strong> → ${revenue.ready.toLocaleString()} billable
              {revenue.atRisk > 0 ? ` / $${revenue.atRisk.toLocaleString()} at risk` : ""}
              {revenue.lost > 0 ? ` / $${revenue.lost.toLocaleString()} lost` : ""}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricBox({ label, value, color }: { label: string; value: number | string; color?: "green" | "yellow" | "red" }) {
  const colorClass = color === "green" ? "text-[hsl(var(--status-green))]"
    : color === "yellow" ? "text-[hsl(var(--status-yellow))]"
    : color === "red" ? "text-destructive"
    : "text-foreground";

  return (
    <div className="rounded-md border bg-card p-2 text-center">
      <p className={`text-lg font-bold ${colorClass}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}

function SummaryRow({ label, value, warn, good }: { label: string; value: number | string; warn?: boolean; good?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={`text-xs font-semibold ${warn ? "text-destructive" : good ? "text-[hsl(var(--status-green))]" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}

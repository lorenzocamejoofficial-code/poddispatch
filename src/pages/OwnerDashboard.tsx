import { useEffect, useState, useMemo } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PageLoader } from "@/components/ui/page-loader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { getDenialTranslation } from "@/lib/denial-code-translations";
import { useNavigate } from "react-router-dom";
import {
  CalendarCheck, DollarSign, XCircle, Shield, FileText, Truck,
  ArrowRight, AlertTriangle, CheckCircle, Clock
} from "lucide-react";
import { MissingMoneySummary } from "@/components/billing/MissingMoneyPanel";

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState<any[]>([]);
  const [allDeniedClaims, setAllDeniedClaims] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().slice(0, 10);
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

      const [claimRes, deniedRes, tripRes, truckRes, inspRes] = await Promise.all([
        // Fix 2 & 3: 90-day window + exclude simulated
        supabase.from("claim_records").select("*").gte("run_date", ninetyDaysAgo).or("is_simulated.eq.false,is_simulated.is.null"),
        // Fix 2: All unresolved denials regardless of date for action items
        supabase.from("claim_records").select("*").eq("status", "denied" as any).or("is_simulated.eq.false,is_simulated.is.null").limit(500),
        // Fix 3: Exclude simulated trips
        supabase.from("trip_records" as any).select("id, status, run_date, pcr_status, blockers, patient_id, leg_id").gte("run_date", weekAgo).or("is_simulated.eq.false,is_simulated.is.null").limit(1000),
        supabase.from("trucks" as any).select("id, name, active"),
        supabase.from("vehicle_inspections" as any).select("id, truck_id, run_date").eq("run_date", today),
      ]);

      const rawClaims = (claimRes.data ?? []) as any[];
      const rawDenied = (deniedRes.data ?? []) as any[];

      // Join patient data for secondary opportunity detection and doc action items
      const allPatientIds = [
        ...new Set([
          ...rawClaims.map((c: any) => c.patient_id),
          ...(tripRes.data ?? []).map((t: any) => t.patient_id),
        ].filter(Boolean))
      ];
      let patientsMap: Record<string, any> = {};
      if (allPatientIds.length > 0) {
        const { data: patients } = await supabase
          .from("patients")
          .select("id, secondary_payer, first_name, last_name")
          .in("id", allPatientIds);
        (patients || []).forEach((p: any) => { patientsMap[p.id] = p; });
      }

      // Enrich claims with patient secondary payer info
      const enrichedClaims = rawClaims.map((c: any) => ({
        ...c,
        _has_secondary_payer: !!patientsMap[c.patient_id]?.secondary_payer,
      }));

      // Enrich denied claims
      const enrichedDenied = rawDenied.map((c: any) => ({
        ...c,
        _has_secondary_payer: !!patientsMap[c.patient_id]?.secondary_payer,
      }));

      // Enrich trips with patient names for Fix 4
      const enrichedTrips = ((tripRes.data ?? []) as any[]).map((t: any) => {
        const pat = patientsMap[t.patient_id];
        return {
          ...t,
          _patient_name: pat ? `${pat.first_name ?? ""} ${pat.last_name ?? ""}`.trim() : null,
        };
      });

      setClaims(enrichedClaims);
      setAllDeniedClaims(enrichedDenied);
      setTrips(enrichedTrips);
      setTrucks((truckRes.data ?? []) as any[]);
      setInspections((inspRes.data ?? []) as any[]);
      setLoading(false);
    }
    load();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  // Fix 1: Scope "This Week" card claims to same 7-day window as trips
  const weekClaims = claims.filter(c => c.run_date >= weekAgo);

  // Card 1 — This Week (all scoped to 7 days)
  const weekTripsCompleted = trips.filter(t => t.status === "completed" || t.status === "ready_for_billing").length;
  const claimsReadyToSubmit = weekClaims.filter(c => c.status === "ready_to_bill").length;
  const claimsSubmitted = weekClaims.filter(c => c.status === "submitted").length;
  const weekHealthy = claimsReadyToSubmit <= weekTripsCompleted * 0.3;

  // Card 2 — Money Coming In (from 90-day dataset)
  const pendingPayment = claims.filter(c => c.status === "submitted").reduce((s, c) => s + (c.total_charge ?? 0), 0);
  const monthCollected = claims.filter(c => c.status === "paid" && c.paid_at && new Date(c.paid_at) >= monthStart).reduce((s, c) => s + (c.amount_paid ?? 0), 0);

  // Card 3 — Denials (this month from 90-day dataset)
  const monthDenied = claims.filter(c => c.status === "denied" && c.submitted_at && new Date(c.submitted_at) >= monthStart);
  const deniedAmount = monthDenied.reduce((s, c) => s + (c.total_charge ?? 0), 0);
  const totalMonthClaims = claims.filter(c => c.submitted_at && new Date(c.submitted_at) >= monthStart).length;
  const denialRate = totalMonthClaims > 0 ? (monthDenied.length / totalMonthClaims) * 100 : 0;
  const topDenialCode = useMemo(() => {
    const codes = monthDenied.map(c => c.denial_code).filter(Boolean);
    if (!codes.length) return null;
    const freq = new Map<string, number>();
    codes.forEach(c => freq.set(c, (freq.get(c) || 0) + 1));
    const top = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
    const translation = getDenialTranslation(top[0]);
    return translation?.plain_english_explanation ?? top[0];
  }, [monthDenied]);

  // Card 4 — Secondary Opportunities
  const secondaryOpp = useMemo(() => {
    const eligible = claims.filter(c => c.status === "paid" && !c.secondary_claim_generated && c._has_secondary_payer && c.patient_responsibility_amount > 0);
    return { count: eligible.length, amount: eligible.reduce((s, c) => s + (c.patient_responsibility_amount ?? 0), 0) };
  }, [claims]);

  // Card — Denial Recovery
  const denialRecovery = useMemo(() => {
    const recoverable = allDeniedClaims.filter(c => {
      const t = c.denial_code ? getDenialTranslation(c.denial_code) : null;
      return t?.is_recoverable;
    });
    return { count: recoverable.length, amount: recoverable.reduce((s: number, c: any) => s + (c.total_charge ?? 0), 0) };
  }, [allDeniedClaims]);

  // Card 5 — Documentation
  const docIssues = trips.filter(t => (t.status === "completed" || t.status === "ready_for_billing") && t.pcr_status !== "submitted" && t.pcr_status !== "complete");

  // Card 6 — Today's Operations
  const activeTrucks = trucks.filter(t => t.active);
  const todayInspections = inspections.length;
  const missingInspections = activeTrucks.length - todayInspections;

  // Fix 5: Status badge uses week-scoped ready-to-submit count
  const issueCount = monthDenied.length + docIssues.length + claimsReadyToSubmit;
  const statusLine = issueCount === 0
    ? "Business is healthy — everything is on track."
    : issueCount <= 3
      ? `Business is healthy — ${issueCount} ${issueCount === 1 ? "item needs" : "items need"} attention.`
      : `Action needed — ${issueCount} items need your attention this week.`;
  const statusHealthy = issueCount <= 3;

  // Action items table — uses allDeniedClaims for denials (Fix 2) and enriched trips for doc issues (Fix 4)
  const actionItems = useMemo(() => {
    const items: { type: string; description: string; amount: number; action: string; route: string }[] = [];
    allDeniedClaims.forEach(c => {
      const translation = c.denial_code ? getDenialTranslation(c.denial_code) : null;
      items.push({
        type: "Denied",
        description: translation?.plain_english_explanation ?? c.denial_reason ?? "Claim denied",
        amount: c.total_charge ?? 0,
        action: translation?.is_recoverable ? "Fix & Resubmit" : "Appeal",
        route: "/billing",
      });
    });
    claims.filter(c => c.status === "paid" && !c.secondary_claim_generated && c._has_secondary_payer && c.patient_responsibility_amount > 0).slice(0, 10).forEach(c => {
      items.push({
        type: "Secondary",
        description: `Patient responsibility of $${(c.patient_responsibility_amount ?? 0).toFixed(2)} may be covered by secondary insurance`,
        amount: c.patient_responsibility_amount ?? 0,
        action: "Generate Secondary",
        route: "/billing",
      });
    });
    // Fix 4: Show patient name and run date for doc issues
    docIssues.slice(0, 10).forEach(t => {
      const name = t._patient_name || "Unknown patient";
      const date = t.run_date ? new Date(t.run_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
      items.push({
        type: "Documentation",
        description: `${name}${date ? ` — ${date}` : ""}: PCR documentation is incomplete`,
        amount: 0,
        action: "Fix Documentation",
        route: "/compliance",
      });
    });
    return items.slice(0, 20);
  }, [allDeniedClaims, claims, docIssues]);

  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) return <AdminLayout><PageLoader label="Loading dashboard…" /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Command Center</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <Badge
            variant="outline"
            className={`text-sm px-3 py-1.5 ${statusHealthy
              ? "border-[hsl(var(--status-green))]/40 text-[hsl(var(--status-green))] bg-[hsl(var(--status-green-bg))]"
              : "border-destructive/40 text-destructive bg-[hsl(var(--status-red-bg))]"
            }`}
          >
            {statusHealthy ? <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> : <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />}
            {statusLine}
          </Badge>
        </div>

        {/* 6 Cards */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* Card 1 — This Week */}
          <Card className={weekHealthy ? "" : "border-[hsl(var(--status-yellow))]/40"}>
            <CardContent className="pt-5 pb-4 space-y-3">
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">This Week</p>
                <div className={`ml-auto h-2 w-2 rounded-full ${weekHealthy ? "bg-[hsl(var(--status-green))]" : "bg-[hsl(var(--status-yellow))]"}`} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xl font-bold text-foreground">{weekTripsCompleted}</p>
                  <p className="text-[10px] text-muted-foreground">Trips Done</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{claimsReadyToSubmit}</p>
                  <p className="text-[10px] text-muted-foreground">Ready to Submit</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{claimsSubmitted}</p>
                  <p className="text-[10px] text-muted-foreground">Submitted</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2 — Money Coming In */}
          <Card>
            <CardContent className="pt-5 pb-4 space-y-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Money Coming In</p>
                <div className="ml-auto h-2 w-2 rounded-full bg-[hsl(var(--status-green))]" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-baseline">
                  <p className="text-xs text-muted-foreground">Pending payment</p>
                  <p className="text-lg font-bold text-foreground">${fmt(pendingPayment)}</p>
                </div>
                <div className="flex justify-between items-baseline">
                  <p className="text-xs text-muted-foreground">Collected this month</p>
                  <p className="text-sm font-medium text-[hsl(var(--status-green))]">${fmt(monthCollected)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3 — Denials */}
          <Card className={denialRate > 10 ? "border-destructive/40" : denialRate > 5 ? "border-[hsl(var(--status-yellow))]/40" : ""}>
            <CardContent className="pt-5 pb-4 space-y-3">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Denials</p>
                <div className={`ml-auto h-2 w-2 rounded-full ${denialRate > 10 ? "bg-destructive" : denialRate > 5 ? "bg-[hsl(var(--status-yellow))]" : "bg-[hsl(var(--status-green))]"}`} />
              </div>
              <div className="flex justify-between items-baseline">
                <p className="text-xs text-muted-foreground">{monthDenied.length} denied this month</p>
                <p className={`text-lg font-bold ${denialRate > 10 ? "text-destructive" : "text-foreground"}`}>${fmt(deniedAmount)}</p>
              </div>
              {topDenialCode && (
                <p className="text-[11px] text-muted-foreground leading-tight">Top reason: {topDenialCode}</p>
              )}
            </CardContent>
          </Card>

          {/* Card 4 — Secondary Opportunities */}
          <Card className={secondaryOpp.count > 0 ? "border-[hsl(var(--status-yellow))]/40" : ""}>
            <CardContent className="pt-5 pb-4 space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Secondary Opportunities</p>
              </div>
              {secondaryOpp.count > 0 ? (
                <>
                  <div className="flex justify-between items-baseline">
                    <p className="text-xs text-muted-foreground">{secondaryOpp.count} claims eligible</p>
                    <p className="text-lg font-bold text-[hsl(var(--status-yellow))]">${fmt(secondaryOpp.amount)}</p>
                  </div>
                  <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => navigate("/billing")}>
                    <ArrowRight className="h-3 w-3 mr-1" />Review in Billing
                  </Button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground py-2">No secondary opportunities right now</p>
              )}
            </CardContent>
          </Card>

          {/* Card 5 — Denial Recovery */}
          <Card className={denialRecovery.count > 0 ? "border-destructive/40" : ""}>
            <CardContent className="pt-5 pb-4 space-y-3">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Denial Recovery</p>
                {denialRecovery.count > 0 && <div className="ml-auto h-2 w-2 rounded-full bg-destructive" />}
              </div>
              {denialRecovery.count > 0 ? (
                <>
                  <div className="flex justify-between items-baseline">
                    <p className="text-xs text-muted-foreground">{denialRecovery.count} recoverable claims</p>
                    <p className="text-lg font-bold text-destructive">${fmt(denialRecovery.amount)}</p>
                  </div>
                  <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => navigate("/ar-command-center")}>
                    <ArrowRight className="h-3 w-3 mr-1" />Open AR Command Center
                  </Button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground py-2">No recoverable denials right now</p>
              )}
            </CardContent>
          </Card>

          {/* Card 6 — Documentation */}
          <Card className={docIssues.length > 0 ? "border-[hsl(var(--status-yellow))]/40" : ""}>
            <CardContent className="pt-5 pb-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Documentation</p>
                <div className={`ml-auto h-2 w-2 rounded-full ${docIssues.length === 0 ? "bg-[hsl(var(--status-green))]" : "bg-[hsl(var(--status-yellow))]"}`} />
              </div>
              <p className="text-xs text-muted-foreground">
                {docIssues.length === 0
                  ? "All completed trips have documentation"
                  : `${docIssues.length} trips with incomplete PCR documentation`}
              </p>
              {docIssues.length > 0 && (
                <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => navigate("/compliance")}>
                  <ArrowRight className="h-3 w-3 mr-1" />Fix Documentation
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Card 6 — Today's Operations */}
          <Card className={missingInspections > 0 ? "border-[hsl(var(--status-yellow))]/40" : ""}>
            <CardContent className="pt-5 pb-4 space-y-3">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Today's Operations</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xl font-bold text-foreground">{activeTrucks.length}</p>
                  <p className="text-[10px] text-muted-foreground">Active Trucks</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-[hsl(var(--status-green))]">{todayInspections}</p>
                  <p className="text-[10px] text-muted-foreground">Inspections</p>
                </div>
                <div>
                  <p className={`text-xl font-bold ${missingInspections > 0 ? "text-destructive" : "text-[hsl(var(--status-green))]"}`}>{missingInspections}</p>
                  <p className="text-[10px] text-muted-foreground">Missing</p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => navigate("/")}>
                <ArrowRight className="h-3 w-3 mr-1" />Open Dispatch Board
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Missing Money Detection */}
        <MissingMoneySummary />

        {/* Action Items */}
        {actionItems.length > 0 && (
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Items Needing Attention
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Description</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actionItems.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              item.type === "Denied" ? "border-destructive/40 text-destructive"
                              : item.type === "Secondary" ? "border-[hsl(var(--status-yellow))]/40 text-[hsl(var(--status-yellow))]"
                              : "border-primary/40 text-primary"
                            }`}
                          >
                            {item.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[350px] truncate">{item.description}</TableCell>
                        <TableCell className="text-xs text-right font-medium">
                          {item.amount > 0 ? `$${fmt(item.amount)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => navigate(item.route)}>
                            {item.action}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}

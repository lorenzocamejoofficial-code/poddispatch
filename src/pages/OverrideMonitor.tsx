import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, DollarSign, Filter, Eye } from "lucide-react";
import { format } from "date-fns";

interface SafetyOverrideRow {
  id: string;
  override_status: string;
  reasons: string[];
  override_reason: string;
  overridden_by: string;
  overridden_at: string;
  company_id: string | null;
  slot_id: string | null;
  leg_id: string | null;
  trip_record_id: string | null;
  // Enriched
  overrider_email?: string;
  overrider_role?: string;
  company_name?: string;
  patient_name?: string;
  truck_name?: string;
  is_simulated?: boolean;
}

interface BillingOverrideRow {
  id: string;
  trip_id: string;
  override_reason: string;
  overridden_by: string | null;
  overridden_at: string;
  previous_blockers_snapshot: any;
  previous_blockers: string[] | null;
  is_active: boolean;
  // Enriched
  overrider_email?: string;
  overrider_role?: string;
  company_name?: string;
  patient_name?: string;
  truck_name?: string;
  is_simulated?: boolean;
  run_date?: string;
}

export default function OverrideMonitor() {
  const { isSystemCreator } = useAuth();
  const [safetyOverrides, setSafetyOverrides] = useState<SafetyOverrideRow[]>([]);
  const [billingOverrides, setBillingOverrides] = useState<BillingOverrideRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [simFilter, setSimFilter] = useState<"all" | "live" | "simulated">("all");

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // Fetch safety overrides
      let safetyQuery = supabase.from("safety_overrides").select("*").order("overridden_at", { ascending: false }).limit(200);
      if (dateFrom) safetyQuery = safetyQuery.gte("overridden_at", dateFrom);
      if (dateTo) safetyQuery = safetyQuery.lte("overridden_at", dateTo + "T23:59:59");

      // Fetch billing overrides
      let billingQuery = supabase.from("billing_overrides").select("*").order("overridden_at", { ascending: false }).limit(200);
      if (dateFrom) billingQuery = billingQuery.gte("overridden_at", dateFrom);
      if (dateTo) billingQuery = billingQuery.lte("overridden_at", dateTo + "T23:59:59");

      const [{ data: safetyData }, { data: billingData }] = await Promise.all([safetyQuery, billingQuery]);

      // Enrich with user emails and roles
      const userIds = new Set<string>();
      ((safetyData ?? []) as any[]).forEach((s: any) => { if (s.overridden_by) userIds.add(s.overridden_by); });
      ((billingData ?? []) as any[]).forEach((b: any) => { if (b.overridden_by) userIds.add(b.overridden_by); });

      const uids = [...userIds];
      let profileMap = new Map<string, { email: string; role: string }>();
      if (uids.length > 0) {
        const { data: memberships } = await supabase.from("company_memberships")
          .select("user_id, role")
          .in("user_id", uids);
        const { data: profiles } = await supabase.from("profiles")
          .select("user_id, full_name")
          .in("user_id", uids);
        for (const uid of uids) {
          const membership = (memberships ?? []).find((m: any) => m.user_id === uid);
          const profile = (profiles ?? []).find((p: any) => p.user_id === uid);
          profileMap.set(uid, {
            email: profile?.full_name ?? uid.slice(0, 8),
            role: membership?.role ?? "unknown",
          });
        }
      }

      // Enrich trip data for billing overrides
      const tripIds = ((billingData ?? []) as any[]).map((b: any) => b.trip_id).filter(Boolean);
      let tripMap = new Map<string, any>();
      if (tripIds.length > 0) {
        const { data: trips } = await supabase.from("trip_records")
          .select("id, run_date, is_simulated, patient_id, truck_id, patient:patients!trip_records_patient_id_fkey(first_name, last_name), truck:trucks!trip_records_truck_id_fkey(name)")
          .in("id", tripIds) as any;
        for (const t of trips ?? []) {
          tripMap.set(t.id, t);
        }
      }

      // Enrich company names
      const companyIds = new Set<string>();
      ((safetyData ?? []) as any[]).forEach((s: any) => { if (s.company_id) companyIds.add(s.company_id); });
      let companyMap = new Map<string, string>();
      if (companyIds.size > 0) {
        const { data: companies } = await supabase.from("companies").select("id, name").in("id", [...companyIds]);
        for (const c of companies ?? []) {
          companyMap.set(c.id, c.name);
        }
      }

      const enrichedSafety: SafetyOverrideRow[] = ((safetyData ?? []) as any[]).map((s: any) => ({
        ...s,
        overrider_email: profileMap.get(s.overridden_by)?.email ?? s.overridden_by?.slice(0, 8),
        overrider_role: profileMap.get(s.overridden_by)?.role ?? "unknown",
        company_name: companyMap.get(s.company_id) ?? "—",
        is_simulated: false, // safety overrides don't have is_simulated flag currently
      }));

      const enrichedBilling: BillingOverrideRow[] = ((billingData ?? []) as any[]).map((b: any) => {
        const trip = tripMap.get(b.trip_id);
        return {
          ...b,
          overrider_email: profileMap.get(b.overridden_by)?.email ?? b.overridden_by?.slice(0, 8),
          overrider_role: profileMap.get(b.overridden_by)?.role ?? "unknown",
          patient_name: trip?.patient ? `${trip.patient.first_name} ${trip.patient.last_name}` : "—",
          truck_name: trip?.truck?.name ?? "—",
          company_name: trip ? companyMap.get(trip.company_id) ?? "—" : "—",
          is_simulated: trip?.is_simulated ?? false,
          run_date: trip?.run_date ?? null,
        };
      });

      // Apply simulation filter
      const filterSim = (item: { is_simulated?: boolean }) => {
        if (simFilter === "all") return true;
        if (simFilter === "simulated") return item.is_simulated;
        return !item.is_simulated;
      };

      setSafetyOverrides(enrichedSafety.filter(filterSim));
      setBillingOverrides(enrichedBilling.filter(filterSim));
      setLoading(false);
    };
    load();
  }, [dateFrom, dateTo, simFilter]);

  const formatDt = (dt: string) => {
    try { return format(new Date(dt), "MMM d, yyyy h:mm a"); } catch { return dt; }
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Eye className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Override Monitor</h1>
          <Badge variant="outline" className="text-[10px]">READ-ONLY AUDIT</Badge>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-end gap-4 flex-wrap">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">To</label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Data Type</label>
                <Select value={simFilter} onValueChange={v => setSimFilter(v as any)}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="live">Live Only</SelectItem>
                    <SelectItem value="simulated">Simulated Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); setSimFilter("all"); }}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="safety">
          <TabsList>
            <TabsTrigger value="safety" className="gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" />
              Safety Overrides ({safetyOverrides.length})
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-1.5">
              <DollarSign className="h-3.5 w-3.5" />
              Billing Overrides ({billingOverrides.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="safety">
            {loading ? (
              <PageLoader label="Loading safety overrides…" />
            ) : safetyOverrides.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="No safety overrides" description="No safety overrides have been recorded yet." />
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Reasons</TableHead>
                      <TableHead>Override Reason</TableHead>
                      <TableHead>Overridden By</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Date/Time</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {safetyOverrides.map(so => (
                      <TableRow key={so.id}>
                        <TableCell>
                          <Badge variant={so.override_status === "BLOCKED" ? "destructive" : "secondary"} className="text-[10px]">
                            {so.override_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <ul className="text-[11px] space-y-0.5">
                            {so.reasons.map((r, i) => <li key={i}>• {r}</li>)}
                          </ul>
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px]">{so.override_reason}</TableCell>
                        <TableCell className="text-sm">{so.overrider_email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] capitalize">{so.overrider_role}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{so.company_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDt(so.overridden_at)}</TableCell>
                        <TableCell>
                          <Badge variant={so.is_simulated ? "secondary" : "outline"} className="text-[9px]">
                            {so.is_simulated ? "SIM" : "LIVE"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="billing">
            {loading ? (
              <PageLoader label="Loading billing overrides…" />
            ) : billingOverrides.length === 0 ? (
              <EmptyState icon={DollarSign} title="No billing overrides" description="No billing overrides have been recorded yet." />
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trip Date</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Truck</TableHead>
                      <TableHead>Previous Blockers</TableHead>
                      <TableHead>Override Reason</TableHead>
                      <TableHead>Overridden By</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Date/Time</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billingOverrides.map(bo => (
                      <TableRow key={bo.id}>
                        <TableCell className="text-sm">{bo.run_date ?? "—"}</TableCell>
                        <TableCell className="text-sm">{bo.patient_name}</TableCell>
                        <TableCell className="text-sm">{bo.truck_name}</TableCell>
                        <TableCell className="max-w-[200px]">
                          <ul className="text-[11px] space-y-0.5">
                            {(bo.previous_blockers ?? []).map((b: string, i: number) => <li key={i}>• {b}</li>)}
                          </ul>
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px]">{bo.override_reason}</TableCell>
                        <TableCell className="text-sm">{bo.overrider_email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] capitalize">{bo.overrider_role}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDt(bo.overridden_at)}</TableCell>
                        <TableCell>
                          <Badge variant={bo.is_simulated ? "secondary" : "outline"} className="text-[9px]">
                            {bo.is_simulated ? "SIM" : "LIVE"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

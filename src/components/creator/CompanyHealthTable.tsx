import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";
import { differenceInDays, format } from "date-fns";

interface CompanyHealth {
  id: string;
  name: string;
  approved_at: string | null;
  trialDaysLeft: number | null;
  subscriptionStatus: string | null;
  onboardingSteps: number;
  hasMigrationRow: boolean;
  patients: number;
  tripsThisMonth: number;
  billingCompleteRate: number;
  lastActivity: string | null;
}

export function CompanyHealthTable() {
  const [companies, setCompanies] = useState<CompanyHealth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHealth();
  }, []);

  const loadHealth = async () => {
    setLoading(true);
    const { data: allCompanies } = await supabase
      .from("companies")
      .select("id, name, approved_at, is_sandbox, onboarding_status")
      .eq("is_sandbox", false)
      .order("created_at", { ascending: false });

    if (!allCompanies || allCompanies.length === 0) {
      setLoading(false);
      return;
    }

    const companyIds = allCompanies.map((c) => c.id);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartStr = monthStart.toISOString().split("T")[0];

    const [{ data: subs }, { data: migrations }, { data: trucks }, { data: patients }, { data: trips }] = await Promise.all([
      supabase.from("subscription_records").select("company_id, subscription_status, trial_ends_at").in("company_id", companyIds),
      supabase.from("migration_settings").select("company_id, step_rates_verified, step_trucks_added, step_patients_added, step_team_invited, step_first_trip").in("company_id", companyIds),
      supabase.from("trucks").select("company_id").in("company_id", companyIds).eq("is_simulated", false),
      supabase.from("patients").select("company_id").in("company_id", companyIds).eq("is_simulated", false),
      supabase.from("trip_records").select("company_id, status, updated_at").in("company_id", companyIds).eq("is_simulated", false).gte("run_date", monthStartStr),
    ]);

    const subMap = new Map((subs ?? []).map((s) => [s.company_id, s]));
    const migMap = new Map((migrations ?? []).map((m) => [m.company_id, m]));

    const truckCounts = new Map<string, number>();
    (trucks ?? []).forEach((t) => truckCounts.set(t.company_id, (truckCounts.get(t.company_id) ?? 0) + 1));

    const patientCounts = new Map<string, number>();
    (patients ?? []).forEach((p) => patientCounts.set(p.company_id, (patientCounts.get(p.company_id) ?? 0) + 1));

    const tripData = new Map<string, { total: number; billed: number; lastActivity: string | null }>();
    (trips ?? []).forEach((t) => {
      const existing = tripData.get(t.company_id) ?? { total: 0, billed: 0, lastActivity: null };
      existing.total++;
      if (t.status === "ready_for_billing") existing.billed++;
      if (!existing.lastActivity || t.updated_at > existing.lastActivity) existing.lastActivity = t.updated_at;
      tripData.set(t.company_id, existing);
    });

    const result: CompanyHealth[] = allCompanies.map((c) => {
      const sub = subMap.get(c.id);
      const mig = migMap.get(c.id) as any;
      const td = tripData.get(c.id);

      let trialDaysLeft: number | null = null;
      if (sub && (sub as any).trial_ends_at) {
        trialDaysLeft = Math.max(0, differenceInDays(new Date((sub as any).trial_ends_at), new Date()));
      }

      const steps = mig
        ? [mig.step_rates_verified, mig.step_trucks_added, mig.step_patients_added, mig.step_team_invited, mig.step_first_trip].filter(Boolean).length
        : 0;
      const hasMigrationRow = !!mig;

      return {
        id: c.id,
        name: c.name,
        approved_at: c.approved_at,
        trialDaysLeft,
        subscriptionStatus: sub?.subscription_status ?? null,
        onboardingSteps: steps,
        hasMigrationRow,
        trucks: truckCounts.get(c.id) ?? 0,
        patients: patientCounts.get(c.id) ?? 0,
        tripsThisMonth: td?.total ?? 0,
        billingCompleteRate: td && td.total > 0 ? Math.round((td.billed / td.total) * 100) : 0,
        lastActivity: td?.lastActivity ?? c.approved_at,
      };
    });

    setCompanies(result);
    setLoading(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading company health...</p>;
  if (companies.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Building2 className="h-4 w-4" /> Per-Company Health
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-3 font-medium">Company</th>
              <th className="pb-2 pr-3 font-medium">Approved</th>
              <th className="pb-2 pr-3 font-medium">Trial</th>
              <th className="pb-2 pr-3 font-medium">Onboarding</th>
              <th className="pb-2 pr-3 font-medium text-right">Trucks</th>
              <th className="pb-2 pr-3 font-medium text-right">Patients</th>
              <th className="pb-2 pr-3 font-medium text-right">Trips/Mo</th>
              <th className="pb-2 pr-3 font-medium text-right">Bill %</th>
              <th className="pb-2 font-medium">Last Active</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="py-2 pr-3 font-medium text-foreground">{c.name}</td>
                <td className="py-2 pr-3 text-muted-foreground">
                  {c.approved_at ? format(new Date(c.approved_at), "MMM d") : "—"}
                </td>
                <td className="py-2 pr-3">
                  {c.subscriptionStatus === "trial" && c.trialDaysLeft !== null ? (
                    <Badge variant={c.trialDaysLeft <= 7 ? "destructive" : "outline"} className="text-[10px]">
                      {c.trialDaysLeft}d left
                    </Badge>
                  ) : c.subscriptionStatus === "trial_expired" ? (
                    <Badge variant="destructive" className="text-[10px]">Expired</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">{c.subscriptionStatus ?? "—"}</Badge>
                  )}
                </td>
                <td className="py-2 pr-3">
                  {(() => {
                    if (!c.hasMigrationRow) {
                      return <span className="text-muted-foreground italic text-[10px]">Not Started</span>;
                    }
                    return (
                      <div className="flex items-center gap-1">
                        <div className="flex gap-0.5">
                          {[0, 1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              className={`h-2 w-2 rounded-full ${i < c.onboardingSteps ? "bg-primary" : "bg-muted"}`}
                            />
                          ))}
                        </div>
                        <span className="text-muted-foreground ml-1">{c.onboardingSteps}/5</span>
                      </div>
                    );
                  })()}
                </td>
                <td className="py-2 pr-3 text-right text-foreground">{c.trucks}</td>
                <td className="py-2 pr-3 text-right text-foreground">{c.patients}</td>
                <td className="py-2 pr-3 text-right text-foreground">{c.tripsThisMonth}</td>
                <td className="py-2 pr-3 text-right text-foreground">{c.billingCompleteRate}%</td>
                <td className="py-2 text-muted-foreground">
                  {c.lastActivity ? format(new Date(c.lastActivity), "MMM d") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
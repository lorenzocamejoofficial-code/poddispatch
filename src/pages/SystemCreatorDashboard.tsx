import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Building2, Users, TrendingUp, AlertTriangle, Activity,
  Truck, Code2, BarChart3,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DevModePanel } from "@/components/creator/DevModePanel";
import { CreatorLayout } from "@/components/layout/CreatorLayout";
import { CompanyHealthTable } from "@/components/creator/CompanyHealthTable";
import { SaaSMetricsTab } from "@/components/creator/SaaSMetricsTab";

interface SystemMetrics {
  totalCompanies: number;
  totalUsers: number;
  totalTrucks: number;
  totalTrips: number;
  totalClaims: number;
  cleanClaimRate: number;
  avgDispatchEfficiency: number;
  systemErrors: number;
}

export default function SystemCreatorDashboard() {
  const { isSystemCreator } = useAuth();
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState<SystemMetrics>({
    totalCompanies: 0, totalUsers: 0, totalTrucks: 0, totalTrips: 0,
    totalClaims: 0, cleanClaimRate: 0, avgDispatchEfficiency: 0, systemErrors: 0,
  });
  const [loading, setLoading] = useState(true);
  const [devMode, setDevMode] = useState(false);

  useEffect(() => {
    if (!isSystemCreator) { navigate("/"); return; }
    loadMetrics();
  }, [isSystemCreator, navigate]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const [companies, profiles, trucks, trips, claims] = await Promise.all([
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("trucks").select("id", { count: "exact", head: true }),
        supabase.from("trip_records").select("id, status, claim_ready", { count: "exact" }),
        supabase.from("claim_records").select("id, status", { count: "exact" }),
      ]);

      const totalTrips = trips.count ?? 0;
      const tripData = trips.data ?? [];
      const completedTrips = tripData.filter(t => t.status === "completed" || t.status === "ready_for_billing").length;
      const cleanTrips = tripData.filter(t => t.claim_ready).length;

      setMetrics({
        totalCompanies: companies.count ?? 0,
        totalUsers: profiles.count ?? 0,
        totalTrucks: trucks.count ?? 0,
        totalTrips: totalTrips,
        totalClaims: claims.count ?? 0,
        cleanClaimRate: totalTrips > 0 ? Math.round((cleanTrips / totalTrips) * 100) : 0,
        avgDispatchEfficiency: totalTrips > 0 ? Math.round((completedTrips / totalTrips) * 100) : 0,
        systemErrors: 0,
      });
    } catch (err) {
      console.error("Failed to load system metrics:", err);
    }
    setLoading(false);
  };

  return (
    <CreatorLayout title="System Creator Dashboard">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="overview" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="metrics" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> SaaS Metrics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {/* Dev Mode toggle in content area */}
          <div className="flex items-center gap-2 mb-4">
            <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Dev Mode</span>
            <Switch checked={devMode} onCheckedChange={setDevMode} />
          </div>

          {/* How this works */}
          <Collapsible className="mb-6">
            <CollapsibleTrigger className="text-xs text-primary hover:underline">
              ℹ️ How this works
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p>This dashboard shows anonymized system-level metrics across all companies.</p>
              <p>No patient names, addresses, or DOBs are shown — only aggregate counts and percentages.</p>
              <p>Enable <strong>Dev Mode</strong> to inspect routes, feature flags, permissions, and schema.</p>
            </CollapsibleContent>
          </Collapsible>

          {/* Dev Mode Panel */}
          {devMode && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Code2 className="h-4 w-4 text-primary" />
                Developer Mode
              </h3>
              <DevModePanel />
            </div>
          )}

          {loading ? (
            <p className="text-muted-foreground">Loading system metrics...</p>
          ) : (
            <div className="space-y-6">
              {/* Platform Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard icon={Building2} label="Companies" value={metrics.totalCompanies} />
                <MetricCard icon={Users} label="Total Users" value={metrics.totalUsers} />
                <MetricCard icon={Truck} label="Total Trucks" value={metrics.totalTrucks} />
                <MetricCard icon={Activity} label="Total Trips" value={metrics.totalTrips} />
              </div>

              {/* Performance */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Clean Claim Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-foreground">{metrics.cleanClaimRate}%</div>
                    <p className="text-xs text-muted-foreground mt-1">{metrics.totalClaims} total claims tracked</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Dispatch Efficiency</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-foreground">{metrics.avgDispatchEfficiency}%</div>
                    <p className="text-xs text-muted-foreground mt-1">Completed / Total trips</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" /> System Errors
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-foreground">{metrics.systemErrors}</div>
                    <p className="text-xs text-muted-foreground mt-1">Last 24h</p>
                  </CardContent>
                </Card>
              </div>

              {/* Feature Usage placeholder */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Feature Usage Heatmap
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-2 text-xs">
                    {["Dispatch Board", "Scheduling", "Trips", "Billing", "Patients", "Facilities", "Crew Schedule", "Reports", "Compliance", "Settings"].map((feature) => (
                      <div key={feature} className="rounded border bg-muted/30 p-2 text-center">
                        <p className="text-muted-foreground">{feature}</p>
                        <p className="font-bold text-foreground mt-1">—</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Usage tracking will populate as companies use the platform.
                  </p>
                </CardContent>
              </Card>

              {/* Per-Company Health */}
              <CompanyHealthTable />
            </div>
          )}
        </TabsContent>

        <TabsContent value="metrics">
          <SaaSMetricsTab />
        </TabsContent>
      </Tabs>
    </CreatorLayout>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

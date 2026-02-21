import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ConfirmActionDialog } from "@/components/ConfirmActionDialog";
import {
  Building2, Search, CheckCircle2, XCircle, Ban, RefreshCw,
  Mail, ShieldCheck, LogOut, LayoutDashboard, FlaskConical, Settings2,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { useSandboxMode } from "@/hooks/useSandboxMode";
import { PreviewRoleBar } from "@/components/creator/PreviewRoleBar";

interface CompanyRecord {
  id: string;
  name: string;
  onboarding_status: string;
  owner_email: string | null;
  created_at: string;
  approved_at: string | null;
  rejected_reason: string | null;
  suspended_reason: string | null;
}

interface SubscriptionRecord {
  company_id: string;
  provider_subscription_id: string | null;
  subscription_status: string;
  last_payment_status: string | null;
  plan_id: string;
}

export default function CreatorConsole() {
  const { user, signOut, isSystemCreator } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { sandboxMode } = useSandboxMode();
  const [search, setSearch] = useState("");
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [subscriptions, setSubscriptions] = useState<Record<string, SubscriptionRecord>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSystemCreator) { navigate("/"); return; }
    loadCompanies();
  }, [isSystemCreator, navigate]);

  const loadCompanies = async () => {
    setLoading(true);
    const { data: companiesData } = await supabase
      .from("companies")
      .select("id, name, onboarding_status, owner_email, created_at, approved_at, rejected_reason, suspended_reason")
      .order("created_at", { ascending: false });

    const { data: subsData } = await supabase
      .from("subscription_records")
      .select("company_id, provider_subscription_id, subscription_status, last_payment_status, plan_id");

    setCompanies((companiesData as any[]) ?? []);
    const subsMap: Record<string, SubscriptionRecord> = {};
    (subsData ?? []).forEach((s: any) => { subsMap[s.company_id] = s; });
    setSubscriptions(subsMap);
    setLoading(false);
  };

  const filtered = companies.filter((c) => {
    const q = search.toLowerCase();
    return (
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.owner_email ?? "").toLowerCase().includes(q) ||
      c.id.includes(q)
    );
  });

  const updateCompanyStatus = async (
    companyId: string,
    status: string,
    extra: Record<string, any> = {},
    eventType: string,
    reason?: string
  ) => {
    const { error } = await supabase
      .from("companies")
      .update({ onboarding_status: status, ...extra } as any)
      .eq("id", companyId);

    if (error) {
      toast.error("Failed: " + error.message);
      return;
    }

    // Log onboarding event
    await supabase.from("onboarding_events").insert({
      company_id: companyId,
      event_type: eventType,
      actor_user_id: user?.id,
      actor_email: user?.email,
      reason,
      details: { new_status: status },
    } as any);

    toast.success(`Company ${status === "active" ? "approved" : status}`);
    loadCompanies();
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "active": return "bg-[hsl(var(--status-green-bg))] text-[hsl(var(--status-green))]";
      case "pending_approval": return "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]";
      case "rejected":
      case "suspended":
      case "payment_issue": return "bg-[hsl(var(--status-red-bg))] text-[hsl(var(--status-red))]";
      default: return "bg-[hsl(var(--status-pending-bg))] text-[hsl(var(--status-pending))]";
    }
  };

  const sidebarItems = [
    { path: "/system", label: "System Dashboard", icon: LayoutDashboard },
    { path: "/creator-console", label: "Company Console", icon: Settings2 },
    { path: "/simulation", label: "Company Simulation", icon: FlaskConical },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[hsl(var(--dispatch-surface))]">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-60 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <ShieldCheck className="h-5 w-5 text-sidebar-primary" />
          <span className="font-bold text-sidebar-primary">PodDispatch</span>
          <Badge variant="outline" className="ml-auto text-[9px]">CREATOR</Badge>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {sidebarItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-1 px-3">
            <span className="text-xs text-sidebar-foreground/50 truncate">{user?.email}</span>
          </div>
           <button
            onClick={() => { signOut(); localStorage.clear(); navigate("/login"); }}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-3 border-b bg-card px-4 lg:px-6">
          <h2 className="text-lg font-semibold text-foreground flex-1">Company Console</h2>
          <PreviewRoleBar />
          <Badge variant="secondary" className="text-xs">No PHI — Onboarding Only</Badge>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { signOut(); localStorage.clear(); navigate("/login"); }}
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
          {/* How this works */}
          <Collapsible>
            <CollapsibleTrigger className="text-xs text-primary hover:underline">
              ℹ️ How this works
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p>Search and manage company onboarding. Approve, reject, suspend, or retry provisioning.</p>
              <p>All override actions require typing OVERRIDE and a reason. Actions are logged for audit.</p>
              <p>No patient data (PHI) is visible here — only company names, emails, and statuses.</p>
            </CollapsibleContent>
          </Collapsible>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by company name, owner email, or ID..."
              className="pl-10"
            />
          </div>

          {/* Companies list */}
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading companies...</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm">No companies found.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((company) => {
                const sub = subscriptions[company.id];
                return (
                  <Card key={company.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-semibold text-foreground">{company.name}</span>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor(company.onboarding_status)}`}>
                              {company.onboarding_status.replace(/_/g, " ").toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {company.owner_email ?? "No owner email"} · Created{" "}
                            {new Date(company.created_at).toLocaleDateString()}
                          </p>
                          {sub && (
                            <p className="text-xs text-muted-foreground">
                              Plan: {sub.plan_id} · Payment: {sub.subscription_status}
                              {sub.last_payment_status ? ` (${sub.last_payment_status})` : ""}
                            </p>
                          )}
                          {company.rejected_reason && (
                            <p className="text-xs text-destructive">Rejected: {company.rejected_reason}</p>
                          )}
                          {company.suspended_reason && (
                            <p className="text-xs text-destructive">Suspended: {company.suspended_reason}</p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {company.onboarding_status === "pending_approval" && (
                            <>
                              <ConfirmActionDialog
                                trigger={
                                  <Button size="sm" variant="default" className="gap-1 text-xs">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                                  </Button>
                                }
                                title="Approve Company"
                                description={`Activate "${company.name}" and grant full access?`}
                                confirmWord="OVERRIDE"
                                requireReason
                                destructive={false}
                                onConfirm={(reason) =>
                                  updateCompanyStatus(
                                    company.id,
                                    "active",
                                    { approved_at: new Date().toISOString(), approved_by: user?.id },
                                    "approved",
                                    reason
                                  )
                                }
                              />
                              <ConfirmActionDialog
                                trigger={
                                  <Button size="sm" variant="destructive" className="gap-1 text-xs">
                                    <XCircle className="h-3.5 w-3.5" /> Reject
                                  </Button>
                                }
                                title="Reject Company"
                                description={`Reject "${company.name}"? Access will be locked. Data will NOT be deleted.`}
                                confirmWord="OVERRIDE"
                                requireReason
                                onConfirm={(reason) =>
                                  updateCompanyStatus(
                                    company.id,
                                    "rejected",
                                    { rejected_at: new Date().toISOString(), rejected_reason: reason },
                                    "rejected",
                                    reason
                                  )
                                }
                              />
                            </>
                          )}

                          {company.onboarding_status === "active" && (
                            <ConfirmActionDialog
                              trigger={
                                <Button size="sm" variant="outline" className="gap-1 text-xs text-destructive">
                                  <Ban className="h-3.5 w-3.5" /> Suspend
                                </Button>
                              }
                              title="Suspend Company"
                              description={`Lock access for "${company.name}"?`}
                              confirmWord="OVERRIDE"
                              requireReason
                              onConfirm={(reason) =>
                                updateCompanyStatus(
                                  company.id,
                                  "suspended",
                                  { suspended_reason: reason },
                                  "suspended",
                                  reason
                                )
                              }
                            />
                          )}

                          {(company.onboarding_status === "rejected" ||
                            company.onboarding_status === "suspended") && (
                            <ConfirmActionDialog
                              trigger={
                                <Button size="sm" variant="default" className="gap-1 text-xs">
                                  <RefreshCw className="h-3.5 w-3.5" /> Reactivate
                                </Button>
                              }
                              title="Reactivate Company"
                              description={`Re-activate "${company.name}" and restore access?`}
                              confirmWord="OVERRIDE"
                              requireReason
                              destructive={false}
                              onConfirm={(reason) =>
                                updateCompanyStatus(
                                  company.id,
                                  "active",
                                  {
                                    approved_at: new Date().toISOString(),
                                    approved_by: user?.id,
                                    suspended_reason: null,
                                    rejected_reason: null,
                                  },
                                  "reactivated",
                                  reason
                                )
                              }
                            />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

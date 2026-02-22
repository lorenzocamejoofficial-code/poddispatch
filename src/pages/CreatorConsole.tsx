import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Building2, Search, CheckCircle2, XCircle, Ban, RefreshCw,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ConfirmActionDialog } from "@/components/ConfirmActionDialog";
import { toast } from "sonner";
import { CreatorLayout } from "@/components/layout/CreatorLayout";

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
  const { user, isSystemCreator } = useAuth();
  const navigate = useNavigate();
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
      .in("onboarding_status", ["active", "suspended"])
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
    return !q || c.name.toLowerCase().includes(q) || (c.owner_email ?? "").toLowerCase().includes(q) || c.id.includes(q);
  });

  const updateCompanyStatus = async (
    companyId: string, status: string, extra: Record<string, any> = {}, eventType: string, reason?: string
  ) => {
    const { error } = await supabase.from("companies").update({ onboarding_status: status, ...extra } as any).eq("id", companyId);
    if (error) { toast.error("Failed: " + error.message); return; }
    await supabase.from("onboarding_events").insert({
      company_id: companyId, event_type: eventType, actor_user_id: user?.id, actor_email: user?.email, reason, details: { new_status: status },
    } as any);
    toast.success(`Company ${status === "active" ? "approved" : status}`);
    loadCompanies();
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "active": return "bg-[hsl(var(--status-green-bg))] text-[hsl(var(--status-green))]";
      case "pending_approval": return "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]";
      case "rejected": case "suspended": case "payment_issue": return "bg-[hsl(var(--status-red-bg))] text-[hsl(var(--status-red))]";
      default: return "bg-[hsl(var(--status-pending-bg))] text-[hsl(var(--status-pending))]";
    }
  };

  return (
    <CreatorLayout title="Company Console">
      <Collapsible className="mb-4">
        <CollapsibleTrigger className="text-xs text-primary hover:underline">ℹ️ How this works</CollapsibleTrigger>
        <CollapsibleContent className="mt-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
          <p>Manage approved companies here — view status, suspend access, or reactivate accounts.</p>
          <p>Pending companies are handled separately in the <strong>Pending Companies</strong> page.</p>
          <p>All override actions require typing OVERRIDE and a reason. Actions are logged for audit.</p>
        </CollapsibleContent>
      </Collapsible>

      <div className="relative max-w-md mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by company name, owner email, or ID..." className="pl-10" />
      </div>

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
                        {company.owner_email ?? "No owner email"} · Created {new Date(company.created_at).toLocaleDateString()}
                      </p>
                      {sub && (
                        <p className="text-xs text-muted-foreground">
                          Plan: {sub.plan_id} · Payment: {sub.subscription_status}
                          {sub.last_payment_status ? ` (${sub.last_payment_status})` : ""}
                        </p>
                      )}
                      {company.rejected_reason && <p className="text-xs text-destructive">Rejected: {company.rejected_reason}</p>}
                      {company.suspended_reason && <p className="text-xs text-destructive">Suspended: {company.suspended_reason}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {company.onboarding_status === "pending_approval" && (
                        <>
                          <ConfirmActionDialog
                            trigger={<Button size="sm" variant="default" className="gap-1 text-xs"><CheckCircle2 className="h-3.5 w-3.5" /> Approve</Button>}
                            title="Approve Company" description={`Activate "${company.name}" and grant full access?`}
                            confirmWord="OVERRIDE" requireReason destructive={false}
                            onConfirm={(reason) => updateCompanyStatus(company.id, "active", { approved_at: new Date().toISOString(), approved_by: user?.id }, "approved", reason)}
                          />
                          <ConfirmActionDialog
                            trigger={<Button size="sm" variant="destructive" className="gap-1 text-xs"><XCircle className="h-3.5 w-3.5" /> Reject</Button>}
                            title="Reject Company" description={`Reject "${company.name}"?`}
                            confirmWord="OVERRIDE" requireReason
                            onConfirm={(reason) => updateCompanyStatus(company.id, "rejected", { rejected_at: new Date().toISOString(), rejected_reason: reason }, "rejected", reason)}
                          />
                        </>
                      )}
                      {company.onboarding_status === "active" && (
                        <ConfirmActionDialog
                          trigger={<Button size="sm" variant="outline" className="gap-1 text-xs text-destructive"><Ban className="h-3.5 w-3.5" /> Suspend</Button>}
                          title="Suspend Company" description={`Lock access for "${company.name}"?`}
                          confirmWord="OVERRIDE" requireReason
                          onConfirm={(reason) => updateCompanyStatus(company.id, "suspended", { suspended_reason: reason }, "suspended", reason)}
                        />
                      )}
                      {(company.onboarding_status === "rejected" || company.onboarding_status === "suspended") && (
                        <ConfirmActionDialog
                          trigger={<Button size="sm" variant="default" className="gap-1 text-xs"><RefreshCw className="h-3.5 w-3.5" /> Reactivate</Button>}
                          title="Reactivate Company" description={`Re-activate "${company.name}"?`}
                          confirmWord="OVERRIDE" requireReason destructive={false}
                          onConfirm={(reason) => updateCompanyStatus(company.id, "active", { approved_at: new Date().toISOString(), approved_by: user?.id, suspended_reason: null, rejected_reason: null }, "reactivated", reason)}
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
    </CreatorLayout>
  );
}

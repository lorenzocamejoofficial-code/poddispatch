import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CreatorLayout } from "@/components/layout/CreatorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Building2, Mail, Calendar, Users, CreditCard,
  LifeBuoy, ShieldCheck, AlertTriangle, Activity, ExternalLink,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface Company {
  id: string; name: string; onboarding_status: string;
  owner_email: string | null; owner_user_id: string | null;
  created_at: string; approved_at: string | null;
  suspended_at: string | null; suspended_reason: string | null;
  npi_number: string | null; state_of_operation: string | null;
  current_software: string | null; years_in_operation: number | null;
  has_inhouse_biller: boolean | null; hipaa_privacy_officer: string | null;
  deleted_at: string | null;
}

interface Subscription {
  plan_id: string; subscription_status: string;
  monthly_amount_cents: number; trial_ends_at: string | null;
  current_period_end: string | null; last_payment_at: string | null;
  last_payment_status: string | null; is_founding: boolean;
}

interface Ticket {
  id: string; ticket_number: string | null; subject: string | null;
  severity: string; status: string; created_at: string;
}

interface Profile {
  id: string; full_name: string | null; email: string | null;
  role: string | null; created_at: string;
}

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (["active", "approved", "trialing"].includes(s)) return "default";
  if (["pending", "pending_approval"].includes(s)) return "secondary";
  if (["suspended", "rejected", "past_due", "canceled"].includes(s)) return "destructive";
  return "outline";
}

export default function CreatorCompanyDetail() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<Company | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [counts, setCounts] = useState({ trips: 0, claims: 0, employees: 0 });

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      setLoading(true);
      const [companyR, subR, ticketsR, profilesR, tripsR, claimsR] = await Promise.all([
        supabase.from("companies").select("*").eq("id", companyId).maybeSingle(),
        supabase.from("subscription_records").select("*").eq("company_id", companyId).maybeSingle(),
        supabase.from("support_tickets").select("id,ticket_number,subject,severity,status,created_at").eq("company_id", companyId).order("created_at", { ascending: false }).limit(10),
        supabase.from("profiles").select("id,full_name,email,role,created_at").eq("company_id", companyId).order("created_at", { ascending: true }).limit(50),
        supabase.from("trip_records").select("id", { count: "exact", head: true }).eq("company_id", companyId),
        supabase.from("claim_records").select("id", { count: "exact", head: true }).eq("company_id", companyId),
      ]);
      setCompany((companyR.data as any) ?? null);
      setSubscription((subR.data as any) ?? null);
      setTickets((ticketsR.data as any) ?? []);
      setProfiles((profilesR.data as any) ?? []);
      setCounts({
        trips: tripsR.count ?? 0,
        claims: claimsR.count ?? 0,
        employees: (profilesR.data as any[] | null)?.length ?? 0,
      });
      setLoading(false);
    })();
  }, [companyId]);

  if (loading) {
    return (
      <CreatorLayout title="Company Detail">
        <div className="space-y-4 p-6">
          <Skeleton className="h-12 w-1/2" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      </CreatorLayout>
    );
  }

  if (!company) {
    return (
      <CreatorLayout title="Company Detail">
        <div className="p-6">
          <Button variant="ghost" onClick={() => navigate("/creator-console")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Console
          </Button>
          <p className="mt-4 text-muted-foreground">Company not found.</p>
        </div>
      </CreatorLayout>
    );
  }

  const mrr = subscription ? (subscription.monthly_amount_cents / 100).toFixed(2) : "0.00";
  const trialDaysLeft = subscription?.trial_ends_at
    ? Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const openTickets = tickets.filter(t => t.status !== "resolved" && t.status !== "closed").length;

  return (
    <CreatorLayout title={company.name}>
      <div className="p-6 space-y-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/creator-console")} className="mb-2 -ml-2">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Console
            </Button>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Building2 className="h-7 w-7 text-primary" />
              {company.name}
            </h1>
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <Badge variant={statusVariant(company.onboarding_status)}>{company.onboarding_status}</Badge>
              {company.suspended_at && <Badge variant="destructive">Suspended</Badge>}
              {company.deleted_at && <Badge variant="destructive">Deleted</Badge>}
              <span>•</span>
              <span>Created {format(new Date(company.created_at), "MMM d, yyyy")}</span>
              <span>•</span>
              <span>{formatDistanceToNow(new Date(company.created_at), { addSuffix: true })}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/creator-console">
                <ExternalLink className="h-4 w-4 mr-2" /> Open in Console
              </Link>
            </Button>
          </div>
        </div>

        {/* Suspension banner */}
        {company.suspended_at && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="pt-6 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-destructive">Suspended {formatDistanceToNow(new Date(company.suspended_at), { addSuffix: true })}</p>
                <p className="text-sm text-muted-foreground mt-1">{company.suspended_reason || "No reason provided"}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPI tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide"><CreditCard className="h-3 w-3" /> MRR</div>
              <p className="text-2xl font-bold mt-1">${mrr}</p>
              <p className="text-xs text-muted-foreground mt-1">{subscription?.subscription_status ?? "no subscription"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide"><Calendar className="h-3 w-3" /> Trial</div>
              <p className="text-2xl font-bold mt-1">
                {trialDaysLeft === null ? "—" : trialDaysLeft <= 0 ? "Ended" : `${trialDaysLeft}d`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {subscription?.trial_ends_at ? format(new Date(subscription.trial_ends_at), "MMM d") : "No trial"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide"><Activity className="h-3 w-3" /> Volume</div>
              <p className="text-2xl font-bold mt-1">{counts.trips}</p>
              <p className="text-xs text-muted-foreground mt-1">{counts.claims} claims</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide"><LifeBuoy className="h-3 w-3" /> Tickets</div>
              <p className="text-2xl font-bold mt-1">{openTickets}</p>
              <p className="text-xs text-muted-foreground mt-1">{tickets.length} total · {counts.employees} employees</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Subscription */}
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> Subscription</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {subscription ? (
                <>
                  <Row label="Plan" value={subscription.plan_id} />
                  <Row label="Status" value={<Badge variant={statusVariant(subscription.subscription_status)}>{subscription.subscription_status}</Badge>} />
                  <Row label="Monthly" value={`$${mrr}`} />
                  <Row label="Trial ends" value={subscription.trial_ends_at ? format(new Date(subscription.trial_ends_at), "PPP") : "—"} />
                  <Row label="Period ends" value={subscription.current_period_end ? format(new Date(subscription.current_period_end), "PPP") : "—"} />
                  <Row label="Last payment" value={subscription.last_payment_at ? `${format(new Date(subscription.last_payment_at), "PPP")} (${subscription.last_payment_status})` : "Never"} />
                  {subscription.is_founding && <Badge variant="outline">Founding Member</Badge>}
                </>
              ) : <p className="text-muted-foreground">No subscription record.</p>}
            </CardContent>
          </Card>

          {/* Company info */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Company</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Owner" value={<span className="flex items-center gap-1"><Mail className="h-3 w-3" />{company.owner_email || "—"}</span>} />
              <Row label="NPI" value={company.npi_number || "—"} />
              <Row label="State" value={company.state_of_operation || "—"} />
              <Row label="Current SW" value={company.current_software || "—"} />
              <Row label="Years operating" value={company.years_in_operation?.toString() || "—"} />
              <Row label="In-house biller" value={company.has_inhouse_biller ? "Yes" : "No"} />
              <Row label="Privacy officer" value={company.hipaa_privacy_officer || "—"} />
              {company.approved_at && <Row label="Approved" value={format(new Date(company.approved_at), "PPP")} />}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tickets */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><LifeBuoy className="h-4 w-4" /> Recent Tickets</CardTitle></CardHeader>
            <CardContent>
              {tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tickets.</p>
              ) : (
                <ul className="space-y-2">
                  {tickets.map(t => (
                    <li key={t.id} className="flex items-center justify-between border-b last:border-0 pb-2 last:pb-0 gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.subject || t.ticket_number || "Untitled"}</p>
                        <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Badge variant={t.severity === "urgent" ? "destructive" : "outline"}>{t.severity}</Badge>
                        <Badge variant={statusVariant(t.status)}>{t.status}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Users */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Users ({profiles.length})</CardTitle></CardHeader>
            <CardContent>
              {profiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No users.</p>
              ) : (
                <ul className="space-y-2 max-h-72 overflow-auto">
                  {profiles.map(p => (
                    <li key={p.id} className="flex items-center justify-between border-b last:border-0 pb-2 last:pb-0 gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.full_name || "—"}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0">{p.role || "user"}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </CreatorLayout>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
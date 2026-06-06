import { useEffect, useState } from "react";
import { Truck, Clock, Mail, LogOut, BookOpen, CheckCircle2, Users, BarChart3, FileText, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { US_STATES } from "@/lib/us-states";
import { toast } from "@/hooks/use-toast";

const trainingModules = [
  {
    title: "Dispatch Operations",
    description: "Learn how to manage daily dispatch, assign crews to trucks, and track real-time trip status.",
    icon: Truck,
    duration: "5 min read",
    topics: ["Dispatch Board overview", "Status workflow (pending → completed)", "Alert management"],
  },
  {
    title: "Patient Scheduling",
    description: "Understand how to set up recurring dialysis runs, outpatient transports, and ad-hoc trips.",
    icon: Users,
    duration: "7 min read",
    topics: ["Scheduling legs (A-leg / B-leg)", "Template builder", "Run pool management"],
  },
  {
    title: "Billing & Claims",
    description: "Walk through the claims lifecycle from trip completion to payer submission.",
    icon: BarChart3,
    duration: "6 min read",
    topics: ["Clean trip validation", "HCPCS coding", "Denial management"],
  },
  {
    title: "Compliance & HIPAA",
    description: "Review compliance requirements, QA review workflows, and audit logging.",
    icon: FileText,
    duration: "4 min read",
    topics: ["QA flag review", "Audit trail", "Session security"],
  },
];

export default function PendingApproval() {
  const { signOut, onboardingStatus, activeCompanyId, refreshOnboardingStatus } = useAuth();
  const navigate = useNavigate();
  const [expandedModule, setExpandedModule] = useState<number | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [resubmitOpen, setResubmitOpen] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [form, setForm] = useState<any>({});
  const [formError, setFormError] = useState<string>("");

  const isRejected = onboardingStatus === "rejected";

  useEffect(() => {
    if (!activeCompanyId) return;
    supabase
      .from("companies")
      .select("id, name, npi_number, ein_number, address_street, address_city, address_state, address_zip, state_of_operation, service_area_type, truck_count, hipaa_privacy_officer, rejected_reason, rejected_at")
      .eq("id", activeCompanyId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCompany(data);
          setForm({
            name: data.name ?? "",
            npi_number: data.npi_number ?? "",
            ein_number: data.ein_number ?? "",
            address_street: data.address_street ?? "",
            address_city: data.address_city ?? "",
            address_state: data.address_state ?? data.state_of_operation ?? "",
            address_zip: data.address_zip ?? "",
            state_of_operation: data.state_of_operation ?? "",
            service_area_type: data.service_area_type ?? "",
            truck_count: data.truck_count ?? "",
            hipaa_privacy_officer: data.hipaa_privacy_officer ?? "",
          });
        }
      });
  }, [activeCompanyId, isRejected]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const handleResubmit = async () => {
    setFormError("");
    // Client-side guard for clarity; server validates definitively.
    const npi = String(form.npi_number ?? "").replace(/\D/g, "");
    const ein = String(form.ein_number ?? "").replace(/\D/g, "");
    if (!form.name?.trim()) return setFormError("Dispatch name is required.");
    if (npi.length !== 10) return setFormError("NPI must be exactly 10 digits.");
    if (ein.length !== 9) return setFormError("EIN must be exactly 9 digits.");
    if (!form.state_of_operation) return setFormError("State of operation is required.");
    if (!form.address_street?.trim()) return setFormError("Street address is required.");
    if (!form.address_city?.trim()) return setFormError("City is required.");
    if (!/^\d{5}$/.test(String(form.address_zip ?? "").trim())) return setFormError("ZIP must be exactly 5 digits.");
    if (!form.service_area_type) return setFormError("Service area type is required.");
    if (!form.truck_count || Number(form.truck_count) < 1) return setFormError("Number of active trucks is required.");

    setResubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-company", {
        body: {
          companyId: activeCompanyId,
          action: "resubmit",
          patch: {
            ...form,
            npi_number: npi,
            ein_number: ein,
            truck_count: Number(form.truck_count),
          },
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Application resubmitted", description: "Your application has been sent back for review." });
      setResubmitOpen(false);
      await refreshOnboardingStatus();
    } catch (err: any) {
      setFormError(err.message || "Resubmit failed.");
    }
    setResubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" />
          <span className="font-bold text-foreground">PodDispatch</span>
          <Badge variant="outline" className="text-[10px] ml-2">
            {isRejected ? "Application Rejected" : "Access Pending"}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2 text-muted-foreground">
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </Button>
      </header>

      <div className="max-w-4xl mx-auto p-4 lg:p-8 space-y-6">
        {/* Status Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Clock className="h-8 w-8 text-primary" />
              </div>

              <h1 className="text-xl font-bold text-foreground mb-2">
                {isRejected ? "Application Not Approved" : "Account Pending Approval"}
              </h1>

              <p className="text-sm text-muted-foreground max-w-md">
                {isRejected
                  ? "Your company application was not approved. Review the reason below, update the flagged details, and resubmit."
                  : "Your company account is being reviewed by the PodDispatch team. You'll receive an email notification when your account is activated."}
              </p>
            </div>

            {isRejected && (
              <div className="mb-6 max-w-xl mx-auto rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Reason from reviewer</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {company?.rejected_reason?.trim() || "No reason was provided. Contact support if you need more detail."}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end mt-4">
                  <Button size="sm" onClick={() => setResubmitOpen(true)} disabled={!company}>
                    Edit & Resubmit Application
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-lg border bg-card p-4 space-y-3 text-sm max-w-sm mx-auto">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Truck className="h-4 w-4 shrink-0" />
                <span>Company setup complete</span>
                <span className="ml-auto text-xs text-[hsl(var(--status-green))]">✓</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                <span>Legal agreements accepted</span>
                <span className="ml-auto text-xs text-[hsl(var(--status-green))]">✓</span>
              </div>
              <div className="flex items-center gap-2 text-foreground font-medium">
                <Clock className="h-4 w-4 shrink-0 text-[hsl(var(--status-yellow))]" />
                <span>{isRejected ? "Application reviewed" : "Awaiting manual approval"}</span>
                <span className="ml-auto text-xs">
                  {isRejected ? "✗" : "⏳"}
                </span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-4">
              {isRejected
                ? "Need help? Contact "
                : "This usually takes less than 24 hours. If you have questions, contact "}
              <span className="font-medium text-foreground">support@thepoddispatch.com</span>.
            </p>
          </CardContent>
        </Card>

        {/* Training Mode */}
        {!isRejected && (
          <>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Training Mode</h2>
              <Badge variant="secondary" className="text-[10px]">Available Now</Badge>
            </div>

            <p className="text-sm text-muted-foreground -mt-4">
              While your account is being reviewed, explore how PodDispatch works. These training modules cover every major feature you'll use once approved.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trainingModules.map((mod, i) => (
                <Card
                  key={i}
                  className="cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => setExpandedModule(expandedModule === i ? null : i)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-primary/10 p-2">
                          <mod.icon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-medium">{mod.title}</CardTitle>
                          <span className="text-[10px] text-muted-foreground">{mod.duration}</span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-2">{mod.description}</p>
                    {expandedModule === i && (
                      <ul className="space-y-1.5 mt-3 border-t pt-3">
                        {mod.topics.map((topic, j) => (
                          <li key={j} className="flex items-center gap-2 text-xs text-foreground">
                            <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                            {topic}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={resubmitOpen} onOpenChange={setResubmitOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resubmit Application</DialogTitle>
            <DialogDescription>
              Update the flagged details below, then resubmit. Your status will return to "Pending Approval" and the previous rejection will be cleared.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          )}

          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Dispatch Name</Label>
              <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>NPI (10 digits)</Label>
                <Input value={form.npi_number ?? ""} onChange={(e) => setForm({ ...form, npi_number: e.target.value.replace(/\D/g, "").slice(0, 10) })} />
              </div>
              <div className="space-y-1.5">
                <Label>EIN (9 digits)</Label>
                <Input value={form.ein_number ?? ""} onChange={(e) => setForm({ ...form, ein_number: e.target.value.replace(/\D/g, "").slice(0, 9) })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Street Address</Label>
              <Input value={form.address_street ?? ""} onChange={(e) => setForm({ ...form, address_street: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>City</Label>
                <Input value={form.address_city ?? ""} onChange={(e) => setForm({ ...form, address_city: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>ZIP</Label>
                <Input value={form.address_zip ?? ""} onChange={(e) => setForm({ ...form, address_zip: e.target.value.replace(/\D/g, "").slice(0, 5) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>State of Operation</Label>
                <Select value={form.state_of_operation ?? ""} onValueChange={(v) => setForm({ ...form, state_of_operation: v, address_state: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Service Area</Label>
                <Select value={form.service_area_type ?? ""} onValueChange={(v) => setForm({ ...form, service_area_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urban">Urban</SelectItem>
                    <SelectItem value="suburban">Suburban</SelectItem>
                    <SelectItem value="rural">Rural</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Active Trucks</Label>
                <Input type="number" min={1} value={form.truck_count ?? ""} onChange={(e) => setForm({ ...form, truck_count: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>HIPAA Privacy Officer (optional)</Label>
                <Input value={form.hipaa_privacy_officer ?? ""} onChange={(e) => setForm({ ...form, hipaa_privacy_officer: e.target.value })} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResubmitOpen(false)} disabled={resubmitting}>Cancel</Button>
            <Button onClick={handleResubmit} disabled={resubmitting}>
              {resubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Resubmit Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

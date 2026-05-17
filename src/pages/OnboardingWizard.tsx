import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { US_STATES } from "@/lib/us-states";
import {
  Building2, DollarSign, Network, Truck, Users, UserPlus,
  CheckCircle2, ArrowRight, ArrowLeft, Lock, PartyPopper, ExternalLink,
} from "lucide-react";

const STEPS = [
  {
    icon: Building2,
    title: "Verify Your Company Info",
    description: "Confirm your billing identity, NPI, EIN, and address.",
    blurb: "Captured here because no production page edits company info beyond signup.",
    progressKey: "step_company_info_verified" as const,
  },
  {
    icon: DollarSign,
    title: "Verify Your Rates",
    description: "Confirm your charge master rates by payer.",
    blurb: "Set base rate and mileage rate for each payer you bill. You need at least one payer with both values greater than $0.",
    cta: "Go to Charge Master",
    route: "/billing?tab=charge-master",
    progressKey: "step_rates_verified" as const,
  },
  {
    icon: Network,
    title: "Connect Your Clearinghouse",
    description: "Link PodDispatch to Office Ally for electronic claims.",
    blurb: "Save your Office Ally submitter ID and SFTP credentials so 837P claims can be transmitted automatically.",
    cta: "Go to Clearinghouse Settings",
    route: "/settings?tab=clearinghouse",
    progressKey: "step_clearinghouse_connected" as const,
  },
  {
    icon: Truck,
    title: "Add Your Trucks",
    description: "Set up at least one operational truck.",
    blurb: "Trucks are required to dispatch runs. You can manage equipment flags, vehicle IDs, and inspections from the Trucks page.",
    cta: "Go to Trucks & Crews",
    route: "/trucks",
    progressKey: "step_trucks_added" as const,
  },
  {
    icon: UserPlus,
    title: "Add Your Crew",
    description: "Invite at least one dispatcher, biller, or crew member.",
    blurb: "Add team members from the Employees page. Each invite is sent by email and creates a profile they can sign in with.",
    cta: "Go to Employees",
    route: "/employees",
    progressKey: "step_team_invited" as const,
  },
  {
    icon: Users,
    title: "Add Your First Patient",
    description: "Create a patient record so you can schedule a run.",
    blurb: "Patients are managed on the Patients page, where you can capture demographics, payer info, PCS docs, ICD-10 codes, and standing orders.",
    cta: "Go to Patients",
    route: "/patients",
    progressKey: "step_patients_added" as const,
  },
];

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const { activeCompanyId, refreshWizardStatus } = useAuth();
  const progress = useOnboardingProgress();
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1 — company info (only inline form remaining)
  const [company, setCompany] = useState({
    name: "", npi_number: "", ein_number: "", state_of_operation: "",
    address_street: "", address_city: "", address_state: "", address_zip: "",
  });
  const [companySaving, setCompanySaving] = useState(false);

  // Initial load of company info
  useEffect(() => {
    if (!activeCompanyId) return;
    (async () => {
      const { data } = await supabase
        .from("companies")
        .select("name, npi_number, ein_number, state_of_operation, address_street, address_city, address_state, address_zip")
        .eq("id", activeCompanyId)
        .maybeSingle();
      if (data) setCompany({
        name: data.name ?? "",
        npi_number: data.npi_number ?? "",
        ein_number: (data as any).ein_number ?? "",
        state_of_operation: data.state_of_operation ?? "",
        address_street: (data as any).address_street ?? "",
        address_city: (data as any).address_city ?? "",
        address_state: (data as any).address_state ?? "",
        address_zip: (data as any).address_zip ?? "",
      });
    })();
  }, [activeCompanyId]);

  // Step completion derived from useOnboardingProgress
  const stepDone = [
    progress.step_company_info_verified,
    progress.step_rates_verified,
    progress.step_clearinghouse_connected,
    progress.step_trucks_added,
    progress.step_team_invited,
    progress.step_patients_added,
  ];
  const completedCount = stepDone.filter(Boolean).length;
  const progressPct = (completedCount / 6) * 100;
  const allDone = completedCount === 6;

  // First incomplete step on load
  useEffect(() => {
    if (progress.loading) return;
    const first = stepDone.findIndex(d => !d);
    if (first >= 0) setCurrentStep(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.loading]);

  // Hard-locked navigation: can only open step N if all previous are done
  const canOpen = (i: number) => i === 0 || stepDone.slice(0, i).every(Boolean);

  const StepIcon = STEPS[currentStep].icon;

  // ---------- Step 1: Company ----------
  const validateCompany = (): string | null => {
    if (!company.name.trim()) return "Company name required";
    if (!/^\d{10}$/.test(company.npi_number)) return "NPI must be exactly 10 digits";
    const einDigits = company.ein_number.replace(/\D/g, "");
    if (einDigits.length !== 9) return "EIN must be exactly 9 digits";
    if (!company.state_of_operation) return "State required";
    if (!company.address_street.trim()) return "Street address required";
    if (!company.address_city.trim()) return "City required";
    if (!company.address_state) return "Address state required";
    const zipDigits = company.address_zip.replace(/\D/g, "");
    if (zipDigits.length !== 5 && zipDigits.length !== 9) return "ZIP must be 5 or 9 digits";
    return null;
  };
  const saveCompany = async () => {
    const err = validateCompany();
    if (err) { toast.error(err); return; }
    setCompanySaving(true);
    const { error } = await supabase.from("companies").update({
      name: company.name.trim(),
      npi_number: company.npi_number,
      ein_number: company.ein_number.replace(/\D/g, ""),
      state_of_operation: company.state_of_operation,
      address_street: company.address_street.trim(),
      address_city: company.address_city.trim(),
      address_state: company.address_state,
      address_zip: company.address_zip.replace(/\D/g, ""),
    } as any).eq("id", activeCompanyId!);
    if (error) { toast.error("Save failed: " + error.message); setCompanySaving(false); return; }
    await progress.markStep("step_company_info_verified", true);
    toast.success("Company info saved");
    setCompanySaving(false);
    setCurrentStep(1);
  };

  // ---------- Auto-detect step completion ----------
  // Rates gate: all 5 standard payers present AND none still flagged needs_review.
  // (Medicare is auto-seeded from CMS at company creation; the other 4 are placeholders
  // the owner must confirm in /billing?tab=charge-master.)
  const refreshAutoDetect = async () => {
    if (!activeCompanyId) return;
    const { data: rates } = await supabase
      .from("charge_master")
      .select("payer_type, base_rate, mileage_rate, needs_review")
      .eq("company_id", activeCompanyId);
    const REQUIRED = ["medicare", "medicaid", "private", "self_pay", "default"];
    const byType = new Map((rates ?? []).map((r: any) => [String(r.payer_type).toLowerCase(), r]));
    const allPresent = REQUIRED.every(t => byType.has(t));
    const noneNeedReview = REQUIRED.every(t => {
      const r = byType.get(t);
      return r && r.needs_review === false && Number(r.base_rate) > 0 && Number(r.mileage_rate) > 0;
    });
    const ratesValid = allPresent && noneNeedReview;
    if (ratesValid && !progress.step_rates_verified) {
      await progress.markStep("step_rates_verified", true);
      return;
    }
    // Other steps are auto-detected by useOnboardingProgress on reload.
    await progress.reload();
  };

  // Re-run auto-detect when wizard regains focus (user navigated to a production page and came back)
  useEffect(() => {
    const onFocus = () => { refreshAutoDetect(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId, progress.step_rates_verified]);

  // ---------- Render ----------
  if (progress.loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  // Completion screen
  if (allDone) {
    return (
      <AdminLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <PartyPopper className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-2xl">You're set up.</CardTitle>
              <CardDescription>Your company is fully configured and ready to operate.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {STEPS.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-[hsl(var(--status-green))]" />
                    <span>{s.title}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2 pt-4 border-t">
                <Button onClick={async () => {
                  await supabase.from("migration_settings").update({ wizard_completed: true } as any).eq("company_id", activeCompanyId!);
                  await refreshWizardStatus();
                  navigate("/trucks");
                }} className="gap-2">
                  Assign Crews to Trucks <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={async () => {
                  await supabase.from("migration_settings").update({ wizard_completed: true } as any).eq("company_id", activeCompanyId!);
                  await refreshWizardStatus();
                  navigate("/owner-dashboard");
                }}>
                  View Owner Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  const step = STEPS[currentStep];
  const isStep1 = currentStep === 0;

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Getting Started</h1>
          <p className="text-sm text-muted-foreground">
            Complete each step in order. The wizard guides you through setup — most steps send you to the production page so you can use its full feature set.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{completedCount} of 6 steps complete</span>
            <span className="font-medium">{Math.round(progressPct)}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>

        <div className="flex gap-2 flex-wrap">
          {STEPS.map((s, i) => {
            const open = canOpen(i);
            const done = stepDone[i];
            return (
              <button
                key={i}
                onClick={() => open && setCurrentStep(i)}
                disabled={!open}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  currentStep === i
                    ? "border-primary bg-primary/5 text-primary"
                    : done
                    ? "border-[hsl(var(--status-green))]/30 bg-[hsl(var(--status-green))]/5 text-[hsl(var(--status-green))]"
                    : !open
                    ? "border-border bg-muted/30 text-muted-foreground/60 cursor-not-allowed"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : !open ? <Lock className="h-3.5 w-3.5" /> : <s.icon className="h-3.5 w-3.5" />}
                <span className="hidden md:inline">{i + 1}. {s.title}</span>
                <span className="md:hidden">{i + 1}</span>
              </button>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <StepIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Step {currentStep + 1} — {step.title}</CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </div>
              {stepDone[currentStep] && (
                <Badge variant="outline" className="ml-auto text-[hsl(var(--status-green))] border-[hsl(var(--status-green))]/30">Complete</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* STEP 1: COMPANY INFO — inline form (no production equivalent) */}
            {isStep1 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{step.blurb}</p>
                <div className="space-y-1">
                  <Label>Company Name *</Label>
                  <Input value={company.name} onChange={e => setCompany(c => ({ ...c, name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>NPI * (10 digits)</Label>
                    <Input value={company.npi_number} onChange={e => setCompany(c => ({ ...c, npi_number: e.target.value.replace(/\D/g, "").slice(0, 10) }))} maxLength={10} placeholder="1234567890" />
                  </div>
                  <div className="space-y-1">
                    <Label>EIN * (XX-XXXXXXX)</Label>
                    <Input value={company.ein_number} onChange={e => {
                      const raw = e.target.value.replace(/\D/g, "").slice(0, 9);
                      setCompany(c => ({ ...c, ein_number: raw.length > 2 ? `${raw.slice(0, 2)}-${raw.slice(2)}` : raw }));
                    }} maxLength={10} placeholder="12-3456789" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>State of Operation *</Label>
                  <Select value={company.state_of_operation} onValueChange={v => setCompany(c => ({ ...c, state_of_operation: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                    <SelectContent>{US_STATES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Street Address *</Label>
                  <Input value={company.address_street} onChange={e => setCompany(c => ({ ...c, address_street: e.target.value }))} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>City *</Label>
                    <Input value={company.address_city} onChange={e => setCompany(c => ({ ...c, address_city: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>State *</Label>
                    <Select value={company.address_state} onValueChange={v => setCompany(c => ({ ...c, address_state: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{US_STATES.map(s => <SelectItem key={s.value} value={s.value}>{s.value}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>ZIP *</Label>
                    <Input value={company.address_zip} onChange={e => setCompany(c => ({ ...c, address_zip: e.target.value.replace(/\D/g, "").slice(0, 9) }))} placeholder="12345" />
                  </div>
                </div>
                <Button onClick={saveCompany} disabled={companySaving}>
                  {companySaving ? "Saving..." : "Save & Continue"} <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}

            {/* STEPS 2–6: navigation cards */}
            {!isStep1 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{step.blurb}</p>

                {stepDone[currentStep] ? (
                  <div className="flex items-start gap-3 rounded-lg border border-[hsl(var(--status-green))]/30 bg-[hsl(var(--status-green))]/5 p-4">
                    <CheckCircle2 className="h-5 w-5 text-[hsl(var(--status-green))] mt-0.5" />
                    <div className="flex-1 text-sm">
                      <div className="font-medium text-foreground">This step is complete.</div>
                      <div className="text-muted-foreground">You can revisit the page anytime to make changes.</div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                    Not yet complete. Use the button below to set this up on the production page — the wizard will detect when you're done and mark this step automatically.
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {step.route && step.cta && (
                    <Button onClick={() => navigate(step.route!)} className="gap-2">
                      {step.cta} <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="outline" onClick={refreshAutoDetect}>
                    Re-check status
                  </Button>
                  {!stepDone[currentStep] && (
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        await progress.markStep(step.progressKey, true);
                        toast.success("Step marked complete");
                        if (currentStep < 5) setCurrentStep(currentStep + 1);
                      }}
                    >
                      Mark Complete
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Back button */}
            {currentStep > 0 && (
              <div className="flex justify-between mt-6 pt-4 border-t">
                <Button variant="outline" onClick={() => setCurrentStep(s => s - 1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
                {stepDone[currentStep] && currentStep < 5 && (
                  <Button onClick={() => setCurrentStep(s => s + 1)}>
                    Next <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

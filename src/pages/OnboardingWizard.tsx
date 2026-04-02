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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  DollarSign, Truck, Users, Mail, Rocket,
  CheckCircle2, ArrowRight, ArrowLeft, AlertTriangle,
} from "lucide-react";

const STEPS = [
  { icon: DollarSign, title: "Verify Your Rates", description: "Confirm or edit the pre-loaded charge master rates for your service area." },
  { icon: Truck, title: "Add Your Trucks", description: "Set up at least one truck with equipment flags." },
  { icon: Users, title: "Add Your First Patient", description: "Enter at least one patient with required billing fields." },
  { icon: Mail, title: "Invite Your Team", description: "Send invitations to your dispatcher and crew members." },
  { icon: Rocket, title: "Run Your First Trip", description: "Complete the full trip lifecycle from scheduling to billing." },
];

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const { activeCompanyId, user } = useAuth();
  const progress = useOnboardingProgress();
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1: Charge master
  const [rates, setRates] = useState<any[]>([]);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [ratesConfirmed, setRatesConfirmed] = useState(false);

  // Step 2: Trucks
  const [trucks, setTrucks] = useState<any[]>([]);
  const [newTruck, setNewTruck] = useState({ name: "", has_power_stretcher: false, has_stair_chair: false, has_bariatric_kit: false, has_oxygen_mount: false });
  const [addingTruck, setAddingTruck] = useState(false);

  // Step 3: Patients
  const [patients, setPatients] = useState<any[]>([]);
  const [newPatient, setNewPatient] = useState({ first_name: "", last_name: "", pickup_address: "", primary_payer: "", member_id: "", mobility: "ambulatory" });
  const [addingPatient, setAddingPatient] = useState(false);

  // Step 4: Invites
  const [invites, setInvites] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("dispatcher");
  const [inviting, setInviting] = useState(false);

  // Load data
  useEffect(() => {
    if (!activeCompanyId) return;
    loadAllData();
  }, [activeCompanyId]);

  const loadAllData = async () => {
    if (!activeCompanyId) return;
    const [ratesRes, trucksRes, patientsRes, invitesRes] = await Promise.all([
      supabase.from("charge_master").select("*").eq("company_id", activeCompanyId),
      supabase.from("trucks").select("*").eq("company_id", activeCompanyId).eq("is_simulated", false),
      supabase.from("patients").select("id, first_name, last_name").eq("company_id", activeCompanyId).eq("is_simulated", false).limit(10),
      supabase.from("company_invites").select("*").eq("company_id", activeCompanyId).order("created_at", { ascending: false }),
    ]);
    setRates(ratesRes.data || []);
    setTrucks(trucksRes.data || []);
    setPatients(patientsRes.data || []);
    setInvites(invitesRes.data || []);
    setRatesLoading(false);
  };

  // Determine which steps are actually done
  const stepDone = [
    progress.step_rates_verified,
    trucks.length > 0 || progress.step_trucks_added,
    patients.length > 0 || progress.step_patients_added,
    progress.step_team_invited,
    progress.step_first_trip,
  ];

  // Auto-advance to first incomplete step
  useEffect(() => {
    if (!progress.loading) {
      const firstIncomplete = stepDone.findIndex(d => !d);
      if (firstIncomplete >= 0) setCurrentStep(firstIncomplete);
    }
  }, [progress.loading]);

  const progressPct = ((stepDone.filter(Boolean).length) / 5) * 100;
  const StepIcon = STEPS[currentStep].icon;

  // Step 1: Confirm rates
  const handleConfirmRates = async () => {
    await progress.markStep("step_rates_verified", true);
    setRatesConfirmed(true);
    toast.success("Rates confirmed!");
    setCurrentStep(1);
  };

  // Step 2: Add truck
  const handleAddTruck = async () => {
    if (!newTruck.name.trim()) { toast.error("Truck name is required"); return; }
    setAddingTruck(true);
    const { error } = await supabase.from("trucks").insert({
      name: newTruck.name.trim(),
      company_id: activeCompanyId,
      has_power_stretcher: newTruck.has_power_stretcher,
      has_stair_chair: newTruck.has_stair_chair,
      has_bariatric_kit: newTruck.has_bariatric_kit,
      has_oxygen_mount: newTruck.has_oxygen_mount,
    });
    if (error) { toast.error("Failed to add truck"); }
    else {
      toast.success("Truck added!");
      setNewTruck({ name: "", has_power_stretcher: false, has_stair_chair: false, has_bariatric_kit: false, has_oxygen_mount: false });
      await loadAllData();
      await progress.markStep("step_trucks_added", true);
    }
    setAddingTruck(false);
  };

  // Step 3: Add patient
  const handleAddPatient = async () => {
    if (!newPatient.first_name.trim() || !newPatient.last_name.trim()) { toast.error("First and last name required"); return; }
    setAddingPatient(true);
    const { error } = await supabase.from("patients").insert({
      first_name: newPatient.first_name.trim(),
      last_name: newPatient.last_name.trim(),
      pickup_address: newPatient.pickup_address || null,
      primary_payer: newPatient.primary_payer || null,
      member_id: newPatient.member_id || null,
      mobility: newPatient.mobility,
      company_id: activeCompanyId,
    });
    if (error) { toast.error("Failed to add patient"); }
    else {
      toast.success("Patient added!");
      setNewPatient({ first_name: "", last_name: "", pickup_address: "", primary_payer: "", member_id: "", mobility: "ambulatory" });
      await loadAllData();
      await progress.markStep("step_patients_added", true);
    }
    setAddingPatient(false);
  };

  // Step 4: Send invite
  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) { toast.error("Email required"); return; }
    setInviting(true);
    const { error } = await supabase.from("company_invites").insert({
      company_id: activeCompanyId!,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
      invited_by: user!.id,
    });
    if (error) { toast.error("Failed to send invite"); }
    else {
      toast.success("Invite sent!");
      setInviteEmail("");
      await loadAllData();
      await progress.markStep("step_team_invited", true);
    }
    setInviting(false);
  };

  // Finish wizard
  const handleFinish = async () => {
    await progress.markStep("wizard_completed", true);
    navigate("/");
  };

  if (progress.loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Getting Started</h1>
          <p className="text-sm text-muted-foreground">Complete these steps to get your company fully operational.</p>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{stepDone.filter(Boolean).length} of 5 steps complete</span>
            <span className="font-medium">{Math.round(progressPct)}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>

        {/* Step selector */}
        <div className="flex gap-2">
          {STEPS.map((s, i) => (
            <button
              key={i}
              onClick={() => setCurrentStep(i)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                currentStep === i
                  ? "border-primary bg-primary/5 text-primary"
                  : stepDone[i]
                  ? "border-[hsl(var(--status-green))]/30 bg-[hsl(var(--status-green))]/5 text-[hsl(var(--status-green))]"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {stepDone[i] ? <CheckCircle2 className="h-3.5 w-3.5" /> : <s.icon className="h-3.5 w-3.5" />}
              <span className="hidden md:inline">{s.title}</span>
              <span className="md:hidden">{i + 1}</span>
            </button>
          ))}
        </div>

        {/* Step content */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <StepIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{STEPS[currentStep].title}</CardTitle>
                <CardDescription>{STEPS[currentStep].description}</CardDescription>
              </div>
              {stepDone[currentStep] && (
                <Badge variant="outline" className="ml-auto text-[hsl(var(--status-green))] border-[hsl(var(--status-green))]/30">Complete</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Step 1: Rates */}
            {currentStep === 0 && (
              <div className="space-y-4">
                {ratesLoading ? (
                  <p className="text-sm text-muted-foreground">Loading rates...</p>
                ) : rates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No rates found. Visit Billing → Charge Master to set up rates.</p>
                ) : (
                  <>
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Payer Type</th>
                            <th className="px-3 py-2 text-right font-medium">Base Rate</th>
                            <th className="px-3 py-2 text-right font-medium">Mileage Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rates.map(r => (
                            <tr key={r.id} className="border-t">
                              <td className="px-3 py-2 capitalize">{r.payer_type}</td>
                              <td className="px-3 py-2 text-right">${Number(r.base_rate).toFixed(2)}</td>
                              <td className="px-3 py-2 text-right">${Number(r.mileage_rate).toFixed(2)}/mi</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                      <p className="text-xs text-amber-800">
                        <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                        These rates are pre-loaded from the 2025 CMS Ambulance Fee Schedule. If they don't match your area, edit them in Billing → Charge Master before confirming.
                      </p>
                    </div>
                    <Button onClick={handleConfirmRates} disabled={progress.step_rates_verified}>
                      {progress.step_rates_verified ? "Rates Confirmed ✓" : "Confirm Rates"}
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Step 2: Trucks */}
            {currentStep === 1 && (
              <div className="space-y-4">
                {trucks.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Your trucks ({trucks.length})</p>
                    {trucks.map(t => (
                      <div key={t.id} className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2 text-sm">
                        <Truck className="h-4 w-4 text-primary" />
                        <span>{t.name}</span>
                        <div className="ml-auto flex gap-1">
                          {t.has_power_stretcher && <Badge variant="outline" className="text-[10px]">Stretcher</Badge>}
                          {t.has_stair_chair && <Badge variant="outline" className="text-[10px]">Stair Chair</Badge>}
                          {t.has_oxygen_mount && <Badge variant="outline" className="text-[10px]">O₂</Badge>}
                          {t.has_bariatric_kit && <Badge variant="outline" className="text-[10px]">Bariatric</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="rounded-lg border p-4 space-y-3">
                  <p className="text-sm font-medium">Add a truck</p>
                  <div className="space-y-2">
                    <Label>Truck Name / Unit Number</Label>
                    <Input value={newTruck.name} onChange={e => setNewTruck(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Unit 101" />
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {[
                      { key: "has_power_stretcher", label: "Power Stretcher" },
                      { key: "has_stair_chair", label: "Stair Chair" },
                      { key: "has_oxygen_mount", label: "Oxygen Mount" },
                      { key: "has_bariatric_kit", label: "Bariatric Kit" },
                    ].map(eq => (
                      <label key={eq.key} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={(newTruck as any)[eq.key]}
                          onCheckedChange={v => setNewTruck(p => ({ ...p, [eq.key]: v === true }))}
                        />
                        {eq.label}
                      </label>
                    ))}
                  </div>
                  <Button onClick={handleAddTruck} disabled={addingTruck} size="sm">
                    {addingTruck ? "Adding..." : "Add Truck"}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Patients */}
            {currentStep === 2 && (
              <div className="space-y-4">
                {patients.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Your patients ({patients.length})</p>
                    {patients.map(p => (
                      <div key={p.id} className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2 text-sm">
                        <Users className="h-4 w-4 text-primary" />
                        <span>{p.first_name} {p.last_name}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="rounded-lg border p-4 space-y-3">
                  <p className="text-sm font-medium">Add a patient</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>First Name *</Label>
                      <Input value={newPatient.first_name} onChange={e => setNewPatient(p => ({ ...p, first_name: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Last Name *</Label>
                      <Input value={newPatient.last_name} onChange={e => setNewPatient(p => ({ ...p, last_name: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Pickup Address</Label>
                    <Input value={newPatient.pickup_address} onChange={e => setNewPatient(p => ({ ...p, pickup_address: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Primary Payer</Label>
                      <Select value={newPatient.primary_payer} onValueChange={v => setNewPatient(p => ({ ...p, primary_payer: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="medicare">Medicare</SelectItem>
                          <SelectItem value="medicaid">Medicaid</SelectItem>
                          <SelectItem value="facility">Facility Contract</SelectItem>
                          <SelectItem value="cash">Private Pay</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Member ID</Label>
                      <Input value={newPatient.member_id} onChange={e => setNewPatient(p => ({ ...p, member_id: e.target.value }))} />
                    </div>
                  </div>
                  <Button onClick={handleAddPatient} disabled={addingPatient} size="sm">
                    {addingPatient ? "Adding..." : "Add Patient"}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Invites */}
            {currentStep === 3 && (
              <div className="space-y-4">
                {invites.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Sent invitations ({invites.length})</p>
                    {invites.map(inv => (
                      <div key={inv.id} className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2 text-sm">
                        <Mail className="h-4 w-4 text-primary" />
                        <span>{inv.email}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">{inv.role}</Badge>
                        <Badge variant={inv.status === "pending" ? "secondary" : "default"} className="text-[10px] ml-auto">{inv.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
                <div className="rounded-lg border p-4 space-y-3">
                  <p className="text-sm font-medium">Invite a team member</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Email</Label>
                      <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="team@company.com" />
                    </div>
                    <div className="space-y-1">
                      <Label>Role</Label>
                      <Select value={inviteRole} onValueChange={setInviteRole}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dispatcher">Dispatcher</SelectItem>
                          <SelectItem value="biller">Biller</SelectItem>
                          <SelectItem value="crew">Crew</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={handleSendInvite} disabled={inviting} size="sm">
                    {inviting ? "Sending..." : "Send Invite"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">You can skip this step and invite team members later from the Employees page.</p>
              </div>
            )}

            {/* Step 5: First Trip Guide */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Complete these actions to run your first trip through the full lifecycle:</p>
                <div className="space-y-2">
                  {[
                    "Schedule a patient run on the Scheduling page",
                    "Assign the run to a truck with crew assigned",
                    "Dispatch the trip from the Dispatch Board",
                    "Complete the Patient Care Report (PCR)",
                    "Move the trip to Ready for Billing",
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-md bg-muted/30 px-3 py-2">
                      <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        progress.step_first_trip
                          ? "bg-[hsl(var(--status-green))]/10 text-[hsl(var(--status-green))]"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {progress.step_first_trip ? "✓" : i + 1}
                      </div>
                      <span className="text-sm">{item}</span>
                    </div>
                  ))}
                </div>
                {progress.step_first_trip ? (
                  <div className="rounded-lg border border-[hsl(var(--status-green))]/30 bg-[hsl(var(--status-green))]/5 p-3">
                    <p className="text-sm text-[hsl(var(--status-green))] font-medium">
                      <CheckCircle2 className="h-4 w-4 inline mr-1" />
                      Your first trip has reached billing! You're fully operational.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">This step completes automatically when your first trip reaches "Ready for Billing" status.</p>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 justify-between mt-6 pt-4 border-t">
              <div>
                {currentStep > 0 && (
                  <Button variant="outline" onClick={() => setCurrentStep(s => s - 1)}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {currentStep === 3 && !stepDone[3] && (
                  <Button variant="ghost" onClick={() => setCurrentStep(4)}>Skip for now</Button>
                )}
                {currentStep < 4 && stepDone[currentStep] && (
                  <Button onClick={() => setCurrentStep(s => s + 1)}>
                    Next <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
                {currentStep === 4 && (
                  <Button onClick={handleFinish}>
                    Go to Dispatch <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

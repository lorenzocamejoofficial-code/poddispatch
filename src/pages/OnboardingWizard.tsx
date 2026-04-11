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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  DollarSign, Truck, Users, Mail, Rocket, Network,
  CheckCircle2, ArrowRight, ArrowLeft, AlertTriangle, Pencil, Trash2, SkipForward,
} from "lucide-react";

const STEPS = [
  { icon: DollarSign, title: "Verify Your Rates", description: "Confirm or edit the pre-loaded charge master rates for your service area." },
  { icon: Truck, title: "Add Your Trucks", description: "Set up at least one truck with equipment flags." },
  { icon: Users, title: "Add Your First Patient", description: "Enter at least one patient with required billing fields." },
  { icon: Mail, title: "Invite Your Team", description: "Send invitations to your dispatcher and crew members." },
  { icon: Rocket, title: "Run Your First Trip", description: "Complete the full trip lifecycle from scheduling to billing." },
  { icon: Network, title: "Connect Your Clearinghouse", description: "Link PodDispatch to Office Ally for electronic claims." },
];

const MOBILITY_OPTIONS = [
  { value: "ambulatory", label: "Ambulatory" },
  { value: "wheelchair", label: "Wheelchair" },
  { value: "stretcher", label: "Stretcher" },
  { value: "bedbound", label: "Bedbound" },
];

const PAYER_OPTIONS = [
  { value: "medicare", label: "Medicare" },
  { value: "medicaid", label: "Medicaid" },
  { value: "facility", label: "Facility Contract" },
  { value: "cash", label: "Private Pay" },
];

const SEX_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

const SPECIAL_EQUIPMENT_OPTIONS = [
  { value: "none", label: "None" },
  { value: "bariatric_stretcher", label: "Bariatric Stretcher" },
  { value: "extra_crew", label: "Extra Crew" },
  { value: "lift_assist", label: "Lift Assist" },
  { value: "other", label: "Other" },
];

// Track which steps have been "seen" (completed or skipped)
interface StepAcknowledged {
  [stepIndex: number]: boolean;
}

const emptyPatientForm = () => ({
  first_name: "", last_name: "", dob: "", sex: "",
  pickup_address: "", primary_payer: "", member_id: "",
  secondary_payer: "", secondary_member_id: "",
  mobility: "ambulatory", special_equipment_required: "none",
  oxygen_required: false, pcs_on_file: false, pcs_expiration_date: "",
  standing_order: false, prior_auth_number: "", auth_expiration: "", notes: "",
});

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const { activeCompanyId, user } = useAuth();
  const progress = useOnboardingProgress();
  const [currentStep, setCurrentStep] = useState(0);
  const [stepAcknowledged, setStepAcknowledged] = useState<StepAcknowledged>({});
  const [skipsLoaded, setSkipsLoaded] = useState(false);
  const [initialStepLoaded, setInitialStepLoaded] = useState(false);

  // Step 1: Charge master
  const [rates, setRates] = useState<any[]>([]);
  const [ratesLoading, setRatesLoading] = useState(true);

  // Step 2: Trucks
  const [trucks, setTrucks] = useState<any[]>([]);
  const [newTruck, setNewTruck] = useState({ name: "", vehicle_id: "", has_power_stretcher: false, has_stair_chair: false, has_bariatric_kit: false, has_oxygen_mount: false });
  const [addingTruck, setAddingTruck] = useState(false);
  const [editingTruckId, setEditingTruckId] = useState<string | null>(null);
  const [editingTruck, setEditingTruck] = useState({ name: "", vehicle_id: "", has_power_stretcher: false, has_stair_chair: false, has_bariatric_kit: false, has_oxygen_mount: false });

  // Step 3: Patients
  const [patients, setPatients] = useState<any[]>([]);
  const [newPatient, setNewPatient] = useState(emptyPatientForm());
  const [addingPatient, setAddingPatient] = useState(false);
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);

  // Step 4: Invites
  const [invites, setInvites] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("dispatcher");
  const [inviting, setInviting] = useState(false);

  // Load data
  // Load persisted skip state from migration_settings
  useEffect(() => {
    if (!activeCompanyId || skipsLoaded) return;
    (async () => {
      const { data } = await supabase
        .from("migration_settings")
        .select("*")
        .eq("company_id", activeCompanyId)
        .maybeSingle();
      if (data) {
        const skips: StepAcknowledged = {};
        if ((data as any).step_0_skipped) skips[0] = true;
        if ((data as any).step_1_skipped) skips[1] = true;
        if ((data as any).step_2_skipped) skips[2] = true;
        if ((data as any).step_3_skipped) skips[3] = true;
        if ((data as any).step_4_skipped) skips[4] = true;
        if ((data as any).step_5_skipped) skips[5] = true;
        setStepAcknowledged(skips);
      }
      setSkipsLoaded(true);
    })();
  }, [activeCompanyId, skipsLoaded]);

  useEffect(() => {
    if (!activeCompanyId) return;
    loadAllData();
  }, [activeCompanyId]);

  const loadAllData = async () => {
    if (!activeCompanyId) return;
    const [ratesRes, trucksRes, patientsRes, invitesRes] = await Promise.all([
      supabase.from("charge_master").select("*").eq("company_id", activeCompanyId),
      supabase.from("trucks").select("*").eq("company_id", activeCompanyId).eq("is_simulated", false),
      supabase.from("patients").select("*").eq("company_id", activeCompanyId).eq("is_simulated", false).limit(20),
      supabase.from("company_invites").select("*").eq("company_id", activeCompanyId).order("created_at", { ascending: false }),
    ]);
    setRates(ratesRes.data || []);
    setTrucks(trucksRes.data || []);
    setPatients(patientsRes.data || []);
    setInvites(invitesRes.data || []);
    setRatesLoading(false);
  };

  // Clearinghouse step state
  const [clearinghouseConfigured, setClearinghouseConfigured] = useState(false);
  useEffect(() => {
    if (!activeCompanyId) return;
    supabase.from("clearinghouse_settings" as any)
      .select("is_configured")
      .eq("company_id", activeCompanyId)
      .maybeSingle()
      .then(({ data }) => setClearinghouseConfigured(!!(data as any)?.is_configured));
  }, [activeCompanyId]);

  // Determine which steps are actually done
  const stepDone = [
    progress.step_rates_verified,
    trucks.length > 0 || progress.step_trucks_added,
    patients.length > 0 || progress.step_patients_added,
    progress.step_team_invited,
    progress.step_first_trip,
    clearinghouseConfigured || (progress as any).step_clearinghouse_connected,
  ];

  // A step is "handled" if done OR skipped
  const stepHandled = (i: number) => stepDone[i] || stepAcknowledged[i];
  const allStepsHandled = STEPS.every((_, i) => stepHandled(i));

  // Load persisted wizard_step on first load — only once
  useEffect(() => {
    if (!progress.loading && !initialStepLoaded) {
      setInitialStepLoaded(true);
      // Use wizard_step from DB if available
      const savedStep = (progress as any).wizard_step;
      if (typeof savedStep === "number" && savedStep >= 0 && savedStep < 6) {
        setCurrentStep(savedStep);
      } else {
        const firstIncomplete = stepDone.findIndex(d => !d);
        if (firstIncomplete >= 0) setCurrentStep(firstIncomplete);
      }
    }
  }, [progress.loading, initialStepLoaded]);

  // Persist current step to DB
  useEffect(() => {
    if (activeCompanyId && initialStepLoaded) {
      supabase.from("migration_settings").update({ wizard_step: currentStep } as any).eq("company_id", activeCompanyId);
    }
  }, [currentStep, activeCompanyId, initialStepLoaded]);

  const progressPct = ((stepDone.filter(Boolean).length) / 6) * 100;
  const StepIcon = STEPS[currentStep].icon;

  // Step 1: Confirm rates
  const handleConfirmRates = async () => {
    await progress.markStep("step_rates_verified", true);
    toast.success("Rates confirmed!");
    goNext();
  };

  // Skip a step
  const handleSkip = async (stepIndex: number) => {
    setStepAcknowledged(prev => ({ ...prev, [stepIndex]: true }));
    // Persist skip state to DB so it survives refresh/logout
    if (activeCompanyId) {
      await supabase.from("migration_settings").update({
        [`step_${stepIndex}_skipped`]: true,
      } as any).eq("company_id", activeCompanyId);
    }
    toast("Step skipped — you can come back to this later.");
    goNext();
  };

  const goNext = () => {
    if (currentStep < 5) setCurrentStep(s => s + 1);
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
    } as any);
    if (error) { toast.error("Failed to add truck"); }
    else {
      toast.success("Truck added!");
      setNewTruck({ name: "", vehicle_id: "", has_power_stretcher: false, has_stair_chair: false, has_bariatric_kit: false, has_oxygen_mount: false });
      await loadAllData();
      await progress.markStep("step_trucks_added", true);
    }
    setAddingTruck(false);
  };

  const handleDeleteTruck = async (id: string) => {
    await supabase.from("trucks").delete().eq("id", id);
    await loadAllData();
    toast.success("Truck deleted");
  };

  const handleEditTruck = (t: any) => {
    setEditingTruckId(t.id);
    setEditingTruck({
      name: t.name, vehicle_id: (t as any).vehicle_id ?? "",
      has_power_stretcher: t.has_power_stretcher ?? false,
      has_stair_chair: t.has_stair_chair ?? false,
      has_bariatric_kit: t.has_bariatric_kit ?? false,
      has_oxygen_mount: t.has_oxygen_mount ?? false,
    });
  };

  const handleSaveTruckEdit = async () => {
    if (!editingTruckId) return;
    await supabase.from("trucks").update({
      name: editingTruck.name,
      has_power_stretcher: editingTruck.has_power_stretcher,
      has_stair_chair: editingTruck.has_stair_chair,
      has_bariatric_kit: editingTruck.has_bariatric_kit,
      has_oxygen_mount: editingTruck.has_oxygen_mount,
    } as any).eq("id", editingTruckId);
    setEditingTruckId(null);
    await loadAllData();
    toast.success("Truck updated");
  };

  // Step 3: Add patient
  const handleAddPatient = async () => {
    if (!newPatient.first_name.trim() || !newPatient.last_name.trim()) { toast.error("First and last name required"); return; }
    setAddingPatient(true);
    const { error } = await supabase.from("patients").insert({
      first_name: newPatient.first_name.trim(),
      last_name: newPatient.last_name.trim(),
      dob: newPatient.dob || null,
      sex: newPatient.sex || null,
      pickup_address: newPatient.pickup_address || null,
      primary_payer: newPatient.primary_payer || null,
      member_id: newPatient.member_id || null,
      secondary_payer: newPatient.secondary_payer || null,
      secondary_member_id: newPatient.secondary_member_id || null,
      mobility: newPatient.mobility,
      special_equipment_required: newPatient.special_equipment_required,
      oxygen_required: newPatient.oxygen_required,
      pcs_on_file: newPatient.pcs_on_file,
      pcs_expiration_date: newPatient.pcs_expiration_date || null,
      standing_order: newPatient.standing_order,
      prior_auth_number: newPatient.prior_auth_number || null,
      prior_auth_expiration: newPatient.auth_expiration || null,
      notes: newPatient.notes || null,
      company_id: activeCompanyId,
    } as any);
    if (error) { toast.error("Failed to add patient"); }
    else {
      toast.success("Patient added!");
      setNewPatient(emptyPatientForm());
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
            <span className="text-muted-foreground">{stepDone.filter(Boolean).length} of 6 steps complete</span>
            <span className="font-medium">{Math.round(progressPct)}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>

        {/* Step selector */}
        <div className="flex gap-2 flex-wrap">
          {STEPS.map((s, i) => (
            <button
              key={i}
              onClick={() => setCurrentStep(i)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                currentStep === i
                  ? "border-primary bg-primary/5 text-primary"
                  : stepDone[i]
                  ? "border-[hsl(var(--status-green))]/30 bg-[hsl(var(--status-green))]/5 text-[hsl(var(--status-green))]"
                  : stepAcknowledged[i]
                  ? "border-muted-foreground/30 bg-muted/30 text-muted-foreground"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {stepDone[i] ? <CheckCircle2 className="h-3.5 w-3.5" /> : stepAcknowledged[i] ? <SkipForward className="h-3.5 w-3.5" /> : <s.icon className="h-3.5 w-3.5" />}
              <span className="hidden md:inline">{s.title}</span>
              <span className="md:hidden">{i + 1}</span>
            </button>
          ))}
        </div>

        {/* Go to Dashboard button when all steps handled */}
        {allStepsHandled && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">You've reviewed all setup steps!</p>
              <p className="text-xs text-muted-foreground">You can continue to your dashboard or revisit any step above.</p>
            </div>
            <Button onClick={handleFinish} className="gap-2">
              Go to Dashboard <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

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
              {!stepDone[currentStep] && stepAcknowledged[currentStep] && (
                <Badge variant="outline" className="ml-auto text-muted-foreground border-muted-foreground/30">Skipped</Badge>
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
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">No rates found yet. You can set up your charge master rates in Settings.</p>
                    <div className="flex gap-2">
                      <Button onClick={() => navigate("/settings")} size="sm" className="gap-2">
                        <DollarSign className="h-4 w-4" /> Go to Settings → Charge Master
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleSkip(0)}>
                        <SkipForward className="h-4 w-4 mr-1" /> Skip for now
                      </Button>
                    </div>
                  </div>
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
                        These rates are pre-loaded from the 2025 CMS Ambulance Fee Schedule. If they don't match your area, edit them in Settings → Charge Master before confirming.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleConfirmRates} disabled={progress.step_rates_verified}>
                        {progress.step_rates_verified ? "Rates Confirmed ✓" : "Confirm Rates"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => navigate("/settings")}>
                        Edit in Settings
                      </Button>
                      {!progress.step_rates_verified && (
                        <Button variant="ghost" size="sm" onClick={() => handleSkip(0)}>
                          <SkipForward className="h-4 w-4 mr-1" /> Skip for now
                        </Button>
                      )}
                    </div>
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
                        <Truck className="h-4 w-4 text-primary shrink-0" />
                        {editingTruckId === t.id ? (
                          <div className="flex-1 space-y-2">
                            <Input value={editingTruck.name} onChange={e => setEditingTruck(p => ({ ...p, name: e.target.value }))} placeholder="Truck name" />
                            <div className="flex flex-wrap gap-3">
                              {[
                                { key: "has_power_stretcher", label: "Power Stretcher" },
                                { key: "has_stair_chair", label: "Stair Chair" },
                                { key: "has_oxygen_mount", label: "Oxygen Mount" },
                                { key: "has_bariatric_kit", label: "Bariatric Kit" },
                              ].map(eq => (
                                <label key={eq.key} className="flex items-center gap-1.5 text-xs">
                                  <Checkbox checked={(editingTruck as any)[eq.key]} onCheckedChange={v => setEditingTruck(p => ({ ...p, [eq.key]: v === true }))} />
                                  {eq.label}
                                </label>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleSaveTruckEdit}>Save</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingTruckId(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="flex-1">{t.name}</span>
                            <div className="flex gap-1 flex-wrap">
                              {t.has_power_stretcher && <Badge variant="outline" className="text-[10px]">Stretcher</Badge>}
                              {t.has_stair_chair && <Badge variant="outline" className="text-[10px]">Stair Chair</Badge>}
                              {t.has_oxygen_mount && <Badge variant="outline" className="text-[10px]">O₂</Badge>}
                              {t.has_bariatric_kit && <Badge variant="outline" className="text-[10px]">Bariatric</Badge>}
                            </div>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEditTruck(t)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDeleteTruck(t.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="rounded-lg border p-4 space-y-3">
                  <p className="text-sm font-medium">Add a truck</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Truck Name *</Label>
                      <Input value={newTruck.name} onChange={e => setNewTruck(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Unit 101" />
                    </div>
                    <div className="space-y-1">
                      <Label>Unit Number</Label>
                      <Input value={newTruck.vehicle_id} onChange={e => setNewTruck(p => ({ ...p, vehicle_id: e.target.value }))} placeholder="e.g. 101" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {[
                      { key: "has_power_stretcher", label: "Power Stretcher / Bariatric" },
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

            {/* Step 3: Patients — full form */}
            {currentStep === 2 && (
              <div className="space-y-4">
                {patients.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Your patients ({patients.length})</p>
                    {patients.map(p => (
                      <div key={p.id} className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2 text-sm">
                        <Users className="h-4 w-4 text-primary" />
                        <span className="flex-1">{p.first_name} {p.last_name}</span>
                        {p.primary_payer && <Badge variant="outline" className="text-[10px] capitalize">{p.primary_payer}</Badge>}
                        {p.mobility && <Badge variant="outline" className="text-[10px] capitalize">{p.mobility}</Badge>}
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                          setEditingPatientId(p.id);
                          setNewPatient({
                            first_name: p.first_name, last_name: p.last_name,
                            dob: p.dob || "", sex: p.sex || "",
                            pickup_address: p.pickup_address || "",
                            primary_payer: p.primary_payer || "", member_id: p.member_id || "",
                            secondary_payer: p.secondary_payer || "", secondary_member_id: p.secondary_member_id || "",
                            mobility: p.mobility || "ambulatory",
                            special_equipment_required: p.special_equipment_required || "none",
                            oxygen_required: p.oxygen_required || false,
                            pcs_on_file: p.pcs_on_file || false,
                            pcs_expiration_date: p.pcs_expiration_date || "",
                            standing_order: p.standing_order || false,
                            prior_auth_number: p.prior_auth_number || "",
                            auth_expiration: p.prior_auth_expiration || "",
                            notes: p.notes || "",
                          });
                        }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="rounded-lg border p-4 space-y-3">
                  <p className="text-sm font-medium">{editingPatientId ? "Edit Patient" : "Add a patient"}</p>
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
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Date of Birth</Label>
                      <Input type="date" value={newPatient.dob} onChange={e => setNewPatient(p => ({ ...p, dob: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Sex</Label>
                      <Select value={newPatient.sex} onValueChange={v => setNewPatient(p => ({ ...p, sex: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {SEX_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
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
                          {PAYER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Member ID</Label>
                      <Input value={newPatient.member_id} onChange={e => setNewPatient(p => ({ ...p, member_id: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Secondary Payer</Label>
                      <Select value={newPatient.secondary_payer} onValueChange={v => setNewPatient(p => ({ ...p, secondary_payer: v }))}>
                        <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none_selected">None</SelectItem>
                          {PAYER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Secondary Member ID</Label>
                      <Input value={newPatient.secondary_member_id} onChange={e => setNewPatient(p => ({ ...p, secondary_member_id: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Mobility</Label>
                      <Select value={newPatient.mobility} onValueChange={v => setNewPatient(p => ({ ...p, mobility: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MOBILITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Special Equipment</Label>
                      <Select value={newPatient.special_equipment_required} onValueChange={v => setNewPatient(p => ({ ...p, special_equipment_required: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SPECIAL_EQUIPMENT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={newPatient.oxygen_required} onCheckedChange={v => setNewPatient(p => ({ ...p, oxygen_required: v === true }))} />
                      Oxygen Required
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={newPatient.standing_order} onCheckedChange={v => setNewPatient(p => ({ ...p, standing_order: v === true }))} />
                      Standing Order
                    </label>
                  </div>
                  {/* PCS */}
                  <div className="flex items-center justify-between">
                    <Label>PCS on File</Label>
                    <Switch checked={newPatient.pcs_on_file} onCheckedChange={v => setNewPatient(p => ({ ...p, pcs_on_file: v }))} />
                  </div>
                  {newPatient.pcs_on_file && (
                    <div className="space-y-1">
                      <Label>PCS Expiration Date</Label>
                      <Input type="date" value={newPatient.pcs_expiration_date} onChange={e => setNewPatient(p => ({ ...p, pcs_expiration_date: e.target.value }))} />
                    </div>
                  )}
                  {/* Auth */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Prior Auth Number</Label>
                      <Input value={newPatient.prior_auth_number} onChange={e => setNewPatient(p => ({ ...p, prior_auth_number: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Auth Expiration</Label>
                      <Input type="date" value={newPatient.auth_expiration} onChange={e => setNewPatient(p => ({ ...p, auth_expiration: e.target.value }))} />
                    </div>
                  </div>
                  {/* Notes */}
                  <div className="space-y-1">
                    <Label>Notes</Label>
                    <Textarea value={newPatient.notes} onChange={e => setNewPatient(p => ({ ...p, notes: e.target.value }))} rows={2} />
                  </div>
                  <div className="flex gap-2">
                    {editingPatientId ? (
                      <>
                        <Button size="sm" onClick={async () => {
                          await supabase.from("patients").update({
                            first_name: newPatient.first_name.trim(),
                            last_name: newPatient.last_name.trim(),
                            dob: newPatient.dob || null,
                            sex: newPatient.sex || null,
                            pickup_address: newPatient.pickup_address || null,
                            primary_payer: newPatient.primary_payer || null,
                            member_id: newPatient.member_id || null,
                            secondary_payer: newPatient.secondary_payer === "none_selected" ? null : newPatient.secondary_payer || null,
                            secondary_member_id: newPatient.secondary_member_id || null,
                            mobility: newPatient.mobility,
                            special_equipment_required: newPatient.special_equipment_required,
                            oxygen_required: newPatient.oxygen_required,
                            pcs_on_file: newPatient.pcs_on_file,
                            pcs_expiration_date: newPatient.pcs_expiration_date || null,
                            standing_order: newPatient.standing_order,
                            prior_auth_number: newPatient.prior_auth_number || null,
                            prior_auth_expiration: newPatient.auth_expiration || null,
                            notes: newPatient.notes || null,
                          } as any).eq("id", editingPatientId);
                          setEditingPatientId(null);
                          setNewPatient(emptyPatientForm());
                          await loadAllData();
                          toast.success("Patient updated");
                        }}>Save Changes</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditingPatientId(null); setNewPatient(emptyPatientForm()); }}>Cancel</Button>
                      </>
                    ) : (
                      <Button onClick={handleAddPatient} disabled={addingPatient} size="sm">
                        {addingPatient ? "Adding..." : "Add Patient"}
                      </Button>
                    )}
                  </div>
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

            {/* Step 6: Clearinghouse */}
            {currentStep === 5 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  To submit claims electronically you need to connect PodDispatch to your clearinghouse.
                  We recommend Office Ally which is free for providers. This step takes about 10 minutes.
                </p>
                {clearinghouseConfigured ? (
                  <div className="rounded-lg border border-[hsl(var(--status-green))]/30 bg-[hsl(var(--status-green))]/5 p-3">
                    <p className="text-sm text-[hsl(var(--status-green))] font-medium">
                      <CheckCircle2 className="h-4 w-4 inline mr-1" />
                      Your clearinghouse is connected!
                    </p>
                  </div>
                ) : (
                  <>
                    <Button onClick={() => navigate("/settings")} size="sm" className="gap-2">
                      <Network className="h-4 w-4" />
                      Go to Settings → Clearinghouse
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      This step completes automatically when your clearinghouse connection is configured.
                    </p>
                  </>
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
                {/* Skip buttons for skippable steps */}
                {[0, 1, 2, 3, 4, 5].includes(currentStep) && !stepDone[currentStep] && !stepAcknowledged[currentStep] && (
                  <Button variant="ghost" onClick={() => handleSkip(currentStep)}>
                    <SkipForward className="h-4 w-4 mr-1" /> Skip for now
                  </Button>
                )}
                {currentStep < 5 && (stepDone[currentStep] || stepAcknowledged[currentStep]) && (
                  <Button onClick={() => setCurrentStep(s => s + 1)}>
                    Next <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
                {currentStep === 5 && (stepDone[5] || stepAcknowledged[5]) && (
                  <Button onClick={handleFinish}>
                    Go to Dashboard <ArrowRight className="h-4 w-4 ml-2" />
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

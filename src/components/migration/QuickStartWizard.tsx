import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Truck, Users, Building2, CalendarDays, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const STEPS = [
  { icon: Truck, title: "How many trucks do you operate?", subtitle: "We'll set them up for dispatch." },
  { icon: Users, title: "How many active dialysis patients?", subtitle: "Just a rough number — you'll add details next." },
  { icon: Users, title: "Add your first patients", subtitle: "Start with your top 10. You can add the rest later." },
  { icon: Building2, title: "Add your primary facilities", subtitle: "Where do most patients go?" },
  { icon: CalendarDays, title: "You're ready!", subtitle: "Start building your schedule and dispatching." },
];

interface QuickPatient {
  first_name: string;
  last_name: string;
  pickup_address: string;
  dropoff_facility: string;
}

export function QuickStartWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [stepLoaded, setStepLoaded] = useState(false);
  const [truckCount, setTruckCount] = useState("");
  const [patientCount, setPatientCount] = useState("");
  const [patients, setPatients] = useState<QuickPatient[]>([
    { first_name: "", last_name: "", pickup_address: "", dropoff_facility: "" },
  ]);
  const [facilities, setFacilities] = useState<{ name: string; address: string }[]>([
    { name: "", address: "" },
  ]);
  const [saving, setSaving] = useState(false);

  // Fix 4: Load wizard_step from DB on mount so progress persists across browser closes
  useState(() => {
    (async () => {
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      if (!companyId) { setStepLoaded(true); return; }
      const { data } = await supabase
        .from("migration_settings")
        .select("wizard_step")
        .eq("company_id", companyId)
        .maybeSingle();
      if (data && (data as any).wizard_step > 0) {
        setStep((data as any).wizard_step);
      }
      setStepLoaded(true);
    })();
  });

  const progress = ((step + 1) / STEPS.length) * 100;
  const StepIcon = STEPS[step].icon;

  const addPatientRow = () => {
    if (patients.length < 20) {
      setPatients(prev => [...prev, { first_name: "", last_name: "", pickup_address: "", dropoff_facility: "" }]);
    }
  };

  const addFacilityRow = () => {
    if (facilities.length < 10) {
      setFacilities(prev => [...prev, { name: "", address: "" }]);
    }
  };

  const updatePatient = (i: number, field: keyof QuickPatient, value: string) => {
    setPatients(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  };

  const updateFacility = (i: number, field: "name" | "address", value: string) => {
    setFacilities(prev => prev.map((f, idx) => idx === i ? { ...f, [field]: value } : f));
  };

  const handleSaveAndFinish = async () => {
    setSaving(true);
    try {
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      if (!companyId) throw new Error("No company");

      // Create trucks
      const tc = parseInt(truckCount) || 0;
      if (tc > 0) {
        const truckRows = Array.from({ length: tc }, (_, i) => ({
          name: `Truck ${i + 1}`,
          company_id: companyId,
        }));
        await supabase.from("trucks").insert(truckRows);
      }

      // Create patients
      const validPatients = patients.filter(p => p.first_name && p.last_name);
      if (validPatients.length > 0) {
        const patientRows = validPatients.map(p => ({
          first_name: p.first_name,
          last_name: p.last_name,
          pickup_address: p.pickup_address || null,
          dropoff_facility: p.dropoff_facility || null,
          company_id: companyId,
        }));
        await supabase.from("patients").insert(patientRows);
      }

      // Create facilities
      const validFacilities = facilities.filter(f => f.name);
      if (validFacilities.length > 0) {
        const facilityRows = validFacilities.map(f => ({
          name: f.name,
          address: f.address || null,
          company_id: companyId,
          facility_type: "dialysis",
        }));
        await supabase.from("facilities").insert(facilityRows);
      }

      toast({ title: "Setup complete!", description: "You're ready to start dispatching." });
      onComplete();
    } catch (err) {
      toast({ title: "Error saving", description: "Some data could not be saved. You can add it later.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Progress value={progress} className="h-2" />

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <StepIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{STEPS[step].title}</h3>
              <p className="text-sm text-muted-foreground">{STEPS[step].subtitle}</p>
            </div>
            <Badge variant="outline" className="ml-auto">Step {step + 1} of {STEPS.length}</Badge>
          </div>

          {/* Step 0: Trucks */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <Label>Number of trucks</Label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={truckCount}
                  onChange={e => setTruckCount(e.target.value)}
                  placeholder="e.g. 5"
                  className="max-w-[200px]"
                />
              </div>
            </div>
          )}

          {/* Step 1: Patient count */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label>Approximate number of active patients</Label>
                <Input
                  type="number"
                  min="1"
                  value={patientCount}
                  onChange={e => setPatientCount(e.target.value)}
                  placeholder="e.g. 40"
                  className="max-w-[200px]"
                />
                <p className="text-xs text-muted-foreground mt-1">Just a rough number — helps us guide your setup.</p>
              </div>
            </div>
          )}

          {/* Step 2: Add patients */}
          {step === 2 && (
            <div className="space-y-3">
              {patients.map((p, i) => (
                <div key={i} className="grid grid-cols-4 gap-2">
                  <Input placeholder="First name" value={p.first_name} onChange={e => updatePatient(i, "first_name", e.target.value)} />
                  <Input placeholder="Last name" value={p.last_name} onChange={e => updatePatient(i, "last_name", e.target.value)} />
                  <Input placeholder="Pickup address" value={p.pickup_address} onChange={e => updatePatient(i, "pickup_address", e.target.value)} />
                  <Input placeholder="Facility" value={p.dropoff_facility} onChange={e => updatePatient(i, "dropoff_facility", e.target.value)} />
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addPatientRow}>+ Add another patient</Button>
              <p className="text-xs text-muted-foreground">You can always add more later from the Patients page.</p>
            </div>
          )}

          {/* Step 3: Add facilities */}
          {step === 3 && (
            <div className="space-y-3">
              {facilities.map((f, i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <Input placeholder="Facility name" value={f.name} onChange={e => updateFacility(i, "name", e.target.value)} />
                  <Input placeholder="Address" value={f.address} onChange={e => updateFacility(i, "address", e.target.value)} />
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addFacilityRow}>+ Add another facility</Button>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 4 && (
            <div className="text-center py-6">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h4 className="text-lg font-semibold mb-2">You're all set!</h4>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Your trucks, patients, and facilities are ready. You can start building schedules
                and dispatching right away. Add more data anytime.
              </p>
            </div>
          )}

          <div className="flex gap-3 justify-end mt-6">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(s => s - 1)}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
            )}
            {step < 4 ? (
              <Button onClick={() => setStep(s => s + 1)}>
                Next <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSaveAndFinish} disabled={saving}>
                {saving ? "Saving…" : "Start Dispatching"} <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

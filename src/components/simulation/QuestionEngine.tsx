import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Truck, FileText, DollarSign, TrendingUp, ChevronRight, ChevronLeft } from "lucide-react";
import type { CompanyProfile } from "@/lib/simulation-engine";

interface QuestionEngineProps {
  onComplete: (profile: CompanyProfile) => void;
}

const MISSING_DOC_OPTIONS = [
  "PCS forms",
  "Signatures",
  "Loaded miles",
  "Origin/destination codes",
  "Timestamps",
  "Medical necessity notes",
  "Authorization numbers",
];

const DENIAL_REASON_OPTIONS = [
  "Missing authorization",
  "Incorrect HCPCS codes",
  "Missing medical necessity",
  "Timely filing exceeded",
  "Duplicate claim",
  "Invalid member ID",
  "Missing PCS/signature",
];

export function QuestionEngine({ onComplete }: QuestionEngineProps) {
  const [step, setStep] = useState(0);

  // Dispatch
  const [tripsPerDayPerTruck, setTripsPerDayPerTruck] = useState("6");
  const [truckCount, setTruckCount] = useState("5");
  const [dialysisPercent, setDialysisPercent] = useState("70");
  const [avgLoadedMiles, setAvgLoadedMiles] = useState("12");
  const [crewPerTruck, setCrewPerTruck] = useState("2");
  const [shiftHours, setShiftHours] = useState("10");
  const [latePatientPercent, setLatePatientPercent] = useState("10");
  const [noShowPercent, setNoShowPercent] = useState("5");

  // Documentation
  const [pcsObtainedWhen, setPcsObtainedWhen] = useState("same_day");
  const [whoCollectsSignatures, setWhoCollectsSignatures] = useState("crew_on_scene");
  const [whenTimesEntered, setWhenTimesEntered] = useState("end_of_day");
  const [whoVerifiesCharts, setWhoVerifiesCharts] = useState("dispatcher");
  const [commonMissingDocs, setCommonMissingDocs] = useState<string[]>([]);

  // Billing
  const [whoBuildsClaimsRole, setWhoBuildsClaimsRole] = useState("billing_staff");
  const [claimBuildFrequency, setClaimBuildFrequency] = useState<"daily" | "weekly" | "biweekly">("weekly");
  const [avgPaymentDays, setAvgPaymentDays] = useState("45");
  const [denialPercent, setDenialPercent] = useState("8");
  const [topDenialReasons, setTopDenialReasons] = useState<string[]>([]);

  // Financial
  const [revenuePerTrip, setRevenuePerTrip] = useState("180");
  const [currentBillingDelayDays, setCurrentBillingDelayDays] = useState("5");
  const [currentARDays, setCurrentARDays] = useState("45");

  const steps = [
    { title: "Dispatch Flow", icon: Truck, color: "text-blue-600" },
    { title: "Documentation Flow", icon: FileText, color: "text-amber-600" },
    { title: "Billing Flow", icon: DollarSign, color: "text-green-600" },
    { title: "Financial Flow", icon: TrendingUp, color: "text-purple-600" },
  ];

  const toggleArrayItem = (arr: string[], setArr: (v: string[]) => void, item: string) => {
    setArr(arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item]);
  };

  const handleSubmit = () => {
    onComplete({
      tripsPerDayPerTruck: Number(tripsPerDayPerTruck) || 6,
      truckCount: Number(truckCount) || 5,
      dialysisPercent: Number(dialysisPercent) || 70,
      avgLoadedMiles: Number(avgLoadedMiles) || 12,
      crewPerTruck: Number(crewPerTruck) || 2,
      shiftHours: Number(shiftHours) || 10,
      latePatientPercent: Number(latePatientPercent) || 10,
      noShowPercent: Number(noShowPercent) || 5,
      pcsObtainedWhen,
      whoCollectsSignatures,
      whenTimesEntered,
      whoVerifiesCharts,
      commonMissingDocs,
      whoBuildsClaimsRole,
      claimBuildFrequency,
      avgPaymentDays: Number(avgPaymentDays) || 45,
      denialPercent: Number(denialPercent) || 8,
      topDenialReasons,
      revenuePerTrip: Number(revenuePerTrip) || 180,
      currentBillingDelayDays: Number(currentBillingDelayDays) || 5,
      currentARDays: Number(currentARDays) || 45,
    });
  };

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <button
            key={s.title}
            onClick={() => setStep(i)}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              i === step
                ? "bg-primary/10 text-primary border border-primary/20"
                : i < step
                  ? "bg-muted text-foreground"
                  : "bg-muted/50 text-muted-foreground"
            }`}
          >
            <s.icon className={`h-4 w-4 ${i === step ? s.color : ""}`} />
            <span className="hidden sm:inline">{s.title}</span>
            {i < step && <Badge variant="outline" className="text-[10px] ml-1">✓</Badge>}
          </button>
        ))}
      </div>

      {/* Step 0: Dispatch */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-600" /> Dispatch Flow
            </CardTitle>
            <CardDescription>Tell us how your trucks run daily.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Trips per day per truck</Label>
              <Input type="number" value={tripsPerDayPerTruck} onChange={e => setTripsPerDayPerTruck(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Number of trucks</Label>
              <Input type="number" value={truckCount} onChange={e => setTruckCount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Dialysis % (vs discharge/other)</Label>
              <Input type="number" value={dialysisPercent} onChange={e => setDialysisPercent(e.target.value)} min="0" max="100" />
            </div>
            <div className="space-y-2">
              <Label>Avg loaded miles per trip</Label>
              <Input type="number" value={avgLoadedMiles} onChange={e => setAvgLoadedMiles(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Crew members per truck</Label>
              <Input type="number" value={crewPerTruck} onChange={e => setCrewPerTruck(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Shift length (hours)</Label>
              <Input type="number" value={shiftHours} onChange={e => setShiftHours(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Late patient frequency (%)</Label>
              <Input type="number" value={latePatientPercent} onChange={e => setLatePatientPercent(e.target.value)} min="0" max="100" />
            </div>
            <div className="space-y-2">
              <Label>No-show frequency (%)</Label>
              <Input type="number" value={noShowPercent} onChange={e => setNoShowPercent(e.target.value)} min="0" max="100" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Documentation */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-600" /> Documentation Flow
            </CardTitle>
            <CardDescription>How does your company handle trip documentation?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>When is PCS obtained?</Label>
                <Select value={pcsObtainedWhen} onValueChange={setPcsObtainedWhen}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="before_transport">Before transport</SelectItem>
                    <SelectItem value="same_day">Same day (after transport)</SelectItem>
                    <SelectItem value="days_later">Days later / inconsistent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Who collects signatures?</Label>
                <Select value={whoCollectsSignatures} onValueChange={setWhoCollectsSignatures}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="crew_on_scene">Crew on scene</SelectItem>
                    <SelectItem value="office_follows_up">Office follows up later</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>When are times entered?</Label>
                <Select value={whenTimesEntered} onValueChange={setWhenTimesEntered}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="real_time">Real-time (during transport)</SelectItem>
                    <SelectItem value="end_of_day">End of day</SelectItem>
                    <SelectItem value="next_day">Next day or later</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Who verifies charts?</Label>
                <Select value={whoVerifiesCharts} onValueChange={setWhoVerifiesCharts}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dedicated_qa">Dedicated QA person</SelectItem>
                    <SelectItem value="dispatcher">Dispatcher</SelectItem>
                    <SelectItem value="nobody">Nobody / honor system</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Common missing documents (select all that apply)</Label>
              <div className="grid grid-cols-2 gap-2">
                {MISSING_DOC_OPTIONS.map(doc => (
                  <label key={doc} className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors">
                    <Checkbox
                      checked={commonMissingDocs.includes(doc)}
                      onCheckedChange={() => toggleArrayItem(commonMissingDocs, setCommonMissingDocs, doc)}
                    />
                    <span className="text-sm">{doc}</span>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Billing */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" /> Billing Flow
            </CardTitle>
            <CardDescription>How does your billing currently work?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Who builds claims?</Label>
                <Select value={whoBuildsClaimsRole} onValueChange={setWhoBuildsClaimsRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="billing_staff">Dedicated billing staff</SelectItem>
                    <SelectItem value="dispatcher">Dispatcher</SelectItem>
                    <SelectItem value="owner">Owner / manager</SelectItem>
                    <SelectItem value="outsourced">Outsourced billing company</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>How often are claims built?</Label>
                <Select value={claimBuildFrequency} onValueChange={(v: "daily" | "weekly" | "biweekly") => setClaimBuildFrequency(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly or less</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Average days to payment</Label>
                <Input type="number" value={avgPaymentDays} onChange={e => setAvgPaymentDays(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Denial frequency (%)</Label>
                <Input type="number" value={denialPercent} onChange={e => setDenialPercent(e.target.value)} min="0" max="100" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Top denial reasons (select all that apply)</Label>
              <div className="grid grid-cols-2 gap-2">
                {DENIAL_REASON_OPTIONS.map(reason => (
                  <label key={reason} className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors">
                    <Checkbox
                      checked={topDenialReasons.includes(reason)}
                      onCheckedChange={() => toggleArrayItem(topDenialReasons, setTopDenialReasons, reason)}
                    />
                    <span className="text-sm">{reason}</span>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Financial */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-600" /> Financial Flow
            </CardTitle>
            <CardDescription>Current financial performance metrics.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Revenue per trip ($)</Label>
              <Input type="number" value={revenuePerTrip} onChange={e => setRevenuePerTrip(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Current billing delay (days from trip to claim)</Label>
              <Input type="number" value={currentBillingDelayDays} onChange={e => setCurrentBillingDelayDays(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Current AR days (avg)</Label>
              <Input type="number" value={currentARDays} onChange={e => setCurrentARDays(e.target.value)} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        {step < 3 ? (
          <Button onClick={() => setStep(s => s + 1)}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} className="bg-green-600 hover:bg-green-700">
            Run 30-Day Simulation
          </Button>
        )}
      </div>
    </div>
  );
}

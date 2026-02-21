import { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { QuestionEngine } from "@/components/simulation/QuestionEngine";
import { SimulationResults } from "@/components/simulation/SimulationResults";
import { Badge } from "@/components/ui/badge";
import { FlaskConical } from "lucide-react";
import { runSimulation, type CompanyProfile, type SimulationResult } from "@/lib/simulation-engine";

export default function CompanySimulation() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const handleComplete = (p: CompanyProfile) => {
    setProfile(p);
    setResult(runSimulation(p));
  };

  const handleReset = () => {
    setProfile(null);
    setResult(null);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FlaskConical className="h-6 w-6 text-primary" />
              Company Simulation Mode
            </h1>
            <p className="text-sm text-muted-foreground">
              Stress-test PodDispatch against your real company operations before going live.
            </p>
          </div>
          <Badge variant="outline" className="ml-auto text-xs">Internal Testing</Badge>
        </div>

        {!result ? (
          <QuestionEngine onComplete={handleComplete} />
        ) : (
          <SimulationResults result={result} profile={profile!} onReset={handleReset} />
        )}
      </div>
    </AdminLayout>
  );
}

import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, X, DollarSign, Truck, Users, Mail, Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";

const STEPS = [
  { key: "step_rates_verified", label: "Verify rates", icon: DollarSign },
  { key: "step_trucks_added", label: "Add trucks", icon: Truck },
  { key: "step_patients_added", label: "Add patients", icon: Users },
  { key: "step_team_invited", label: "Invite team", icon: Mail },
  { key: "step_first_trip", label: "First trip", icon: Rocket },
] as const;

export function OnboardingChecklist() {
  const { isAdmin } = useAuth();
  const progress = useOnboardingProgress();
  const navigate = useNavigate();

  if (!isAdmin || progress.loading || progress.wizard_completed || progress.onboarding_dismissed) return null;
  if (progress.completedCount === 5) return null;

  return (
    <div className="rounded-lg border bg-card p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Getting Started — {progress.completedCount}/5 complete</p>
          <Progress value={(progress.completedCount / 5) * 100} className="h-1.5 mt-1.5 w-48" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/onboarding")}>Continue Setup</Button>
          <button onClick={progress.dismiss} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        {STEPS.map(s => {
          const done = progress[s.key];
          return (
            <div key={s.key} className={`flex items-center gap-1.5 text-xs rounded-full px-3 py-1 border ${
              done ? "border-[hsl(var(--status-green))]/30 text-[hsl(var(--status-green))] bg-[hsl(var(--status-green))]/5" : "border-border text-muted-foreground"
            }`}>
              {done ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
              {s.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

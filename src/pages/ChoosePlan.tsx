import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Loader2, LogOut, Truck } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Plan = "starter" | "pro";
type Cycle = "monthly" | "yearly";

type PlanCard = {
  id: Plan;
  name: string;
  monthly: number;
  yearly: number;
  caption: string;
  features: string[];
  highlighted?: boolean;
};

const PLANS: PlanCard[] = [
  {
    id: "starter",
    name: "Starter",
    monthly: 799,
    yearly: 7990,
    caption: "1–5 trucks",
    features: [
      "Up to 5 active trucks",
      "Full dispatch, scheduling, ePCR & billing",
      "Unlimited patients, employees & runs",
      "All compliance & QA tools included",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 1499,
    yearly: 14990,
    caption: "6+ trucks",
    features: [
      "Unlimited trucks (up to system cap)",
      "Everything in Starter",
      "Priority support",
      "Best for growing fleets",
    ],
    highlighted: true,
  },
];

const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;

export default function ChoosePlan() {
  const { user, activeCompanyId, signOut } = useAuth();
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);
  const [cycle, setCycle] = useState<Cycle>("monthly");

  const startCheckout = async (plan: Plan) => {
    if (!user?.id || !activeCompanyId) {
      toast({ title: "Missing account context", description: "Please sign out and back in.", variant: "destructive" });
      return;
    }
    setLoadingPlan(plan);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { company_id: activeCompanyId, user_id: user.id, plan, billing_cycle: cycle },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("No checkout URL returned");
      window.location.href = data.url as string;
    } catch (err) {
      console.error(err);
      toast({ title: "Could not start checkout", description: (err as Error).message ?? "Try again.", variant: "destructive" });
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Truck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Choose your plan</h1>
          <p className="text-sm text-muted-foreground">
            Pick the tier that matches your fleet today — you can upgrade anytime.
          </p>
          <p className="text-xs text-muted-foreground">
            Pick a plan and add a payment method to unlock access. You can cancel anytime.
          </p>
        </div>

        <div className="flex justify-center">
          <div className="inline-flex items-center rounded-full border border-border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setCycle("monthly")}
              className={`px-4 py-1.5 text-sm rounded-full transition ${cycle === "monthly" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setCycle("yearly")}
              className={`px-4 py-1.5 text-sm rounded-full transition flex items-center gap-2 ${cycle === "yearly" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              Yearly
              <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">Save 2 months</span>
            </button>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {PLANS.map((p) => (
            <Card
              key={p.id}
              className={p.highlighted ? "border-primary shadow-md" : ""}
            >
              <CardContent className="pt-6 space-y-5">
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-lg font-semibold text-foreground">{p.name}</h2>
                    <span className="text-xs text-muted-foreground">{p.caption}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">
                      {cycle === "yearly" ? fmt(p.yearly) : fmt(p.monthly)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {cycle === "yearly" ? "/year" : "/month"}
                    </span>
                  </div>
                  {cycle === "yearly" && (
                    <p className="text-xs text-muted-foreground">
                      {fmt(Math.round(p.yearly / 12))}/mo billed annually · 2 months free
                    </p>
                  )}
                </div>
                <ul className="space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => startCheckout(p.id)}
                  disabled={loadingPlan !== null}
                  className="w-full"
                  size="lg"
                  variant={p.highlighted ? "default" : "outline"}
                >
                  {loadingPlan === p.id ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting checkout…</>
                  ) : (
                    `Continue with ${p.name}`
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {cycle === "monthly" && (
          <p className="text-center text-xs text-muted-foreground">
            First 5 paid customers get <span className="font-medium text-foreground">Founding pricing locked for life</span> — applied automatically at checkout.
          </p>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Questions? <span className="font-medium text-foreground">support@thepoddispatch.com</span>
        </p>

        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate("/login"); }} className="gap-2 text-muted-foreground">
            <LogOut className="h-3.5 w-3.5" /> Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
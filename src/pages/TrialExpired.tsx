import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Truck, Mail, Award, Loader2 } from "lucide-react";

export default function TrialExpired() {
  const { signOut, activeCompanyId } = useAuth();
  const navigate = useNavigate();
  const [isFounding, setIsFounding] = useState(false);
  const [checking, setChecking] = useState(true);

  // Founding companies get their own state: their locked rate and a checkout
  // that works, so an expired founding trial is never a dead end.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!activeCompanyId) { setChecking(false); return; }
      const { data } = await supabase
        .from("subscription_records")
        .select("is_founding")
        .eq("company_id", activeCompanyId)
        .maybeSingle();
      if (cancelled) return;
      setIsFounding(data?.is_founding === true);
      setChecking(false);
    })();
    return () => { cancelled = true; };
  }, [activeCompanyId]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${isFounding ? "bg-primary/10" : "bg-destructive/10"}`}>
            {isFounding
              ? <Award className="h-7 w-7 text-primary" />
              : <Truck className="h-7 w-7 text-destructive" />}
          </div>
          <h1 className="text-xl font-bold text-foreground">Trial Period Ended</h1>
          {isFounding ? (
            <p className="text-sm text-muted-foreground">
              Your Founding rate is safe — unlimited trucks at $799/mo, locked for life.
              Add a payment method to restore full access at that rate.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Your 30-day trial has expired. Subscribe to PodDispatch to restore full access immediately.
            </p>
          )}
          <Button onClick={() => navigate("/choose-plan")} className="w-full">
            {isFounding ? "Continue at $799/mo (Founding)" : "Choose a Plan"}
          </Button>
          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            <div className="flex items-center gap-2 justify-center text-muted-foreground">
              <Mail className="h-4 w-4 text-primary" />
              <span>Questions? <span className="font-medium text-foreground">support@thepoddispatch.com</span></span>
            </div>
          </div>
          <Button variant="outline" onClick={async () => { await signOut(); navigate("/login"); }} className="w-full">
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

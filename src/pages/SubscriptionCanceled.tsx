import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Truck, Mail, Download } from "lucide-react";
import { toast } from "sonner";

export default function SubscriptionCanceled() {
  const { signOut, activeCompanyId } = useAuth();
  const navigate = useNavigate();
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [reactivating, setReactivating] = useState(false);

  useEffect(() => {
    if (!activeCompanyId) return;
    supabase.from("subscription_records")
      .select("reactivation_deadline")
      .eq("company_id", activeCompanyId)
      .maybeSingle()
      .then(({ data }) => {
        const d = (data as any)?.reactivation_deadline;
        if (d) setDeadline(new Date(d));
      });
  }, [activeCompanyId]);

  const reactivate = async () => {
    if (!activeCompanyId) return;
    setReactivating(true);
    const { data, error } = await supabase.functions.invoke("reactivate-subscription", {
      body: { company_id: activeCompanyId },
    });
    setReactivating(false);
    if (error || !data?.ok) {
      toast.error("Reactivation failed", { description: error?.message ?? data?.error ?? "Unknown error" });
      return;
    }
    navigate("/choose-plan");
  };

  const expired = deadline && deadline.getTime() < Date.now();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <Truck className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Subscription Cancelled</h1>
          <p className="text-sm text-muted-foreground">
            Your PodDispatch account is in read-only export mode.
            {deadline && !expired && (
              <> You can reactivate with one click through <span className="font-medium text-foreground">{deadline.toLocaleDateString()}</span> with no re-onboarding.</>
            )}
            {expired && <> The 90-day self-serve reactivation window has ended — contact support to restore.</>}
          </p>

          {!expired && (
            <Button onClick={reactivate} disabled={reactivating} className="w-full">
              {reactivating ? "…" : "Reactivate account"}
            </Button>
          )}

          <div className="rounded-lg border bg-muted/30 p-4 text-sm text-left space-y-2">
            <div className="flex items-center gap-2 text-foreground font-medium">
              <Download className="h-4 w-4 text-primary" /> Need your data?
            </div>
            <p className="text-xs text-muted-foreground">
              Email support and we'll deliver a full export (trips, PCRs, claims, 835s, employee/truck/patient lists, audit log) within 30 days under HIPAA Right of Access. PHI is retained for 10 years per our Retention Policy regardless of subscription state.
            </p>
            <div className="flex items-center gap-2 justify-center text-muted-foreground pt-1">
              <Mail className="h-4 w-4 text-primary" />
              <a href="mailto:support@thepoddispatch.com" className="font-medium text-foreground hover:underline">
                support@thepoddispatch.com
              </a>
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
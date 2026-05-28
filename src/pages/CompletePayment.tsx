import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Truck, CheckCircle2, Loader2, LogOut, Mail } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function CompletePayment() {
  const { signOut, user, activeCompanyId } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!user?.id || !activeCompanyId) {
      toast({
        title: "Unable to start checkout",
        description: "Missing account context. Please sign out and back in.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { company_id: activeCompanyId, user_id: user.id },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("No checkout URL returned");
      window.location.href = data.url as string;
    } catch (err) {
      console.error("Checkout error:", err);
      toast({
        title: "Could not start checkout",
        description: (err as Error).message ?? "Please try again or contact support.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-foreground">Account Approved</h1>
            <p className="text-sm text-muted-foreground">
              Your account has been approved. Complete your subscription to access PodDispatch.
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 text-left space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Truck className="h-4 w-4 text-primary" />
              PodDispatch — Standard Plan
            </div>
            <p className="text-xs text-muted-foreground">
              Full access to dispatch, scheduling, billing, compliance, and the entire NEMT operating system.
            </p>
          </div>

          <Button
            onClick={handleSubscribe}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting checkout…
              </>
            ) : (
              "Complete Subscription"
            )}
          </Button>

          <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            <span>
              Questions? <span className="font-medium text-foreground">support@thepoddispatch.com</span>
            </span>
          </div>

          <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2 text-muted-foreground">
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

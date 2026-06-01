import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Truck, Mail, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function TrialExpired() {
  const { signOut, user, activeCompanyId } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!user?.id || !activeCompanyId) {
      toast({ title: "Unable to start checkout", description: "Missing account context. Please sign out and back in.", variant: "destructive" });
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <Truck className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Trial Period Ended</h1>
          <p className="text-sm text-muted-foreground">
            Your 30-day trial has expired. Subscribe to PodDispatch to restore full access immediately.
          </p>
          <Button onClick={handleSubscribe} disabled={loading} className="w-full">
            {loading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting checkout…</>) : "Subscribe Now"}
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

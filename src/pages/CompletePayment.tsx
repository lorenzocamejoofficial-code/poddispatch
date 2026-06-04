import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Truck, CheckCircle2, LogOut, Mail } from "lucide-react";

export default function CompletePayment() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

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
              Pick the tier that matches your fleet
            </div>
            <p className="text-xs text-muted-foreground">
              Starter ($799/mo, 1–5 trucks) or Pro ($1,499/mo, 6+ trucks).
              Founding pricing automatically applies to the first 5 paying customers.
            </p>
          </div>

          <Button onClick={() => navigate("/choose-plan")} className="w-full" size="lg">
            Choose a Plan
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

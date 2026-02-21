import { Truck, Clock, Mail, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

export default function PendingApproval() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Clock className="h-8 w-8 text-primary" />
        </div>

        <h1 className="text-xl font-bold text-foreground mb-2">
          Account Pending Approval
        </h1>

        <p className="text-sm text-muted-foreground mb-6">
          Your company account is being reviewed by the PodDispatch team.
          You'll receive an email notification when your account is activated.
        </p>

        <div className="rounded-lg border bg-card p-4 space-y-3 text-left text-sm mb-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Truck className="h-4 w-4 shrink-0" />
            <span>Company setup complete</span>
            <span className="ml-auto text-xs text-[hsl(var(--status-green))]">✓</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4 shrink-0" />
            <span>Legal agreements accepted</span>
            <span className="ml-auto text-xs text-[hsl(var(--status-green))]">✓</span>
          </div>
          <div className="flex items-center gap-2 text-foreground font-medium">
            <Clock className="h-4 w-4 shrink-0 text-[hsl(var(--status-yellow))]" />
            <span>Awaiting manual approval</span>
            <span className="ml-auto text-xs text-[hsl(var(--status-yellow))]">⏳</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          This usually takes less than 24 hours. If you have questions, contact{" "}
          <span className="font-medium text-foreground">support@poddispatch.com</span>.
        </p>

        <Button variant="outline" size="sm" onClick={handleSignOut} className="gap-2">
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [invite, setInvite] = useState<any>(null);
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Signup form
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // Load invite details
  useEffect(() => {
    if (!token) {
      setError("Invalid invite link — no token provided.");
      setLoading(false);
      return;
    }

    (async () => {
      // Use server-side validation to look up invite (no public RLS needed)
      const { data, error: fetchErr } = await supabase.functions.invoke("validate-invite", {
        body: { token },
      });

      if (fetchErr || !data?.invite) {
        setError("This invite is invalid or has already been used.");
        setLoading(false);
        return;
      }

      setInvite(data.invite);
      setCompanyName(data.invite.company_name ?? "Unknown Company");
      setLoading(false);
    })();
  }, [token]);

  // If user is already logged in and invite loaded, offer accept
  useEffect(() => {
    if (user && invite && !accepted && !submitting) {
      // Auto-accept for logged-in users
    }
  }, [user, invite]);

  const acceptForUser = async (userId: string) => {
    setSubmitting(true);
    const { data, error: acceptErr } = await supabase.functions.invoke("accept-invite", {
      body: { token, userId },
    });

    if (acceptErr || data?.error) {
      toast.error("Failed to accept invite");
      setSubmitting(false);
      return;
    }

    setAccepted(true);
    setSubmitting(false);
    toast.success("Welcome! You've joined the team.");
    // Full reload to pick up new membership
    setTimeout(() => { window.location.href = "/"; }, 1500);
  };

  const handleSignupAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !password.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setSubmitting(true);

    // Sign up the user with auto-confirm
    const { data: signupData, error: signupErr } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });

    if (signupErr) {
      toast.error(signupErr.message);
      setSubmitting(false);
      return;
    }

    if (!signupData.user) {
      toast.error("Failed to create account");
      setSubmitting(false);
      return;
    }

    // Accept the invite via edge function
    const { data, error: acceptErr } = await supabase.functions.invoke("accept-invite", {
      body: { token, userId: signupData.user.id, fullName: fullName.trim() },
    });

    if (acceptErr || data?.error) {
      toast.error("Account created but failed to join company. Contact your admin.");
      setSubmitting(false);
      return;
    }

    setAccepted(true);
    setSubmitting(false);
    toast.success("Account created! You've joined the team.");
    setTimeout(() => { window.location.href = "/"; }, 2000);
  };

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading invite...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <XCircle className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="text-xl font-bold">Invalid Invite</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => navigate("/login")}>Go to Login</Button>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <CheckCircle2 className="mx-auto h-12 w-12 text-[hsl(var(--status-green))]" />
          <h1 className="text-xl font-bold">You're In!</h1>
          <p className="text-sm text-muted-foreground">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  // If user is already logged in, show a simpler accept screen
  if (user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <Truck className="mx-auto h-10 w-10 text-primary" />
          <h1 className="text-xl font-bold">Join {companyName}</h1>
          <p className="text-sm text-muted-foreground">
            You've been invited as <strong className="capitalize">{invite.role === "biller" ? "Billing" : invite.role}</strong>.
          </p>
          <Button onClick={() => acceptForUser(user.id)} disabled={submitting} className="w-full">
            {submitting ? "Joining..." : "Accept Invite"}
          </Button>
        </div>
      </div>
    );
  }

  // Not logged in — show signup form
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Truck className="mx-auto mb-3 h-10 w-10 text-primary" />
          <h1 className="text-xl font-bold">Join {companyName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You've been invited as <strong className="capitalize">{invite.role === "biller" ? "Billing" : invite.role}</strong>. Create your account to get started.
          </p>
        </div>

        <form onSubmit={handleSignupAndAccept} className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={invite.email} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>Full Name *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Smith" />
          </div>
          <div className="space-y-2">
            <Label>Password *</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Creating account..." : "Create Account & Join"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <a href="/login" className="text-primary hover:underline">Sign in first</a>, then revisit this link.
          </p>
        </form>
      </div>
    </div>
  );
}

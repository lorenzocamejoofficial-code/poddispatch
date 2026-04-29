import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Truck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { setPasswordRecoveryMode } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // 1a. App-direct recovery URL: /reset-password?token_hash=...&type=recovery
    //     (Used by our edge functions to bypass Supabase's redirect allow-list.)
    //     We must exchange the token_hash for a session via verifyOtp before
    //     the user can call updateUser({ password }).
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const typeParam = params.get("type");
    setPasswordRecoveryMode(true);
    if (tokenHash && typeParam === "recovery") {
      (async () => {
        const { error } = await supabase.auth.verifyOtp({
          type: "recovery",
          token_hash: tokenHash,
        });
        if (cancelled) return;
        if (error) {
          toast.error("This reset link is invalid or has expired. Please request a new one.");
          setTimeout(() => navigate("/forgot-password"), 1500);
          return;
        }
        // Strip the token from the URL so it isn't reused or leaked
        window.history.replaceState({}, "", "/reset-password");
        setReady(true);
      })();
      return () => {
        cancelled = true;
      };
    }

    // 1b. Recovery markers in URL hash (Supabase implicit flow) → ready immediately
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || params.get("type") === "recovery") {
      setReady(true);
      return;
    }

    // 2. If a session already exists (Supabase consumed the token before we mounted), allow reset
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) setReady(true);
    });

    // 3. Listen for the PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setReady(true);
      }
    });

    // 4. Hard fallback — never spin forever. After 3s, if we have any session, show form.
    const timeout = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelled && data.session) setReady(true);
    }, 3000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [navigate, setPasswordRecoveryMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated! Redirecting to login...");
      setPasswordRecoveryMode(false);
      await supabase.auth.signOut();
      setTimeout(() => navigate("/login"), 1500);
    }
    setLoading(false);
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-3">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Verifying reset link...</p>
          <p className="text-xs text-muted-foreground">If this takes too long, your link may have expired.</p>
          <Button variant="link" size="sm" onClick={() => navigate("/login")}>Back to login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-primary">
            <Truck className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Set New Password</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter your new password below.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm Password</Label>
            <Input id="confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}

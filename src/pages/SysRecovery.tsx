import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hidden System Creator recovery page.
 * Mounted at /sys-r/:slug — the slug acts as the first factor.
 * Visiting without the correct slug just shows the same form (no leak).
 * The passphrase + slug are verified together server-side.
 */
export default function SysRecovery() {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [passphrase, setPassphrase] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase || !newPassword) {
      toast.error("Passphrase and new password are required");
      return;
    }
    if (newPassword.length < 10) {
      toast.error("New password must be at least 10 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/creator-recovery-v2`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            passphrase,
            new_password: newPassword,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Recovery failed");
        setLoading(false);
        return;
      }

      // Auto sign-in with the new password
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: newPassword,
      });

      if (signInErr) {
        toast.success("Password reset. Please sign in manually.");
        setSuccess(true);
        setTimeout(() => navigate("/login"), 2000);
      } else {
        toast.success("Recovered. Redirecting…");
        setSuccess(true);
        setTimeout(() => navigate("/system"), 1000);
      }
    } catch (err: any) {
      toast.error(err?.message || "Network error");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive mb-2">
            <ShieldAlert className="h-5 w-5" />
            <span className="text-xs font-bold tracking-wider uppercase">
              Restricted
            </span>
          </div>
          <CardTitle>System Recovery</CardTitle>
          <CardDescription>
            Enter your recovery passphrase and a new password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Password reset successful. Redirecting…
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="passphrase">Recovery Passphrase</Label>
                <div className="relative">
                  <Input
                    id="passphrase"
                    type={showPass ? "text" : "password"}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    autoComplete="off"
                    autoFocus
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={() => setShowPass(!showPass)}
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={10}
                  required
                />
                <p className="text-xs text-muted-foreground">Min 10 characters.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…
                  </>
                ) : (
                  "Reset Password & Sign In"
                )}
              </Button>

              <p className="text-[10px] text-muted-foreground text-center pt-2">
                Attempts are rate-limited and audited.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
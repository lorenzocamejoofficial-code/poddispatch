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
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase) {
      toast.error("Passphrase is required");
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
          body: JSON.stringify({ slug, passphrase }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Recovery failed");
        setLoading(false);
        return;
      }
      toast.success("Recovery link sent to your registered email.");
      setSuccess(true);
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
            Enter your recovery passphrase. A one-time link to set a new password will be emailed to your registered creator address.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Passphrase verified. Check your registered email for a link to set a new password.
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

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…
                  </>
                ) : (
                  "Send Recovery Link"
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
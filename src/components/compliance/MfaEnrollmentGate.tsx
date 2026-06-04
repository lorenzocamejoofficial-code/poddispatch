import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Blocks admin-role users (owner / manager / dispatcher / biller) from
 * accessing the app until they enroll a TOTP authenticator. Crew, system
 * creators, and unauthenticated users pass through untouched.
 *
 * Mirrors the HipaaAcknowledgmentGate pattern.
 */
const REQUIRED_ROLES = new Set(["owner", "manager", "dispatcher", "biller"]);

export function MfaEnrollmentGate({ children }: { children: React.ReactNode }) {
  const { user, role, isSystemCreator } = useAuth();
  const [enrolled, setEnrolled] = useState<boolean | null>(null); // null = loading

  const [enrollData, setEnrollData] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [starting, setStarting] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const skipGate = !user || isSystemCreator || !role || !REQUIRED_ROLES.has(role);

  const refresh = useCallback(async () => {
    if (skipGate) { setEnrolled(true); return; }
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      // Fail-open on transient errors so we don't lock users out of their own app.
      console.warn("MFA listFactors failed", error);
      setEnrolled(true);
      return;
    }
    const verified = (data?.totp ?? []).some((f) => f.status === "verified");
    setEnrolled(verified);
  }, [skipGate]);

  useEffect(() => { refresh(); }, [refresh]);

  const startEnroll = async () => {
    setStarting(true);
    // Clear any half-finished unverified factors from a prior attempt so enroll
    // doesn't fail with "factor already exists".
    try {
      const { data: existing } = await supabase.auth.mfa.listFactors();
      const stale = (existing?.totp ?? []).filter((f) => f.status !== "verified");
      for (const f of stale) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
    } catch { /* ignore */ }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Authenticator ${new Date().toLocaleDateString()}`,
    });
    setStarting(false);
    if (error) { toast.error(error.message); return; }
    setEnrollData({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };

  const verifyEnroll = async () => {
    if (!enrollData) return;
    if (code.trim().length < 6) { toast.error("Enter the 6-digit code from your authenticator app"); return; }
    setVerifying(true);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: enrollData.factorId });
    if (chErr || !ch) { setVerifying(false); toast.error(chErr?.message ?? "Challenge failed"); return; }
    const { error: vErr } = await supabase.auth.mfa.verify({ factorId: enrollData.factorId, challengeId: ch.id, code: code.trim() });
    setVerifying(false);
    if (vErr) { toast.error(vErr.message); return; }
    toast.success("Two-factor authentication enabled");
    setEnrollData(null);
    setCode("");
    refresh();
  };

  // Loading
  if (enrolled === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (enrolled) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center pb-2">
          <ShieldCheck className="mx-auto mb-2 h-10 w-10 text-primary" />
          <CardTitle className="text-lg">Two-Factor Authentication Required</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Administrative accounts must protect access with an authenticator app before continuing.
            This is required for HIPAA safeguards on accounts that touch PHI, scheduling, and billing.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!enrollData && (
            <>
              <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-2">
                <p className="font-medium">You'll need an authenticator app such as:</p>
                <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                  <li>Google Authenticator (iOS / Android)</li>
                  <li>1Password, Bitwarden, or your password manager</li>
                  <li>Authy, Microsoft Authenticator, Duo</li>
                </ul>
              </div>
              <Button className="w-full" onClick={startEnroll} disabled={starting}>
                {starting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Begin Setup
              </Button>
              <button
                type="button"
                onClick={() => supabase.auth.signOut()}
                className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Sign out
              </button>
            </>
          )}

          {enrollData && (
            <div className="space-y-3 rounded border p-3">
              <p className="text-xs text-muted-foreground">
                Scan this QR with your authenticator app, then enter the 6-digit code it shows.
              </p>
              <div className="flex items-center justify-center bg-white p-3 rounded">
                <div dangerouslySetInnerHTML={{ __html: enrollData.qr }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Can't scan? Enter this secret manually:</Label>
                <code className="block text-[11px] break-all bg-muted px-2 py-1 rounded">{enrollData.secret}</code>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mfa-enroll-code" className="text-xs">6-digit code</Label>
                <Input
                  id="mfa-enroll-code"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  autoFocus
                />
              </div>
              <Button className="w-full" onClick={verifyEnroll} disabled={verifying || code.length < 6}>
                {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify & Enable
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
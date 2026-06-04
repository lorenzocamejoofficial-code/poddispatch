import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Factor {
  id: string;
  friendly_name?: string | null;
  factor_type: string;
  status: string;
}

export function TwoFactorSection() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);

  // Enrollment state
  const [enrolling, setEnrolling] = useState(false);
  const [enrollData, setEnrollData] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const loadFactors = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) toast.error(error.message);
    else setFactors((data?.totp ?? []) as Factor[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadFactors(); }, [loadFactors]);

  const startEnroll = async () => {
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Authenticator ${new Date().toLocaleDateString()}` });
    setEnrolling(false);
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
    loadFactors();
  };

  const cancelEnroll = async () => {
    if (enrollData) await supabase.auth.mfa.unenroll({ factorId: enrollData.factorId });
    setEnrollData(null);
    setCode("");
  };

  const removeFactor = async (factorId: string) => {
    if (!confirm("Remove this authenticator? You'll only be protected by your password until you re-enroll.")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) { toast.error(error.message); return; }
    toast.success("Authenticator removed");
    loadFactors();
  };

  const verified = factors.filter((f) => f.status === "verified");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          {verified.length > 0 ? <ShieldCheck className="h-4 w-4 text-primary" /> : <ShieldAlert className="h-4 w-4 text-muted-foreground" />}
          Two-Factor Authentication
          {verified.length > 0 && <Badge variant="default" className="ml-1 text-[10px]">Enabled</Badge>}
        </CardTitle>
        <CardDescription className="text-xs">
          Adds a 6-digit code from an authenticator app (Google Authenticator, 1Password, Authy) on top of your password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            {verified.length > 0 && !enrollData && (
              <div className="space-y-2">
                {verified.map((f) => (
                  <div key={f.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{f.friendly_name || "Authenticator"}</p>
                      <p className="text-xs text-muted-foreground capitalize">{f.factor_type} · {f.status}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => removeFactor(f.id)}>Remove</Button>
                  </div>
                ))}
              </div>
            )}

            {!enrollData && (
              <Button size="sm" onClick={startEnroll} disabled={enrolling}>
                {enrolling && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                {verified.length > 0 ? "Add another authenticator" : "Enable Two-Factor"}
              </Button>
            )}

            {enrollData && (
              <div className="space-y-3 rounded border p-3">
                <p className="text-xs text-muted-foreground">Scan this QR with your authenticator app, then enter the 6-digit code it shows.</p>
                <div className="flex items-center justify-center bg-white p-3 rounded">
                  {/* QR is returned as raw <svg> markup from Supabase */}
                  <div dangerouslySetInnerHTML={{ __html: enrollData.qr }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Can't scan? Enter this secret manually:</Label>
                  <code className="block text-[11px] break-all bg-muted px-2 py-1 rounded">{enrollData.secret}</code>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="totp-code" className="text-xs">6-digit code</Label>
                  <Input id="totp-code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={verifyEnroll} disabled={verifying || code.length < 6}>
                    {verifying && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />} Verify & Enable
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEnroll}>Cancel</Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
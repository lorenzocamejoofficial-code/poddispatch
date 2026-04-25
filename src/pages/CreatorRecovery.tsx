import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Eye, EyeOff, Loader2, ShieldAlert, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function CreatorRecovery() {
  const [email, setEmail] = useState("");
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLink, setActionLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !secret) {
      toast.error("Email and setup secret are both required");
      return;
    }
    setLoading(true);
    setActionLink(null);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/creator-recovery`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Setup-Secret": secret,
          },
          body: JSON.stringify({
            email: email.trim(),
            redirect_to: `${window.location.origin}/reset-password`,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Recovery failed");
      } else {
        setActionLink(data.action_link);
        toast.success("Recovery link generated");
      }
    } catch (err: any) {
      toast.error(err?.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!actionLink) return;
    await navigator.clipboard.writeText(actionLink);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive mb-2">
            <ShieldAlert className="h-5 w-5" />
            <span className="text-xs font-bold tracking-wider uppercase">Break-Glass Recovery</span>
          </div>
          <CardTitle>Creator Account Recovery</CardTitle>
          <CardDescription>
            Emergency recovery for the System Creator account. Requires the SETUP_SECRET stored in
            Lovable Cloud secrets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              This page is for emergency use only. It will create or rebind the Creator account to
              the email you provide and generate a one-time password reset link.
            </AlertDescription>
          </Alert>

          {!actionLink ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Creator Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="secret">SETUP_SECRET</Label>
                <div className="relative">
                  <Input
                    id="secret"
                    type={showSecret ? "text" : "password"}
                    placeholder="Paste setup secret"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    autoComplete="off"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Found in Lovable Cloud → Secrets → SETUP_SECRET
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Recovering…
                  </>
                ) : (
                  "Generate Recovery Link"
                )}
              </Button>
            </form>
          ) : (
            <div className="space-y-3">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Creator account is ready for <strong>{email}</strong>. Click the link below (or
                  copy and open it) to set a new password.
                </AlertDescription>
              </Alert>
              <div className="rounded-md border bg-muted/50 p-3 text-xs break-all font-mono">
                {actionLink}
              </div>
              <div className="flex gap-2">
                <Button onClick={copyLink} variant="outline" className="flex-1">
                  <Copy className="mr-2 h-4 w-4" />
                  {copied ? "Copied" : "Copy Link"}
                </Button>
                <Button asChild className="flex-1">
                  <a href={actionLink} target="_blank" rel="noopener noreferrer">
                    Open Reset Page
                  </a>
                </Button>
              </div>
            </div>
          )}

          <div className="pt-2 text-center">
            <Link to="/login" className="text-xs text-muted-foreground hover:text-foreground">
              ← Back to login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

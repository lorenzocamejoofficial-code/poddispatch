import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Truck, ShieldCheck, Users, ArrowLeft, Loader2, Eye, EyeOff } from "lucide-react";

const MARKETING_SITE_URL = "https://www.thepoddispatch.com";

function getRoleLanding(role: string | null, isSystemCreator: boolean): string {
  if (isSystemCreator) return "/system";
  switch (role) {
    case "owner": return "/";
    case "manager": return "/";
    case "dispatcher": return "/";
    case "biller": return "/billing";
    case "crew": return "/crew-dashboard";
    default: return "/";
  }
}

type LoginMode = "landing" | "staff" | "crew";

export default function Login() {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") === "crew" ? "crew" as LoginMode : "landing" as LoginMode;
  const [mode, setMode] = useState<LoginMode>(initialMode);
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState("PodDispatch");
  // MFA challenge (TOTP) — set after signIn when the user has 2FA enrolled
  // and the session AAL needs to be upgraded from aal1 to aal2.
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaSubmitting, setMfaSubmitting] = useState(false);
  const { user, role, isSystemCreator, activeCompanyId, loading: authLoading, membershipLoaded, signIn, signOut } = useAuth();
  const navigate = useNavigate();

  // If coming from a token link, store it for post-login redirect
  const tokenRedirect = searchParams.get("token_redirect");

  // Redirect when authenticated AND membership data is fully resolved.
  // Waiting for membershipLoaded prevents redirecting to /create-company
  // (or any wrong path) before role/activeCompanyId have actually loaded,
  // which previously caused a brief 404 flash.
  useEffect(() => {
    if (authLoading || !user || !membershipLoaded) return;
    // Don't auto-route while a TOTP challenge is pending.
    if (mfaFactorId) return;

    if (!isSystemCreator && !activeCompanyId) {
      navigate("/create-company", { replace: true });
      return;
    }

    // Hard-block: non-creator admin roles cannot sign in to the creator
    // test tenant (Lorenzo Test Company). The test tenant is owned by the
    // system creator and is not a real customer environment — any standard
    // admin login into it is treated as misconfigured.
    if (
      !isSystemCreator &&
      activeCompanyId &&
      role && ["owner", "manager", "dispatcher", "biller"].includes(role)
    ) {
      (async () => {
        const { data } = await supabase
          .from("companies")
          .select("creator_test_tenant")
          .eq("id", activeCompanyId)
          .maybeSingle();
        if ((data as any)?.creator_test_tenant === true) {
          await signOut();
          setError(
            "This account is attached to a creator test tenant and cannot sign in here. Contact the system creator if you believe this is an error."
          );
          return;
        }
        // Not blocked — proceed with normal redirect.
        if (tokenRedirect) {
          navigate(`/crew/${tokenRedirect}`, { replace: true });
        } else {
          navigate(getRoleLanding(role, isSystemCreator), { replace: true });
        }
      })();
      return;
    }

    // If there's a token redirect pending, go to crew view
    if (tokenRedirect) {
      navigate(`/crew/${tokenRedirect}`, { replace: true });
      return;
    }

    navigate(getRoleLanding(role, isSystemCreator), { replace: true });
  }, [user, role, isSystemCreator, activeCompanyId, authLoading, membershipLoaded, navigate, tokenRedirect, signOut, mfaFactorId]);

  // The public /login page is not scoped to a tenant, so we always show
  // the platform brand. A previous unfiltered `company_settings` lookup
  // could surface an arbitrary tenant's name here depending on RLS.

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      setLoading(false);
      return;
    }

    const { error: signInError } = await signIn(email.trim(), password);
    if (signInError) {
      setError(signInError === "Invalid login credentials"
        ? "Invalid email or password. Contact your dispatcher if you need help."
        : signInError);
      setLoading(false);
      return;
    }
    // Check whether MFA is required for this session.
    try {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const verified = (factors?.totp ?? []).find((f: any) => f.status === "verified");
        if (verified) {
          const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: verified.id });
          if (!chErr && ch) {
            setMfaFactorId(verified.id);
            setMfaChallengeId(ch.id);
          }
        }
      }
    } catch (e) {
      // Non-fatal: if MFA check fails, fall through to normal redirect.
      console.warn("MFA check failed", e);
    }
    setLoading(false);
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaFactorId || !mfaChallengeId) return;
    setMfaSubmitting(true);
    setError("");
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: mfaChallengeId,
      code: mfaCode.trim(),
    });
    setMfaSubmitting(false);
    if (vErr) {
      setError(vErr.message || "Incorrect code. Try again.");
      return;
    }
    setMfaFactorId(null);
    setMfaChallengeId(null);
    setMfaCode("");
  };

  const cancelMfa = async () => {
    setMfaFactorId(null);
    setMfaChallengeId(null);
    setMfaCode("");
    await signOut();
  };

  // Render the TOTP challenge instead of the landing/login form when pending.
  if (mfaFactorId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-primary shadow-md">
              <ShieldCheck className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Two-Factor Verification</h1>
            <p className="mt-1 text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
          </div>
          <form onSubmit={handleMfaVerify} className="space-y-4">
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            )}
            <div className="space-y-2">
              <Label htmlFor="mfa-code">Authentication code</Label>
              <Input
                id="mfa-code"
                inputMode="numeric"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={mfaSubmitting || mfaCode.length < 6}>
              {mfaSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…</> : "Verify"}
            </Button>
            <button type="button" onClick={cancelMfa} className="w-full text-xs text-muted-foreground hover:text-foreground">
              Cancel and sign out
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Landing page — two clear entry points
  if (mode === "landing") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm">
          <div className="mb-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-primary shadow-lg">
              <Truck className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{companyName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Dispatch Management System</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setMode("crew")}
              className="group w-full rounded-xl border-2 border-border bg-card p-5 text-left transition-all hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">Crew</p>
                  <p className="text-sm text-muted-foreground">View your runs and update statuses</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode("staff")}
              className="group w-full rounded-xl border-2 border-border bg-card p-5 text-left transition-all hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">Administration</p>
                  <p className="text-sm text-muted-foreground">Dispatch, billing, and management</p>
                </div>
              </div>
            </button>
          </div>

          <div className="mt-6 text-center text-xs text-muted-foreground">
            <a href={MARKETING_SITE_URL} className="hover:underline">Back to website</a>
            <span className="mx-1.5">·</span>
            <a href="/legal?tab=terms" className="hover:underline">Terms of Service</a>
            <span className="mx-1.5">·</span>
            <a href="/legal?tab=privacy" className="hover:underline">Privacy Policy</a>
            <span className="mx-1.5">·</span>
            <a href="mailto:support@thepoddispatch.com" className="hover:underline">Contact</a>
          </div>
        </div>
      </div>
    );
  }

  // Login form — shared between crew and admin modes
  const isCrew = mode === "crew";
  const modeLabel = isCrew ? "Crew" : "Administration";
  const modeIcon = isCrew ? <Users className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <button
            onClick={() => { setMode("landing"); setError(""); setPassword(""); }}
            className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-primary shadow-md">
              {modeIcon}
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">{modeLabel} Sign In</h1>
            <p className="mt-1 text-sm text-muted-foreground">{companyName}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground focus:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...</> : "Sign In"}
          </Button>

          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-3">
              <a href="/forgot-password" className="text-xs text-primary hover:underline font-medium">
                Forgot password?
              </a>
              <span className="text-xs text-muted-foreground">·</span>
              <a href="/forgot-email" className="text-xs text-primary hover:underline font-medium">
                Forgot email?
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              Accounts are created by your company admin.
            </p>
          </div>
        </form>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          <a href={MARKETING_SITE_URL} className="hover:underline">Back to website</a>
          <span className="mx-1.5">·</span>
          <a href="/legal?tab=terms" className="hover:underline">Terms of Service</a>
          <span className="mx-1.5">·</span>
          <a href="/legal?tab=privacy" className="hover:underline">Privacy Policy</a>
          <span className="mx-1.5">·</span>
          <a href="mailto:support@thepoddispatch.com" className="hover:underline">Contact</a>
        </div>
      </div>
    </div>
  );
}

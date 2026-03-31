import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Truck, ShieldCheck, Users, ArrowLeft, Loader2 } from "lucide-react";

function getRoleLanding(role: string | null, isSystemCreator: boolean): string {
  if (isSystemCreator) return "/system";
  switch (role) {
    case "owner": return "/";
    case "dispatcher": return "/";
    case "biller": return "/trips";
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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState("PodDispatch");
  const { user, role, isSystemCreator, activeCompanyId, loading: authLoading, signIn } = useAuth();
  const navigate = useNavigate();

  // If coming from a token link, store it for post-login redirect
  const tokenRedirect = searchParams.get("token_redirect");

  // Redirect when authenticated and role is resolved
  useEffect(() => {
    if (authLoading || !user) return;

    if (!isSystemCreator && !activeCompanyId) {
      navigate("/create-company", { replace: true });
      return;
    }

    // If there's a token redirect pending, go to crew view
    if (tokenRedirect) {
      navigate(`/crew/${tokenRedirect}`, { replace: true });
      return;
    }

    navigate(getRoleLanding(role, isSystemCreator), { replace: true });
  }, [user, role, isSystemCreator, activeCompanyId, authLoading, navigate, tokenRedirect]);

  useEffect(() => {
    supabase
      .from("company_settings")
      .select("company_name")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.company_name) setCompanyName(data.company_name);
      });
  }, []);

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
    }
    setLoading(false);
  };

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
              onClick={() => setMode("admin")}
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

          <div className="mt-8 text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              New company?{" "}
              <a href="/signup" className="text-primary hover:underline font-medium">
                Create Company
              </a>
            </p>
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
            <Input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
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
      </div>
    </div>
  );
}

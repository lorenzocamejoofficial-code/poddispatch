import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { Truck } from "lucide-react";

function getRoleLanding(role: string | null, isSystemCreator: boolean): string {
  if (isSystemCreator) return "/system";
  switch (role) {
    case "owner": return "/";
    case "dispatcher": return "/";
    case "biller": return "/billing";
    case "crew": return "/";
    default: return "/";
  }
}

export default function Login() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState("PodDispatch");
  const { user, role, isSystemCreator, activeCompanyId, loading: authLoading, signIn } = useAuth();
  const navigate = useNavigate();

  // Redirect when authenticated and role is resolved
  useEffect(() => {
    if (authLoading || !user) return;

    // User has no company — send to create-company
    if (!isSystemCreator && !activeCompanyId) {
      navigate("/create-company", { replace: true });
      return;
    }

    navigate(getRoleLanding(role, isSystemCreator), { replace: true });
  }, [user, role, isSystemCreator, activeCompanyId, authLoading, navigate]);

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-primary">
            <Truck className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{companyName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Dispatch Management System</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              checked={remember}
              onCheckedChange={(v) => setRemember(v === true)}
            />
            <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground">
              Remember this device
            </Label>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>

          <div className="text-center space-y-1">
            <p className="text-xs text-muted-foreground">
              Accounts are created by your company admin.
            </p>
            <p className="text-xs text-muted-foreground">
              New company?{" "}
              <a href="/signup" className="text-primary hover:underline font-medium">
                Create Company
              </a>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

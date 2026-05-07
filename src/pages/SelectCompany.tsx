import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, LogOut } from "lucide-react";

/**
 * Multi-membership gate. Shown when an authenticated user belongs to more
 * than one company and has no profiles.active_company_id set. Picking a
 * company persists the choice and hard-reloads into "/" so every
 * tenant-scoped store starts fresh.
 */
export default function SelectCompany() {
  const { memberships, switchCompany, signOut, user, loading, membershipLoaded } = useAuth();
  const navigate = useNavigate();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Single-membership users should never land here.
    if (membershipLoaded && memberships.length <= 1) {
      navigate("/", { replace: true });
    }
  }, [membershipLoaded, memberships.length, navigate]);

  if (loading || !membershipLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const handlePick = async (companyId: string) => {
    setPendingId(companyId);
    setError(null);
    const { error } = await switchCompany(companyId);
    if (error) {
      setError(error);
      setPendingId(null);
    }
    // On success switchCompany triggers a full reload.
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Building2 className="h-5 w-5 text-primary" />
            Choose a company
          </CardTitle>
          <CardDescription>
            You're signed in as <span className="font-medium">{user?.email}</span>. Pick which company you want to work in. You can switch any time from the sidebar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {memberships.map((m) => (
            <button
              key={m.company_id}
              onClick={() => handlePick(m.company_id)}
              disabled={pendingId !== null}
              className="flex w-full items-center justify-between rounded-md border bg-card px-4 py-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            >
              <div>
                <p className="font-medium">{m.company_name}</p>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {m.role}
                </p>
              </div>
              {pendingId === m.company_id && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              )}
            </button>
          ))}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <div className="pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground"
              onClick={() => signOut()}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
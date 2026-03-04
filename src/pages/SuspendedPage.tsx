import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Truck, Ban, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function SuspendedPage() {
  const { signOut, activeCompanyId } = useAuth();
  const navigate = useNavigate();
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCompanyId) return;
    supabase
      .from("companies")
      .select("suspended_reason")
      .eq("id", activeCompanyId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.suspended_reason) setReason(data.suspended_reason);
      });
  }, [activeCompanyId]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" />
          <span className="font-bold text-foreground">PodDispatch</span>
          <Badge variant="destructive" className="text-[10px] ml-2">Account Suspended</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2 text-muted-foreground">
          <LogOut className="h-3.5 w-3.5" /> Sign Out
        </Button>
      </header>

      <div className="max-w-md mx-auto p-4 lg:p-8 mt-12">
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <Ban className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Account Suspended</h1>
            <p className="text-sm text-muted-foreground">
              Your company's account has been suspended by an administrator.
            </p>
            {reason && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Reason:</span> {reason}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Contact <span className="font-medium text-foreground">support@poddispatch.com</span> for assistance.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

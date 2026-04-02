import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Truck, Mail } from "lucide-react";

export default function TrialExpired() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <Truck className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Trial Period Ended</h1>
          <p className="text-sm text-muted-foreground">
            Your 45-day trial has expired. To continue using PodDispatch, please contact our team to set up your subscription.
          </p>
          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            <div className="flex items-center gap-2 justify-center">
              <Mail className="h-4 w-4 text-primary" />
              <span className="font-medium">support@poddispatch.com</span>
            </div>
          </div>
          <Button variant="outline" onClick={async () => { await signOut(); navigate("/login"); }} className="w-full">
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

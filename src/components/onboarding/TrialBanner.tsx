import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { differenceInDays } from "date-fns";

export function TrialBanner() {
  const { activeCompanyId, isAdmin } = useAuth();
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCompanyId || !isAdmin) return;
    supabase.from("subscription_records").select("subscription_status, trial_ends_at")
      .eq("company_id", activeCompanyId).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setStatus(data.subscription_status);
        if ((data as any).trial_ends_at) {
          const days = differenceInDays(new Date((data as any).trial_ends_at), new Date());
          setDaysLeft(Math.max(0, days));
        }
      });
  }, [activeCompanyId, isAdmin]);

  if (!isAdmin || !status) return null;
  if (status !== "trial" || daysLeft === null) return null;

  const urgent = daysLeft <= 7;

  return (
    <div className={`flex items-center justify-between rounded-lg border px-4 py-2 mb-4 ${
      urgent ? "border-destructive/30 bg-destructive/5" : "border-primary/20 bg-primary/5"
    }`}>
      <p className={`text-sm ${urgent ? "text-destructive" : "text-foreground"}`}>
        <span className="font-medium">Trial Period:</span> {daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining
      </p>
      <Badge variant={urgent ? "destructive" : "outline"} className="text-xs">
        {urgent ? "Expiring Soon" : "Active Trial"}
      </Badge>
    </div>
  );
}

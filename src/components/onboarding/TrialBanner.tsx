import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { trialDaysLeft } from "@/lib/trial-window";

const TRIAL_STATUSES = new Set(["trial", "trial_active", "trial_pending_start", "TEST_ACTIVE"]);

export function TrialBanner() {
  const { activeCompanyId, isOwnerOrCreator } = useAuth();
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCompanyId || !isOwnerOrCreator) return;
    supabase.from("subscription_records")
      .select("subscription_status, trial_ends_at, trial_started_at")
      .eq("company_id", activeCompanyId).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setStatus(data.subscription_status);
        // Shared trial window helper — same clock the creator panels use.
        const left = trialDaysLeft(data as any);
        if (left !== null) setDaysLeft(Math.max(0, left));
      });
  }, [activeCompanyId, isOwnerOrCreator]);

  if (!isOwnerOrCreator || !status) return null;
  if (!TRIAL_STATUSES.has(status) || daysLeft === null) return null;

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

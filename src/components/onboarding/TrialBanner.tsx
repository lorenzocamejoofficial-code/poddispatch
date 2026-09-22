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
        // Shared trial window helper — same clock the creator panels and the
        // login gate use. No clamping: past the end date this reads negative
        // and the banner shows a real expired state.
        setDaysLeft(trialDaysLeft(data as any));
      });
  }, [activeCompanyId, isOwnerOrCreator]);

  if (!isOwnerOrCreator || !status) return null;
  if (!TRIAL_STATUSES.has(status) || daysLeft === null) return null;

  const expired = daysLeft <= 0;
  const urgent = daysLeft <= 7;

  return (
    <div className={`flex items-center justify-between rounded-lg border px-4 py-2 mb-4 ${
      urgent ? "border-destructive/30 bg-destructive/5" : "border-primary/20 bg-primary/5"
    }`}>
      <p className={`text-sm ${urgent ? "text-destructive" : "text-foreground"}`}>
        {expired ? (
          <><span className="font-medium">Trial ended.</span> Choose a plan to keep full access.</>
        ) : (
          <><span className="font-medium">Trial Period:</span> {daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining</>
        )}
      </p>
      <Badge variant={urgent ? "destructive" : "outline"} className="text-xs">
        {expired ? "Trial Ended" : urgent ? "Expiring Soon" : "Active Trial"}
      </Badge>
    </div>
  );
}

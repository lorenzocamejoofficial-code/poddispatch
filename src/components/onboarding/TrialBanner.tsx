import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { differenceInDays } from "date-fns";

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
        const startedAt = (data as any).trial_started_at;
        const legacyEnd = (data as any).trial_ends_at;
        const endDate = startedAt
          ? new Date(new Date(startedAt).getTime() + 30 * 24 * 60 * 60 * 1000)
          : legacyEnd ? new Date(legacyEnd) : null;
        if (endDate) {
          setDaysLeft(Math.max(0, differenceInDays(endDate, new Date())));
        }
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

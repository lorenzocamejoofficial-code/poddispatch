import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Send, Clock, CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
  companyId: string | null;
  // kept for back-compat with parent; no longer rendered as a banner
  readyCount?: number;
  onJumpToReady?: () => void;
}

interface Stats {
  pending: number;
  submittedToday: number;
  failed: number;
  lastSentAt: string | null;
  lastSentFilename: string | null;
  lastSentCount: number;
}

/**
 * Compact in-flight strip. Shows only what is *currently* in the submission
 * queue after the user clicks "Submit Claims to Payers". Intentionally NOT
 * a tutorial — Ready-to-Bill counts live in the KPI/"Needs your action"
 * blocks above, so there is nothing to reconcile here.
 */
export function SubmissionPipelineStrip({ companyId }: Props) {
  const [stats, setStats] = useState<Stats>({
    pending: 0, submittedToday: 0, failed: 0,
    lastSentAt: null, lastSentFilename: null, lastSentCount: 0,
  });

  const refresh = useCallback(async () => {
    if (!companyId) return;
    const todayIso = new Date(); todayIso.setHours(0, 0, 0, 0);

    // Queued / failed are TRUE counts — counting a capped page of recent rows
    // under-reported exactly when the queue was busiest.
    const [{ count: pending }, { count: failed }, { data: sentToday }, { data: lastSentRows }] = await Promise.all([
      supabase
        .from("claim_submission_queue" as any)
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "pending"),
      supabase
        .from("claim_submission_queue" as any)
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "failed"),
      supabase
        .from("claim_submission_queue" as any)
        .select("claim_ids")
        .eq("company_id", companyId)
        .eq("status", "submitted")
        .gte("updated_at", todayIso.toISOString()),
      supabase
        .from("claim_submission_queue" as any)
        .select("claim_ids, filename, updated_at")
        .eq("company_id", companyId)
        .eq("status", "submitted")
        .order("updated_at", { ascending: false })
        .limit(1),
    ]);

    const submittedToday = ((sentToday ?? []) as any[])
      .reduce((sum, r) => sum + (r.claim_ids?.length ?? 0), 0);
    const lastSent = ((lastSentRows ?? []) as any[])[0];
    setStats({
      pending: pending ?? 0,
      submittedToday,
      failed: failed ?? 0,
      lastSentAt: lastSent?.updated_at ?? null,
      lastSentFilename: lastSent?.filename ?? null,
      lastSentCount: lastSent?.claim_ids?.length ?? 0,
    });
  }, [companyId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  if (!companyId) return null;

  // If nothing has ever been queued and nothing is in flight, this strip is noise.
  const isQuiet = stats.pending === 0 && stats.submittedToday === 0 && stats.failed === 0 && !stats.lastSentAt;
  if (isQuiet) return null;

  return (
    <Card className="border-muted-foreground/20 bg-muted/30">
      <CardContent className="p-3">
        <div className="flex items-center gap-4 flex-wrap text-xs">
          <span className="flex items-center gap-1.5 font-medium">
            <Send className="h-3.5 w-3.5 text-primary" />
            In flight to Office Ally
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            <span className="font-semibold">{stats.pending}</span>
            <span className="text-muted-foreground">queued</span>
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span className="font-semibold">{stats.submittedToday}</span>
            <span className="text-muted-foreground">sent today</span>
          </span>
          {stats.failed > 0 && (
            <span className="flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
              <span className="font-semibold text-destructive">{stats.failed}</span>
              <span className="text-muted-foreground">failed</span>
            </span>
          )}
          {stats.lastSentAt && (
            <span className="text-muted-foreground ml-auto">
              Last batch: {stats.lastSentCount} claim{stats.lastSentCount === 1 ? "" : "s"} ·{" "}
              {new Date(stats.lastSentAt).toLocaleString()}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
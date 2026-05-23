import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, Clock, CheckCircle2, AlertCircle, Info } from "lucide-react";

interface Props { companyId: string | null; }

interface Stats {
  pending: number;
  submittedToday: number;
  failed: number;
  lastSentAt: string | null;
  lastSentFilename: string | null;
  lastSentCount: number;
}

/**
 * One submission pipeline, one status strip. Every "Submit to Office Ally"
 * button on this page (group submit + per-claim submit in the drawer) writes
 * to the SAME claim_submission_queue table. The Railway SFTP worker polls
 * that table every ~30 seconds and uploads to Office Ally. This strip shows
 * what's currently in flight so users never wonder "did it actually go?".
 */
export function SubmissionPipelineStrip({ companyId }: Props) {
  const [stats, setStats] = useState<Stats>({
    pending: 0, submittedToday: 0, failed: 0,
    lastSentAt: null, lastSentFilename: null, lastSentCount: 0,
  });

  const refresh = useCallback(async () => {
    if (!companyId) return;
    const todayIso = new Date(); todayIso.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("claim_submission_queue" as any)
      .select("status, claim_ids, filename, updated_at, created_at")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false })
      .limit(100);
    const rows = (data ?? []) as any[];
    const pending = rows.filter(r => r.status === "pending").length;
    const failed = rows.filter(r => r.status === "failed").length;
    const submittedToday = rows
      .filter(r => r.status === "submitted" && new Date(r.updated_at) >= todayIso)
      .reduce((sum, r) => sum + (r.claim_ids?.length ?? 0), 0);
    const lastSent = rows.find(r => r.status === "submitted");
    setStats({
      pending, submittedToday, failed,
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

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Send className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold">Office Ally Submission Pipeline</p>
              <Badge variant="outline" className="text-[10px] font-normal gap-1">
                <Clock className="h-3 w-3" />Worker polls every ~30s
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1.5">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              Every "Submit to Office Ally" button — whether you submit one claim from the drawer
              or the entire Ready-to-Bill group — funnels through this single queue. Selecting one
              claim sends a batch of one; selecting 47 sends one envelope of 47. There is no other
              path out. The 837P Export page is for downloading copies for your records.
            </p>
            <div className="flex items-center gap-4 mt-3 flex-wrap text-xs">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-600" />
                <span className="font-semibold">{stats.pending}</span>
                <span className="text-muted-foreground">in queue</span>
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span className="font-semibold">{stats.submittedToday}</span>
                <span className="text-muted-foreground">claims sent today</span>
              </span>
              {stats.failed > 0 && (
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  <span className="font-semibold text-destructive">{stats.failed}</span>
                  <span className="text-muted-foreground">failed (see panel below)</span>
                </span>
              )}
              {stats.lastSentAt && (
                <span className="text-muted-foreground ml-auto">
                  Last batch: <span className="font-mono">{stats.lastSentFilename}</span>{" "}
                  ({stats.lastSentCount} claim{stats.lastSentCount === 1 ? "" : "s"}) ·{" "}
                  {new Date(stats.lastSentAt).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
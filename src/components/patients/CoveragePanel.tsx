import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ShieldCheck, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { NO_COMPANY } from "@/lib/company-scope";
import type { ReviewAction } from "@/lib/coverage/review-actions";
import { applyCoverageReview } from "./coverage-apply";

interface CoverageRow {
  id: string; patient_id: string; check_type: "eligibility" | "discovery"; status: string;
  payer_name: string | null; plan_name: string | null; payer_member_id: string | null;
  coverage_start: string | null; coverage_end: string | null; implied_cob_order: string;
  source: string; checked_at: string; confidence: string | null;
  reviewed: boolean; review_action: ReviewAction | null;
}

const ACTION_LABEL: Record<ReviewAction, string> = {
  confirmed_secondary: "Confirmed as secondary",
  confirmed_primary: "Confirmed as primary",
  dismissed: "Dismissed",
};

export function CoveragePanel({ patientId }: { patientId: string }) {
  const { activeCompanyId, user, isBilling } = useAuth();
  const { toast } = useToast();
  const canReview = isBilling; // owners/managers/creators/billers; dispatchers view-only
  const [rows, setRows] = useState<CoverageRow[] | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("coverage_checks" as any)
      .select("id, patient_id, check_type, status, payer_name, plan_name, payer_member_id, coverage_start, coverage_end, implied_cob_order, source, checked_at, confidence, reviewed, review_action")
      .eq("company_id", activeCompanyId ?? NO_COMPANY)
      .eq("patient_id", patientId)
      .order("checked_at", { ascending: false })
      .limit(50);
    if (error) { toast({ title: "Could not load coverage results", variant: "destructive" }); setRows([]); return; }
    setRows((data as any[]) ?? []);
  }, [activeCompanyId, patientId, toast]);

  useEffect(() => { setRows(null); load(); }, [load]);

  const runCheck = async (checkType: "eligibility" | "discovery") => {
    setRunning(checkType);
    const { data, error } = await supabase.functions.invoke("run-coverage-check", { body: { patient_id: patientId, check_type: checkType } });
    setRunning(null);
    if (error || (data && data.success === false)) {
      toast({ title: "Coverage check failed", description: (data as any)?.error ?? "Please try again.", variant: "destructive" });
      return;
    }
    await load();
  };

  const review = async (row: CoverageRow, action: ReviewAction) => {
    if (!user || !activeCompanyId) return;
    setBusyId(row.id);
    const res = await applyCoverageReview({ row, action, userId: user.id, companyId: activeCompanyId });
    setBusyId(null);
    if (res.ok === false) { toast({ title: "Review not saved", description: res.error, variant: "destructive" }); return; }
    toast({ title: ACTION_LABEL[action] });
    await load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Results are never applied until you confirm one.</p>
        {canReview && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={!!running} onClick={() => runCheck("eligibility")}>
              {running === "eligibility" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />} Check eligibility
            </Button>
            <Button size="sm" disabled={!!running} onClick={() => runCheck("discovery")}>
              {running === "discovery" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} Run coverage check
            </Button>
          </div>
        )}
      </div>

      {rows === null ? (
        <Skeleton className="h-24 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState title="No coverage checks yet" description={canReview ? "Run a coverage check to look for other insurance." : "No results to show."} />
      ) : (
        rows.map((r) => {
          const usable = (r.check_type === "discovery" && r.status === "coverage_found") || (r.check_type === "eligibility" && r.status === "active");
          return (
            <Card key={r.id} className={r.reviewed ? "" : "border-primary/60 bg-primary/5"} data-testid="coverage-card">
              <CardContent className="p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-sm">{r.payer_name ?? "No coverage found"}</span>
                  {r.plan_name && <span className="text-xs text-muted-foreground">{r.plan_name}</span>}
                  <Badge variant="outline" className="capitalize">{r.check_type}</Badge>
                  {r.source === "stub" && <Badge variant="secondary">Example — live check activates on your account</Badge>}
                  {!r.reviewed && <Badge>Needs review</Badge>}
                  {r.reviewed && r.review_action && <Badge variant="outline">{ACTION_LABEL[r.review_action]}</Badge>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
                  <div><span className="text-muted-foreground">Member ID: </span>{r.payer_member_id ?? "—"}</div>
                  <div><span className="text-muted-foreground">Coverage: </span>{r.coverage_start ?? "—"} → {r.coverage_end ?? "open"}</div>
                  <div><span className="text-muted-foreground">Order: </span><span className="capitalize">{r.implied_cob_order}</span></div>
                  <div><span className="text-muted-foreground">Confidence: </span><span className="capitalize">{r.confidence ?? "—"}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Source: </span>{r.source} · {new Date(r.checked_at).toLocaleString()}</div>
                </div>
                {canReview && !r.reviewed && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {usable && r.payer_name && (
                      <>
                        <Button size="sm" disabled={busyId === r.id} onClick={() => review(r, "confirmed_secondary")}>Confirm & add as secondary</Button>
                        <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => review(r, "confirmed_primary")}>Confirm as primary</Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" disabled={busyId === r.id} onClick={() => review(r, "dismissed")}>Dismiss</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

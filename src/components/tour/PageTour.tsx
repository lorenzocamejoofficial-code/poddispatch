import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowRight, ArrowLeft, Target, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getTourForRoute, type PageTour as PageTourConfig, type TourRole } from "./tourContent";

/**
 * Auto-firing per-page guided tour. Mounted once inside AdminLayout / CrewLayout.
 *
 * On every route change:
 *   1. Look up the tour for (route, role).
 *   2. Check user_tour_progress; if no row, open the modal.
 *   3. Record completion (or skip) when the user finishes/dismisses.
 *
 * Replayed via the "?tour=replay" search param or the Account Settings panel.
 */
export function PageTour() {
  const { user, role, isSystemCreator } = useAuth();
  const location = useLocation();
  const [tour, setTour] = useState<PageTourConfig | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [open, setOpen] = useState(false);

  // Resolve effective role (system creator sees creator tours)
  const effectiveRole: TourRole | null =
    isSystemCreator ? "creator" : ((role ?? null) as TourRole | null);

  useEffect(() => {
    if (!user?.id || !effectiveRole) return;
    const cfg = getTourForRoute(location.pathname, effectiveRole);
    if (!cfg) {
      setOpen(false);
      setTour(null);
      return;
    }

    const replay = new URLSearchParams(location.search).get("tour") === "replay";

    let cancelled = false;
    (async () => {
      if (replay) {
        if (cancelled) return;
        setTour(cfg);
        setStepIdx(0);
        setOpen(true);
        return;
      }
      const { data, error } = await (supabase as any)
        .from("user_tour_progress")
        .select("page_key")
        .eq("user_id", user.id)
        .eq("page_key", cfg.pageKey)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        // Don't block UI on tour fetch errors; just skip
        return;
      }
      if (!data) {
        setTour(cfg);
        setStepIdx(0);
        setOpen(true);
      }
    })();

    return () => { cancelled = true; };
  }, [location.pathname, location.search, user?.id, effectiveRole]);

  const markComplete = async (skipped: boolean) => {
    if (!user?.id || !tour) return;
    await (supabase as any)
      .from("user_tour_progress")
      .upsert(
        { user_id: user.id, page_key: tour.pageKey, skipped, completed_at: new Date().toISOString() },
        { onConflict: "user_id,page_key" },
      );
  };

  const handleClose = async (next: boolean) => {
    if (!next && tour) {
      // Closed without finishing → mark skipped so it doesn't auto-fire again
      await markComplete(true);
    }
    setOpen(next);
  };

  if (!tour) return null;

  const step = tour.steps[stepIdx];
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === tour.steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="uppercase tracking-wide font-medium">Quick tour · {tour.pageName}</span>
            <Badge variant="outline" className="ml-auto text-[10px]">
              {stepIdx + 1} / {tour.steps.length}
            </Badge>
          </div>
          {isFirst && (
            <DialogDescription className="text-xs italic pt-1">
              {tour.goal}
            </DialogDescription>
          )}
          <DialogTitle className="text-base flex items-center gap-2 pt-2">
            {isLast ? <Trophy className="h-4 w-4 text-primary" /> : null}
            {step.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p className="text-foreground leading-relaxed">{step.body}</p>
          {step.lookFor && (
            <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
              <Target className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-foreground">Look for </span>
                <span className="text-muted-foreground">{step.lookFor}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleClose(false)}
          >
            Skip tour
          </Button>
          <div className="flex gap-2">
            {!isFirst && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                className="gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
            )}
            {!isLast ? (
              <Button size="sm" onClick={() => setStepIdx((i) => i + 1)} className="gap-1.5">
                Next <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={async () => {
                  await markComplete(false);
                  setOpen(false);
                }}
                className="gap-1.5"
              >
                Got it
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
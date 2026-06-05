import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getToursForRole, type TourRole } from "./tourContent";
import { toast } from "sonner";

/**
 * Account Settings panel: lists every tour available for the user's role,
 * showing whether each has been seen and a Replay button that opens the
 * destination page with ?tour=replay so PageTour re-fires it.
 */
export function ReplayToursCard() {
  const { user, role, isSystemCreator } = useAuth();
  const navigate = useNavigate();
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const effectiveRole: TourRole | null =
    isSystemCreator ? "creator" : ((role ?? null) as TourRole | null);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("user_tour_progress")
        .select("page_key")
        .eq("user_id", user.id);
      setSeen(new Set(((data ?? []) as { page_key: string }[]).map(r => r.page_key)));
      setLoading(false);
    })();
  }, [user?.id]);

  const tours = effectiveRole ? getToursForRole(effectiveRole) : [];

  const replay = (route: string) => {
    const sep = route.includes("?") ? "&" : "?";
    navigate(`${route}${sep}tour=replay`);
  };

  const resetAll = async () => {
    if (!user?.id) return;
    const { error } = await (supabase as any)
      .from("user_tour_progress")
      .delete()
      .eq("user_id", user.id);
    if (error) {
      toast.error("Couldn't reset tours: " + error.message);
      return;
    }
    setSeen(new Set());
    toast.success("Tours reset — they'll re-appear on first visit");
  };

  if (!effectiveRole || tours.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Product Tours
        </CardTitle>
        <CardDescription className="text-xs">
          A quick guided tour fires the first time you visit each main page. You can replay any of them here, or reset them all so they re-appear on first visit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-xs text-muted-foreground">Loading…</div>
        ) : (
          <>
            <div className="space-y-1.5">
              {tours.map((t) => (
                <div
                  key={t.pageKey}
                  className="flex items-center justify-between gap-2 rounded-md border p-2 text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">{t.pageName}</div>
                    <div className="text-muted-foreground truncate">{t.route}</div>
                  </div>
                  {seen.has(t.pageKey) ? (
                    <Badge variant="outline" className="text-[10px]">Seen</Badge>
                  ) : (
                    <Badge className="text-[10px]">New</Badge>
                  )}
                  <Button size="sm" variant="ghost" className="gap-1.5 h-7" onClick={() => replay(t.route)}>
                    <RotateCcw className="h-3 w-3" /> Replay
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-1 border-t">
              <Button size="sm" variant="outline" onClick={resetAll}>Reset all tours</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
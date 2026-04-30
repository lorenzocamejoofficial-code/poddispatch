import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyName } from "@/hooks/useCompanyName";
import { Truck, AlertTriangle } from "lucide-react";

/**
 * Reads the `maintenance_mode` flag from creator_settings and:
 *  - blocks the entire app with a full-page maintenance screen for non-creators
 *  - shows a small amber banner above the app for the system creator
 */
export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { isSystemCreator, user } = useAuth();
  const { companyName } = useCompanyName();
  const [maintenance, setMaintenance] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // Skip while the tab is hidden — no point polling in the background.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const { data } = await supabase
        .from("creator_settings")
        .select("value")
        .eq("key", "maintenance_mode")
        .maybeSingle();
      if (!cancelled) {
        setMaintenance(data?.value === "true");
        setLoaded(true);
      }
    };
    load();
    // Re-check every 5 min so toggling still propagates, but without
    // adding a request-per-minute background tax on every active session.
    const interval = setInterval(load, 5 * 60_000);
    // Re-check immediately when the tab regains focus, so creators flipping
    // maintenance mode still see fast propagation when users come back.
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!loaded || !user) return <>{children}</>;

  if (maintenance && !isSystemCreator) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <div className="rounded-2xl bg-primary/10 p-6 mb-6">
          <Truck className="h-14 w-14 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">PodDispatch</h1>
        <p className="max-w-md text-base text-foreground">
          We are currently performing scheduled maintenance. We will be back shortly.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">{companyName}</p>
      </div>
    );
  }

  if (maintenance && isSystemCreator) {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-xs font-bold text-black">
          <AlertTriangle className="h-3.5 w-3.5" />
          Maintenance mode is active — users see a maintenance screen
          <AlertTriangle className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1">{children}</div>
      </div>
    );
  }

  return <>{children}</>;
}

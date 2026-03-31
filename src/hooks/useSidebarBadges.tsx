import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface SidebarBadgeCounts {
  dispatch: number;
  billing: number;
  overrides: number;
  compliance: number;
  trips: number;
}

const EMPTY: SidebarBadgeCounts = { dispatch: 0, billing: 0, overrides: 0, compliance: 0, trips: 0 };

/* ── localStorage helpers for last-seen timestamps ── */

const STORAGE_PREFIX = "pd_badge_seen_";

/** Pages that have badge clearing behaviour */
const BADGE_PATHS: Record<string, keyof SidebarBadgeCounts> = {
  "/": "dispatch",
  "/simulation": "dispatch",
  "/billing": "billing",
  "/override-monitor": "overrides",
  "/compliance": "compliance",
  "/trips": "trips",
};

function storageKey(userId: string, badgeKey: string) {
  return `${STORAGE_PREFIX}${userId}_${badgeKey}`;
}

function getLastSeen(userId: string, badgeKey: string): string | null {
  try {
    return localStorage.getItem(storageKey(userId, badgeKey));
  } catch {
    return null;
  }
}

function markSeen(userId: string, badgeKey: string) {
  try {
    localStorage.setItem(storageKey(userId, badgeKey), new Date().toISOString());
  } catch { /* ignore */ }
}

/* ── count helpers ── */

async function countAfter(
  table: string,
  filters: Record<string, any>,
  since: string | null,
  dateCol = "created_at"
): Promise<number> {
  let q = supabase.from(table as any).select("id", { count: "exact", head: true });
  for (const [k, v] of Object.entries(filters)) {
    q = q.eq(k, v);
  }
  if (since) {
    q = q.gte(dateCol, since);
  }
  const { count } = await q;
  return count ?? 0;
}

export function useSidebarBadges(role: string | null) {
  const { user } = useAuth();
  const location = useLocation();
  const [counts, setCounts] = useState<SidebarBadgeCounts>(EMPTY);

  const userId = user?.id ?? null;

  // Mark current page as seen whenever the route changes
  useEffect(() => {
    if (!userId) return;
    const badgeKey = BADGE_PATHS[location.pathname];
    if (badgeKey) {
      markSeen(userId, badgeKey);
    }
  }, [location.pathname, userId]);

  const fetchCounts = useCallback(async () => {
    if (!role || !userId) return;
    const r = role === "biller" ? "billing" : role;
    const next = { ...EMPTY };

    const jobs: Promise<void>[] = [];

    const seenDispatch = getLastSeen(userId, "dispatch");
    const seenBilling = getLastSeen(userId, "billing");
    const seenCompliance = getLastSeen(userId, "compliance");
    const seenTrips = getLastSeen(userId, "trips");
    const seenOverrides = getLastSeen(userId, "overrides");

    if (["owner", "dispatcher"].includes(r)) {
      jobs.push(
        countAfter("operational_alerts", { status: "open" }, seenDispatch).then(c => { next.dispatch = c; })
      );
    }
    if (["owner", "billing"].includes(r)) {
      jobs.push(
        countAfter("trip_records", { status: "ready_for_billing" }, seenBilling).then(c => { next.billing = c; })
      );
      jobs.push(
        countAfter("qa_reviews", { status: "pending" }, seenCompliance).then(c => { next.compliance = c; })
      );
      // Trips: completed but missing docs, created/updated after last seen
      jobs.push((async () => {
        let q = supabase
          .from("trip_records")
          .select("id", { count: "exact", head: true })
          .eq("status", "completed")
          .eq("documentation_complete", false);
        if (seenTrips) {
          q = q.gte("updated_at", seenTrips);
        }
        const { count } = await q;
        next.trips = count ?? 0;
      })());
    }
    if (r === "owner") {
      const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      // Use the later of the 24h window or the last-seen timestamp
      const overrideSince = seenOverrides && seenOverrides > windowStart ? seenOverrides : windowStart;

      jobs.push((async () => {
        const [{ count: sc }, { count: bc }] = await Promise.all([
          supabase.from("safety_overrides").select("id", { count: "exact", head: true }).gte("created_at", overrideSince),
          supabase.from("billing_overrides").select("id", { count: "exact", head: true }).gte("created_at", overrideSince),
        ]);
        next.overrides = (sc ?? 0) + (bc ?? 0);
      })());
    }

    await Promise.all(jobs);
    setCounts(next);
  }, [role, userId]);

  // Re-fetch when route changes (to reflect cleared counts) and on realtime events
  useEffect(() => {
    fetchCounts();
  }, [fetchCounts, location.pathname]);

  useEffect(() => {
    const channel = supabase
      .channel("sidebar-badges")
      .on("postgres_changes", { event: "*", schema: "public", table: "operational_alerts" }, () => fetchCounts())
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_records" }, () => fetchCounts())
      .on("postgres_changes", { event: "*", schema: "public", table: "safety_overrides" }, () => fetchCounts())
      .on("postgres_changes", { event: "*", schema: "public", table: "billing_overrides" }, () => fetchCounts())
      .on("postgres_changes", { event: "*", schema: "public", table: "qa_reviews" }, () => fetchCounts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchCounts]);

  return counts;
}

export function getBadgeForPath(path: string, counts: SidebarBadgeCounts): number {
  switch (path) {
    case "/":
    case "/simulation":
      return counts.dispatch;
    case "/billing":
      return counts.billing;
    case "/override-monitor":
      return counts.overrides;
    case "/compliance":
      return counts.compliance;
    case "/trips":
      return counts.trips;
    default:
      return 0;
  }
}

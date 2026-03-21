import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SidebarBadgeCounts {
  dispatch: number;
  billing: number;
  overrides: number;
  compliance: number;
  trips: number;
}

const EMPTY: SidebarBadgeCounts = { dispatch: 0, billing: 0, overrides: 0, compliance: 0, trips: 0 };

async function countQuery(table: string, filters: Record<string, any>): Promise<number> {
  let q = supabase.from(table as any).select("id", { count: "exact", head: true });
  for (const [k, v] of Object.entries(filters)) {
    q = q.eq(k, v);
  }
  const { count } = await q;
  return count ?? 0;
}

export function useSidebarBadges(role: string | null) {
  const [counts, setCounts] = useState<SidebarBadgeCounts>(EMPTY);

  const fetchCounts = useCallback(async () => {
    if (!role) return;
    const r = role === "owner" ? "admin" : role === "biller" ? "billing" : role;
    const next = { ...EMPTY };

    const jobs: Promise<void>[] = [];

    if (["admin", "dispatcher"].includes(r)) {
      jobs.push(countQuery("operational_alerts", { status: "open" }).then(c => { next.dispatch = c; }));
    }
    if (["admin", "billing"].includes(r)) {
      jobs.push(countQuery("trip_records", { status: "ready_for_billing" }).then(c => { next.billing = c; }));
      jobs.push(countQuery("qa_reviews", { status: "pending" }).then(c => { next.compliance = c; }));
      jobs.push(countQuery("trip_records", { status: "completed", documentation_complete: false }).then(c => { next.trips = c; }));
    }
    if (r === "admin") {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      jobs.push((async () => {
        const [{ count: sc }, { count: bc }] = await Promise.all([
          supabase.from("safety_overrides").select("id", { count: "exact", head: true }).gte("created_at", since),
          supabase.from("billing_overrides").select("id", { count: "exact", head: true }).gte("created_at", since),
        ]);
        next.overrides = (sc ?? 0) + (bc ?? 0);
      })());
    }

    await Promise.all(jobs);
    setCounts(next);
  }, [role]);

  useEffect(() => {
    fetchCounts();
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

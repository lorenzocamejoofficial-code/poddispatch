import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SidebarBadgeCounts {
  dispatch: number;     // active unread operational_alerts
  billing: number;      // trip_records ready_for_billing without matching claim
  overrides: number;    // safety + billing overrides in last 24h
  compliance: number;   // qa_reviews with status pending
  trips: number;        // completed trips missing PCR fields
}

const EMPTY: SidebarBadgeCounts = { dispatch: 0, billing: 0, overrides: 0, compliance: 0, trips: 0 };

export function useSidebarBadges(role: string | null) {
  const [counts, setCounts] = useState<SidebarBadgeCounts>(EMPTY);

  const fetchCounts = useCallback(async () => {
    if (!role) return;

    const effectiveRole = role === "owner" ? "admin" : role === "biller" ? "billing" : role;

    const promises: Promise<{ key: string; count: number }>[] = [];

    // Dispatch Command badge: active operational alerts
    if (["admin", "dispatcher"].includes(effectiveRole)) {
      promises.push(
        supabase
          .from("operational_alerts" as any)
          .select("id", { count: "exact", head: true })
          .eq("status", "open")
          .then(({ count }) => ({ key: "dispatch", count: count ?? 0 }))
      );
    } else {
      promises.push(Promise.resolve({ key: "dispatch", count: 0 }));
    }

    // Billing badge: trip_records ready_for_billing
    if (["admin", "billing"].includes(effectiveRole)) {
      promises.push(
        supabase
          .from("trip_records" as any)
          .select("id", { count: "exact", head: true })
          .eq("status", "ready_for_billing")
          .then(({ count }) => ({ key: "billing", count: count ?? 0 }))
      );
    } else {
      promises.push(Promise.resolve({ key: "billing", count: 0 }));
    }

    // Override Monitor badge: overrides in last 24h
    if (effectiveRole === "admin") {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [{ count: safetyCount }, { count: billingCount }] = await Promise.all([
        supabase.from("safety_overrides").select("id", { count: "exact", head: true }).gte("created_at", since),
        supabase.from("billing_overrides").select("id", { count: "exact", head: true }).gte("created_at", since),
      ]);
      promises.push(Promise.resolve({ key: "overrides", count: (safetyCount ?? 0) + (billingCount ?? 0) }));
    } else {
      promises.push(Promise.resolve({ key: "overrides", count: 0 }));
    }

    // Compliance badge: pending qa_reviews
    if (["admin", "billing"].includes(effectiveRole)) {
      promises.push(
        supabase
          .from("qa_reviews")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .then(({ count }) => ({ key: "compliance", count: count ?? 0 }))
      );
    } else {
      promises.push(Promise.resolve({ key: "compliance", count: 0 }));
    }

    // Trips badge: completed trips missing PCR fields
    if (["admin", "billing"].includes(effectiveRole)) {
      promises.push(
        supabase
          .from("trip_records" as any)
          .select("id", { count: "exact", head: true })
          .eq("status", "completed")
          .eq("documentation_complete", false)
          .then(({ count }) => ({ key: "trips", count: count ?? 0 }))
      );
    } else {
      promises.push(Promise.resolve({ key: "trips", count: 0 }));
    }

    const results = await Promise.all(promises);
    const newCounts = { ...EMPTY };
    for (const r of results) {
      (newCounts as any)[r.key] = r.count;
    }
    setCounts(newCounts);
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

// Map nav paths to badge keys
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

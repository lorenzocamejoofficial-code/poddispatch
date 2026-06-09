import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type NotificationTier = "action" | "fyi" | "system";
export type NotificationMode = "admin" | "crew" | "creator";

export interface NotificationItem {
  id: string; // composite: source_table:source_id
  source_table: string;
  source_id: string;
  tier: NotificationTier;
  title: string;
  body?: string;
  link?: string;
  category: string; // grouping key (e.g. "pcr_kickback", "claim_denial")
  icon?: string; // semantic icon name
  created_at: string;
  read: boolean;
  snoozed_until?: string | null;
}

interface ReadRow {
  source_table: string;
  source_id: string;
  read_at: string | null;
  snoozed_until: string | null;
}

const LIMIT_PER_SOURCE = 50;
const LOOKBACK_DAYS = 14;

function lookbackIso() {
  return new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function useNotificationFeed(mode: NotificationMode = "admin") {
  const { user, role, activeCompanyId, isSystemCreator } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reads, setReads] = useState<Map<string, ReadRow>>(new Map());
  const [digestMode, setDigestMode] = useState(false);

  const userId = user?.id ?? null;

  // Load digest preference
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from("notification_preferences" as any)
        .select("digest_mode")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) setDigestMode(!!(data as any).digest_mode);
    })();
  }, [userId]);

  const fetchReads = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("notification_reads" as any)
      .select("source_table, source_id, read_at, snoozed_until")
      .eq("user_id", userId);
    const map = new Map<string, ReadRow>();
    (data ?? []).forEach((r: any) => {
      map.set(`${r.source_table}:${r.source_id}`, r);
    });
    setReads(map);
  }, [userId]);

  const fetchAll = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const since = lookbackIso();
    const next: NotificationItem[] = [];
    const isAdmin = role === "owner" || role === "manager" || role === "creator";
    const isOwner = role === "owner" || role === "creator";
    const isDispatcher = role === "dispatcher" || isAdmin;
    const isBiller = role === "biller" || isAdmin;
    const isCrew = role === "crew";

    const jobs: Promise<void>[] = [];

    // System announcements — everyone
    jobs.push((async () => {
      const { data } = await supabase
        .from("system_announcements" as any)
        .select("id, title, body, tier, link, published_at, category")
        .gte("published_at", since)
        .order("published_at", { ascending: false })
        .limit(LIMIT_PER_SOURCE);
      (data ?? []).forEach((r: any) => {
        const isUpdate = r.category === "product_update";
        next.push({
          id: `system_announcements:${r.id}`,
          source_table: "system_announcements",
          source_id: r.id,
          tier: (r.tier as NotificationTier) ?? "system",
          title: r.title,
          body: r.body,
          link: r.link ?? undefined,
          category: isUpdate ? "product_update" : "announcement",
          icon: isUpdate ? "Sparkles" : "Megaphone",
          created_at: r.published_at,
          read: false,
        });
      });
    })());

    // -------- ADMIN / CREW shared scopes --------
    if (mode !== "creator" && activeCompanyId) {
      // notifications table (PCR kickbacks, schedule changes)
      jobs.push((async () => {
        let q = supabase
          .from("notifications" as any)
          .select("id, message, notification_type, created_at, user_id")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(LIMIT_PER_SOURCE);
        // Notifications are addressed to a profile_id via user_id. Owner sees all; others only theirs.
        if (!isOwner) {
          q = q.eq("user_id", userId);
        }
        const { data } = await q;
        (data ?? []).forEach((r: any) => {
          const type = r.notification_type ?? "";
          const isAction = ["pcr_kickback", "claim_rejection", "schedule_change", "emergency"].includes(type);
          next.push({
            id: `notifications:${r.id}`,
            source_table: "notifications",
            source_id: r.id,
            tier: isAction ? "action" : "fyi",
            title: r.message?.slice(0, 80) ?? "Notification",
            body: r.message,
            link: undefined,
            category: type || "notification",
            created_at: r.created_at,
            read: false,
          });
        });
      })());

      // Dispatch alerts
      if (isDispatcher) {
        jobs.push((async () => {
          const { data } = await supabase
            .from("operational_alerts" as any)
            .select("id, alert_type, message, severity, created_at, status")
            .eq("company_id", activeCompanyId)
            .eq("status", "open")
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(LIMIT_PER_SOURCE);
          (data ?? []).forEach((r: any) => {
            const isAction = r.severity === "critical" || r.alert_type === "emergency";
            next.push({
              id: `operational_alerts:${r.id}`,
              source_table: "operational_alerts",
              source_id: r.id,
              tier: isAction ? "action" : "fyi",
              title: r.alert_type?.replaceAll("_", " ") ?? "Operational alert",
              body: r.message,
              link: "/dispatch",
              category: r.alert_type ?? "operational",
              created_at: r.created_at,
              read: false,
            });
          });
        })());
      }

      // Billing: failures, denials, biller tasks, QA
      if (isBiller) {
        jobs.push((async () => {
          const { data } = await supabase
            .from("claim_creation_failures" as any)
            .select("id, error_message, trip_id, created_at")
            .eq("company_id", activeCompanyId)
            .is("resolved_at", null)
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(LIMIT_PER_SOURCE);
          (data ?? []).forEach((r: any) => {
            next.push({
              id: `claim_creation_failures:${r.id}`,
              source_table: "claim_creation_failures",
              source_id: r.id,
              tier: "action",
              title: "Claim creation failed",
              body: r.error_message?.slice(0, 200),
              link: r.trip_id ? `/pcr/${r.trip_id}` : "/billing",
              category: "claim_failure",
              created_at: r.created_at,
              read: false,
            });
          });
        })());

        jobs.push((async () => {
          const { data } = await supabase
            .from("claim_records" as any)
            .select("id, status, denial_reason, denial_code, updated_at, total_charge")
            .eq("company_id", activeCompanyId)
            .eq("status", "denied")
            .gte("updated_at", since)
            .order("updated_at", { ascending: false })
            .limit(LIMIT_PER_SOURCE);
          (data ?? []).forEach((r: any) => {
            next.push({
              id: `claim_records:${r.id}`,
              source_table: "claim_records",
              source_id: r.id,
              tier: "action",
              title: `Claim denied${r.denial_code ? ` (${r.denial_code})` : ""}`,
              body: r.denial_reason ?? "Open claim to view denial details.",
              link: `/billing?claim=${r.id}`,
              category: "claim_denial",
              created_at: r.updated_at,
              read: false,
            });
          });
        })());

        jobs.push((async () => {
          const { data } = await supabase
            .from("biller_tasks" as any)
            .select("id, title, description, priority, created_at, status")
            .eq("company_id", activeCompanyId)
            .eq("status", "pending")
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(LIMIT_PER_SOURCE);
          (data ?? []).forEach((r: any) => {
            next.push({
              id: `biller_tasks:${r.id}`,
              source_table: "biller_tasks",
              source_id: r.id,
              tier: r.priority === "high" || r.priority === "urgent" ? "action" : "fyi",
              title: r.title ?? "AR task",
              body: r.description,
              link: "/billing",
              category: "biller_task",
              created_at: r.created_at,
              read: false,
            });
          });
        })());

        jobs.push((async () => {
          const { data } = await supabase
            .from("qa_reviews" as any)
            .select("id, flag_reason, severity, trip_id, created_at, status")
            .eq("company_id", activeCompanyId)
            .eq("status", "pending")
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(LIMIT_PER_SOURCE);
          (data ?? []).forEach((r: any) => {
            next.push({
              id: `qa_reviews:${r.id}`,
              source_table: "qa_reviews",
              source_id: r.id,
              tier: r.severity === "red" ? "action" : "fyi",
              title: `QA flag — ${r.severity ?? ""}`.trim(),
              body: r.flag_reason,
              link: r.trip_id ? `/pcr/${r.trip_id}` : "/compliance",
              category: "qa_review",
              created_at: r.created_at,
              read: false,
            });
          });
        })());
      }

      // Owner-only: overrides + subscription history
      if (isOwner) {
        jobs.push((async () => {
          const [{ data: so }, { data: bo }] = await Promise.all([
            supabase
              .from("safety_overrides" as any)
              .select("id, reason, created_at, leg_id")
              .eq("company_id", activeCompanyId)
              .gte("created_at", since)
              .order("created_at", { ascending: false })
              .limit(LIMIT_PER_SOURCE),
            supabase
              .from("billing_overrides" as any)
              .select("id, reason, created_at, trip_id")
              .eq("company_id", activeCompanyId)
              .gte("created_at", since)
              .order("created_at", { ascending: false })
              .limit(LIMIT_PER_SOURCE),
          ]);
          (so ?? []).forEach((r: any) => {
            next.push({
              id: `safety_overrides:${r.id}`,
              source_table: "safety_overrides",
              source_id: r.id,
              tier: "action",
              title: "Safety override applied",
              body: r.reason,
              link: `/override-monitor?row=${r.id}`,
              category: "override",
              created_at: r.created_at,
              read: false,
            });
          });
          (bo ?? []).forEach((r: any) => {
            next.push({
              id: `billing_overrides:${r.id}`,
              source_table: "billing_overrides",
              source_id: r.id,
              tier: "action",
              title: "Billing override applied",
              body: r.reason,
              link: `/override-monitor?row=${r.id}`,
              category: "override",
              created_at: r.created_at,
              read: false,
            });
          });
        })());

        jobs.push((async () => {
          const { data } = await supabase
            .from("subscription_status_history" as any)
            .select("id, old_status, new_status, changed_at")
            .eq("company_id", activeCompanyId)
            .gte("changed_at", since)
            .order("changed_at", { ascending: false })
            .limit(LIMIT_PER_SOURCE);
          (data ?? []).forEach((r: any) => {
            const isAction = ["payment_issue", "trial_expired", "suspended", "canceled"].includes(r.new_status);
            next.push({
              id: `subscription_status_history:${r.id}`,
              source_table: "subscription_status_history",
              source_id: r.id,
              tier: isAction ? "action" : "fyi",
              title: `Subscription: ${r.new_status}`,
              body: r.old_status ? `Changed from ${r.old_status}` : undefined,
              link: "/account",
              category: "subscription",
              created_at: r.changed_at,
              read: false,
            });
          });
        })());
      }
    }

    // -------- CREATOR scope --------
    if (mode === "creator" && isSystemCreator) {
      jobs.push((async () => {
        const { data } = await supabase
          .from("support_tickets" as any)
          .select("id, ticket_number, subject, severity, status, created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(LIMIT_PER_SOURCE);
        (data ?? []).forEach((r: any) => {
          const isAction = r.severity === "urgent" || r.severity === "high";
          next.push({
            id: `support_tickets:${r.id}`,
            source_table: "support_tickets",
            source_id: r.id,
            tier: isAction ? "action" : "fyi",
            title: `${r.ticket_number ?? "Ticket"} · ${r.subject ?? ""}`.trim(),
            body: `Severity: ${r.severity} · ${r.status}`,
            link: "/creator-console",
            category: "support",
            created_at: r.created_at,
            read: false,
          });
        });
      })());

      // New signups / pending verifications
      jobs.push((async () => {
        const { data } = await supabase
          .from("companies" as any)
          .select("id, name, onboarding_status, created_at")
          .in("onboarding_status", ["pending_approval", "payment_issue"])
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(LIMIT_PER_SOURCE);
        (data ?? []).forEach((r: any) => {
          next.push({
            id: `companies:${r.id}`,
            source_table: "companies",
            source_id: r.id,
            tier: "action",
            title: `${r.name} · ${r.onboarding_status}`,
            link: "/creator-console",
            category: "tenant_lifecycle",
            created_at: r.created_at,
            read: false,
          });
        });
      })());

      // Outbound email log
      jobs.push((async () => {
        const { data } = await supabase
          .from("email_send_log" as any)
          .select("id, recipient_email, template_name, status, created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(LIMIT_PER_SOURCE);
        (data ?? []).forEach((r: any) => {
          const failed = r.status && !["sent", "delivered"].includes(r.status);
          next.push({
            id: `email_send_log:${r.id}`,
            source_table: "email_send_log",
            source_id: r.id,
            tier: failed ? "action" : "system",
            title: `Email ${r.status} → ${r.recipient_email}`,
            body: r.template_name,
            category: "email_log",
            created_at: r.created_at,
            read: false,
          });
        });
      })());
    }

    await Promise.all(jobs);

    // Sort newest first
    next.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    setItems(next);
    setLoading(false);
  }, [userId, role, activeCompanyId, isSystemCreator, mode]);

  // Merge reads into items
  const merged = useMemo<NotificationItem[]>(() => {
    const now = Date.now();
    return items
      .map((it) => {
        const r = reads.get(it.id);
        return {
          ...it,
          read: !!r?.read_at,
          snoozed_until: r?.snoozed_until ?? null,
        };
      })
      .filter((it) => {
        // hide snoozed items until snooze expires
        if (it.snoozed_until && new Date(it.snoozed_until).getTime() > now) return false;
        // digest mode: hide unread FYI from live bell (system + action still show)
        if (digestMode && it.tier === "fyi" && !it.read) return false;
        return true;
      });
  }, [items, reads, digestMode]);

  const actionRequired = useMemo(() => merged.filter((m) => m.tier === "action"), [merged]);
  const fyi = useMemo(() => merged.filter((m) => m.tier === "fyi"), [merged]);
  const productUpdates = useMemo(
    () => merged.filter((m) => m.category === "product_update"),
    [merged]
  );
  const system = useMemo(
    () => merged.filter((m) => m.tier === "system" && m.category !== "product_update"),
    [merged]
  );
  const unreadCount = useMemo(() => merged.filter((m) => !m.read).length, [merged]);

  // Initial + realtime
  useEffect(() => {
    fetchAll();
    fetchReads();
  }, [fetchAll, fetchReads]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notif-feed-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "operational_alerts" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "claim_creation_failures" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "system_announcements" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "notification_reads", filter: `user_id=eq.${userId}` }, () => fetchReads())
      .subscribe();
    const id = setInterval(fetchAll, 60_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(id);
    };
  }, [userId, fetchAll, fetchReads]);

  const markRead = useCallback(async (item: NotificationItem) => {
    if (!userId) return;
    // optimistic
    setReads((prev) => {
      const next = new Map(prev);
      next.set(item.id, {
        source_table: item.source_table,
        source_id: item.source_id,
        read_at: new Date().toISOString(),
        snoozed_until: null,
      });
      return next;
    });
    await supabase.from("notification_reads" as any).upsert(
      {
        user_id: userId,
        source_table: item.source_table,
        source_id: item.source_id,
        read_at: new Date().toISOString(),
      },
      { onConflict: "user_id,source_table,source_id" }
    );
  }, [userId]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const unread = merged.filter((m) => !m.read);
    if (unread.length === 0) return;
    const rows = unread.map((m) => ({
      user_id: userId,
      source_table: m.source_table,
      source_id: m.source_id,
      read_at: new Date().toISOString(),
    }));
    setReads((prev) => {
      const next = new Map(prev);
      rows.forEach((r) => {
        next.set(`${r.source_table}:${r.source_id}`, { ...r, snoozed_until: null });
      });
      return next;
    });
    await supabase.from("notification_reads" as any).upsert(rows, { onConflict: "user_id,source_table,source_id" });
  }, [userId, merged]);

  const snooze = useCallback(async (item: NotificationItem, hours: number) => {
    if (!userId) return;
    const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    setReads((prev) => {
      const next = new Map(prev);
      next.set(item.id, {
        source_table: item.source_table,
        source_id: item.source_id,
        read_at: null,
        snoozed_until: until,
      });
      return next;
    });
    await supabase.from("notification_reads" as any).upsert(
      {
        user_id: userId,
        source_table: item.source_table,
        source_id: item.source_id,
        snoozed_until: until,
      },
      { onConflict: "user_id,source_table,source_id" }
    );
  }, [userId]);

  return {
    items: merged,
    actionRequired,
    fyi,
    productUpdates,
    system,
    unreadCount,
    loading,
    digestMode,
    markRead,
    markAllRead,
    snooze,
    refetch: fetchAll,
  };
}

export function useNotificationPreferences() {
  const { user } = useAuth();
  const [digestMode, setDigestMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("notification_preferences" as any)
        .select("digest_mode")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setDigestMode(!!(data as any).digest_mode);
      setLoading(false);
    })();
  }, [user]);

  const update = useCallback(async (next: boolean) => {
    if (!user) return;
    setDigestMode(next);
    await supabase.from("notification_preferences" as any).upsert(
      { user_id: user.id, digest_mode: next },
      { onConflict: "user_id" }
    );
  }, [user]);

  return { digestMode, setDigestMode: update, loading };
}
import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchRealCompanyIds } from "@/lib/real-companies";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, LifeBuoy, ShieldAlert, Clock, UserPlus,
  TrendingDown, CheckCircle2, RefreshCw, ArrowRight, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Severity = "critical" | "warning" | "info" | "ok";

interface AlertTile {
  key: string;
  label: string;
  count: number;
  severity: Severity;
  icon: typeof AlertTriangle;
  href: string;
  sub?: string;
}

const sevStyles: Record<Severity, { ring: string; iconBg: string; iconFg: string; badge: string }> = {
  critical: {
    ring: "border-destructive/40 bg-destructive/5 hover:bg-destructive/10",
    iconBg: "bg-destructive/15",
    iconFg: "text-destructive",
    badge: "bg-destructive text-destructive-foreground",
  },
  warning: {
    ring: "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10",
    iconBg: "bg-amber-500/15",
    iconFg: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-500 text-white",
  },
  info: {
    ring: "border-primary/30 bg-primary/5 hover:bg-primary/10",
    iconBg: "bg-primary/15",
    iconFg: "text-primary",
    badge: "bg-primary text-primary-foreground",
  },
  ok: {
    ring: "border-border bg-card hover:bg-muted/40",
    iconBg: "bg-muted",
    iconFg: "text-muted-foreground",
    badge: "bg-muted text-muted-foreground",
  },
};

export function MissionControlPanel() {
  const [tiles, setTiles] = useState<AlertTile[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const realIds = await fetchRealCompanyIds();
      const now = new Date();
      const in3Days = new Date(now.getTime() + 3 * 86400000).toISOString();
      const thirtyAgo = new Date(now.getTime() - 30 * 86400000).toISOString();

      const [pendingCos, urgentTix, openTix, quarantine, trialEnding, churned] = await Promise.all([
        // Pending company approvals
        supabase
          .from("companies")
          .select("id", { count: "exact", head: true })
          .eq("creator_test_tenant", false)
          .eq("is_sandbox", false)
          .is("deleted_at", null)
          .in("onboarding_status", ["pending_approval", "signup_started", "agreements_accepted"]),
        // Urgent open support tickets
        realIds.length === 0
          ? Promise.resolve({ count: 0, error: null })
          : supabase
              .from("support_tickets")
              .select("id", { count: "exact", head: true })
              .in("company_id", realIds)
              .eq("severity", "urgent")
              .in("status", ["open", "in_progress"]),
        // All open support tickets
        realIds.length === 0
          ? Promise.resolve({ count: 0, error: null })
          : supabase
              .from("support_tickets")
              .select("id", { count: "exact", head: true })
              .in("company_id", realIds)
              .in("status", ["open", "in_progress"]),
        // Remittance items pending review
        supabase
          .from("remittance_quarantine")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending_review"),
        // Trials ending in next 3 days
        realIds.length === 0
          ? Promise.resolve({ count: 0, error: null })
          : supabase
              .from("subscription_records")
              .select("id", { count: "exact", head: true })
              .in("company_id", realIds)
              .eq("subscription_status", "trial")
              .lte("trial_ends_at", in3Days)
              .gte("trial_ends_at", now.toISOString()),
        // Recently churned (last 30 days)
        realIds.length === 0
          ? Promise.resolve({ count: 0, error: null })
          : supabase
              .from("subscription_records")
              .select("id", { count: "exact", head: true })
              .in("company_id", realIds)
              .in("subscription_status", ["trial_expired", "suspended"])
              .gte("updated_at", thirtyAgo),
      ]);

      const t: AlertTile[] = [
        {
          key: "urgent_tix",
          label: "Urgent Tickets",
          count: urgentTix.count ?? 0,
          severity: (urgentTix.count ?? 0) > 0 ? "critical" : "ok",
          icon: LifeBuoy,
          href: "/creator-console?tab=support",
          sub: `${openTix.count ?? 0} total open`,
        },
        {
          key: "quarantine",
          label: "Remittance Quarantine",
          count: quarantine.count ?? 0,
          severity: (quarantine.count ?? 0) > 0 ? "critical" : "ok",
          icon: ShieldAlert,
          href: "/creator-console?tab=quarantine",
          sub: "Needs creator review",
        },
        {
          key: "pending_cos",
          label: "Pending Approvals",
          count: pendingCos.count ?? 0,
          severity: (pendingCos.count ?? 0) > 0 ? "warning" : "ok",
          icon: UserPlus,
          href: "/creator-console?tab=pending",
          sub: "New tenants waiting",
        },
        {
          key: "trial_ending",
          label: "Trials Ending ≤3d",
          count: trialEnding.count ?? 0,
          severity: (trialEnding.count ?? 0) > 0 ? "warning" : "ok",
          icon: Clock,
          href: "/creator-console?tab=active",
          sub: "Reach out before churn",
        },
        {
          key: "churned",
          label: "Churned (30d)",
          count: churned.count ?? 0,
          severity: (churned.count ?? 0) > 0 ? "info" : "ok",
          icon: TrendingDown,
          href: "/creator-console?tab=suspended",
          sub: "Expired or suspended",
        },
      ];

      setTiles(t);
      setLastChecked(new Date());
    } catch (err) {
      console.error("MissionControl load failed:", err);
      setTiles([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const allClear =
    tiles && tiles.every((t) => t.count === 0 || t.severity === "ok" || t.severity === "info");

  return (
    <Card className="border-2">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className={cn(
              "h-2 w-2 rounded-full",
              allClear ? "bg-emerald-500" : "bg-destructive animate-pulse"
            )} />
            <h3 className="text-sm font-semibold text-foreground">Mission Control</h3>
            {allClear && !loading && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                All clear
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {lastChecked && (
              <span className="text-[10px] text-muted-foreground">
                Updated {lastChecked.toLocaleTimeString()}
              </span>
            )}
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {(tiles ?? Array.from({ length: 5 }).map((_, i) => null)).map((tile, i) => {
            if (!tile) {
              return <div key={i} className="h-[88px] rounded-lg border bg-muted/30 animate-pulse" />;
            }
            const s = sevStyles[tile.severity];
            const Icon = tile.icon;
            return (
              <Link
                key={tile.key}
                to={tile.href}
                className={cn(
                  "group rounded-lg border p-3 transition-colors flex flex-col gap-2",
                  s.ring
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className={cn("rounded-md p-1.5", s.iconBg)}>
                    <Icon className={cn("h-3.5 w-3.5", s.iconFg)} />
                  </div>
                  <span className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                    tile.count > 0 ? s.badge : "bg-muted text-muted-foreground"
                  )}>
                    {tile.count}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground leading-tight">{tile.label}</p>
                  {tile.sub && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{tile.sub}</p>
                  )}
                </div>
                <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity self-end" />
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
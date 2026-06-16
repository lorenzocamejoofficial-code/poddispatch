import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, RefreshCw } from "lucide-react";
import { format } from "date-fns";

type Row = {
  company_id: string;
  company_name: string;
  owner_email: string | null;
  approved_at: string | null;
  subscription_status: string;
  trial_skipped: boolean;
  trial_started_at: string | null;
  approval_grace_deadline: string | null;
};

function dayDiff(target: Date, from: Date = new Date()) {
  return Math.ceil((target.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function describe(row: Row): { label: string; tone: "green" | "yellow" | "red" | "muted"; daysLeft: number | null } {
  if (row.trial_skipped) return { label: "Skipped trial — awaiting payment", tone: "muted", daysLeft: null };
  if (row.subscription_status === "active") return { label: "Paid · Active", tone: "green", daysLeft: null };
  if (row.subscription_status === "cancelled") return { label: "Cancelled", tone: "muted", daysLeft: null };

  if (row.trial_started_at) {
    const end = new Date(new Date(row.trial_started_at).getTime() + 30 * 86_400_000);
    const left = dayDiff(end);
    if (left <= 0) return { label: "Expired", tone: "red", daysLeft: 0 };
    if (left <= 7) return { label: `${left} day${left === 1 ? "" : "s"} left`, tone: "yellow", daysLeft: left };
    return { label: `${left} days left`, tone: "green", daysLeft: left };
  }

  if (row.approval_grace_deadline) {
    const hrs = Math.max(0, Math.round((new Date(row.approval_grace_deadline).getTime() - Date.now()) / 3_600_000));
    return { label: `Pending first login (${hrs}h to grace)`, tone: "muted", daysLeft: null };
  }
  return { label: row.subscription_status, tone: "muted", daysLeft: null };
}

function toneClass(t: "green" | "yellow" | "red" | "muted") {
  if (t === "green") return "bg-[hsl(var(--status-green))]/15 text-[hsl(var(--status-green))]";
  if (t === "yellow") return "bg-[hsl(var(--status-yellow))]/15 text-[hsl(var(--status-yellow))]";
  if (t === "red") return "bg-destructive/15 text-destructive";
  return "bg-muted text-muted-foreground";
}

export function TrialCountdownPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("companies")
      .select("id, name, owner_email, approved_at, deleted_at, is_sandbox, creator_test_tenant, subscription_records(subscription_status, trial_skipped, trial_started_at, approval_grace_deadline)")
      .is("deleted_at", null)
      .eq("is_sandbox", false)
      .eq("creator_test_tenant", false)
      .not("approved_at", "is", null)
      .order("approved_at", { ascending: false })
      .limit(200);

    const flat: Row[] = (data ?? []).map((c: any) => {
      const sub = Array.isArray(c.subscription_records) ? c.subscription_records[0] : c.subscription_records;
      return {
        company_id: c.id,
        company_name: c.name,
        owner_email: c.owner_email,
        approved_at: c.approved_at,
        subscription_status: sub?.subscription_status ?? "unknown",
        trial_skipped: !!sub?.trial_skipped,
        trial_started_at: sub?.trial_started_at ?? null,
        approval_grace_deadline: sub?.approval_grace_deadline ?? null,
      };
    });
    setRows(flat);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const id = window.setInterval(load, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" /> Trial & Payment Countdown
        </CardTitle>
        <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-4 pb-4 text-xs text-muted-foreground">No approved companies yet.</p>
        ) : (
          <div className="divide-y">
            {rows.map((r) => {
              const d = describe(r);
              return (
                <div key={r.company_id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{r.company_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.owner_email ?? "—"} · approved {r.approved_at ? format(new Date(r.approved_at), "MMM d") : "—"}
                    </p>
                  </div>
                  <Badge className={`${toneClass(d.tone)} text-xs whitespace-nowrap`}>{d.label}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
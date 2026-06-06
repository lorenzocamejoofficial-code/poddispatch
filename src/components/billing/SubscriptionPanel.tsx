import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CancelSubscriptionDialog } from "./CancelSubscriptionDialog";

type Sub = {
  subscription_status: string;
  plan_id: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  reactivation_deadline: string | null;
};

export function SubscriptionPanel() {
  const { activeCompanyId, role } = useAuth();
  const [sub, setSub] = useState<Sub | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  const isOwner = role === "owner" || role === "creator";

  const load = useCallback(async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("subscription_records")
      .select("subscription_status, plan_id, current_period_end, trial_ends_at, cancel_at_period_end, canceled_at, reactivation_deadline")
      .eq("company_id", activeCompanyId)
      .maybeSingle();
    setSub((data as any) ?? null);
    setLoading(false);
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  if (!isOwner) return null;

  const reactivate = async () => {
    if (!activeCompanyId) return;
    setReactivating(true);
    const { data, error } = await supabase.functions.invoke("reactivate-subscription", {
      body: { company_id: activeCompanyId },
    });
    setReactivating(false);
    if (error || !data?.ok) {
      toast.error("Reactivation failed", { description: error?.message ?? data?.error ?? "Unknown error" });
      return;
    }
    if (data.mode === "uncanceled") {
      toast.success("Subscription reactivated");
      load();
    } else if (data.mode === "requires_checkout") {
      toast.message("Re-subscribe to restore access");
      window.location.href = "/choose-plan";
    }
  };

  const status = sub?.subscription_status ?? "—";
  const endsAt = sub?.current_period_end ? new Date(sub.current_period_end) : null;
  const trialEnds = sub?.trial_ends_at ? new Date(sub.trial_ends_at) : null;
  const reactDeadline = sub?.reactivation_deadline ? new Date(sub.reactivation_deadline) : null;

  const badgeVariant: any =
    status === "active" ? "default"
    : status === "trial" ? "secondary"
    : status === "pending_cancellation" ? "outline"
    : status === "cancelled" || status === "trial_expired" || status === "past_due" ? "destructive"
    : "secondary";

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Subscription</h3>
        <p className="text-sm text-muted-foreground">Cancel or reactivate your PodDispatch subscription.</p>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <div className="mt-1"><Badge variant={badgeVariant}>{status.replace(/_/g, " ")}</Badge></div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Plan</p>
            <p className="text-sm font-medium text-foreground">{sub?.plan_id ?? "—"}</p>
          </div>
        </div>

        {status === "trial" && trialEnds && (
          <p className="text-xs text-muted-foreground">
            Trial ends <span className="font-medium text-foreground">{trialEnds.toLocaleDateString()}</span>. Card on file is not charged before then.
          </p>
        )}
        {status === "active" && endsAt && (
          <p className="text-xs text-muted-foreground">
            Renews on <span className="font-medium text-foreground">{endsAt.toLocaleDateString()}</span>.
          </p>
        )}
        {status === "pending_cancellation" && endsAt && (
          <p className="text-xs text-foreground">
            Cancels on <span className="font-medium">{endsAt.toLocaleDateString()}</span>. You keep full access until then.
          </p>
        )}
        {status === "cancelled" && reactDeadline && (
          <p className="text-xs text-foreground">
            Cancelled. Read-only export window through <span className="font-medium">{reactDeadline.toLocaleDateString()}</span>.
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          {(status === "active" || status === "trial" || status === "pending") && (
            <Button variant="destructive" size="sm" onClick={() => setOpen(true)} disabled={loading}>
              Cancel subscription
            </Button>
          )}
          {status === "pending_cancellation" && (
            <Button size="sm" onClick={reactivate} disabled={reactivating}>
              {reactivating ? "Restoring…" : "Resume subscription"}
            </Button>
          )}
          {status === "cancelled" && (
            <Button size="sm" onClick={reactivate} disabled={reactivating}>
              {reactivating ? "…" : "Reactivate"}
            </Button>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground border-t pt-2">
          Need a full data export (trips, PCRs, claims, 835s)? Email{" "}
          <a href="mailto:support@thepoddispatch.com" className="text-primary hover:underline">support@thepoddispatch.com</a>{" "}
          and we'll deliver it within 30 days under HIPAA Right of Access. Full policy in the{" "}
          <a href="/legal?tab=cancellation" className="text-primary hover:underline">Cancellation Policy</a>.
        </p>
      </div>

      {activeCompanyId && (
        <CancelSubscriptionDialog
          open={open}
          onOpenChange={setOpen}
          companyId={activeCompanyId}
          status={status}
          onCanceled={load}
        />
      )}
    </section>
  );
}
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logAuditEvent } from "@/lib/audit-logger";
import { toast } from "sonner";
import { AlertTriangle, Check, Edit, Flag, Loader2 } from "lucide-react";

interface EmergencyEventPanelProps {
  claim: any;
  onUpdate: () => void;
}

export function EmergencyEventPanel({ claim, onUpdate }: EmergencyEventPanelProps) {
  const { user } = useAuth();
  const [action, setAction] = useState<"accept" | "override" | "escalate" | null>(null);
  const [overrideNote, setOverrideNote] = useState("");
  const [saving, setSaving] = useState(false);

  if (!claim.has_emergency_event) return null;

  const isReviewed = !!claim.emergency_billing_reviewed_at;

  const handleAction = async (type: "accept" | "override" | "escalate") => {
    if (type === "override" && !overrideNote.trim()) {
      toast.error("Please provide a note explaining your override");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        emergency_billing_reviewed_by: user?.id,
        emergency_billing_reviewed_at: new Date().toISOString(),
      };
      if (type === "accept") {
        payload.emergency_billing_override = "accepted";
      } else if (type === "override") {
        payload.emergency_billing_override = `override: ${overrideNote.trim()}`;
      } else {
        payload.emergency_billing_override = "escalated";
      }

      await supabase.from("claim_records" as any).update(payload).eq("id", claim.id);

      logAuditEvent({
        action: `emergency_billing_${type}`,
        tableName: "claim_records",
        recordId: claim.id,
        notes: type === "override" ? overrideNote : `Emergency billing ${type}`,
      });

      toast.success(`Emergency billing ${type === "accept" ? "accepted" : type === "override" ? "overridden" : "escalated"}`);
      setAction(null);
      setOverrideNote("");
      onUpdate();
    } catch {
      toast.error("Failed to save decision");
    }
    setSaving(false);
  };

  return (
    <div className="rounded-lg border-2 border-destructive/30 bg-destructive/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <h4 className="text-sm font-bold text-destructive">Emergency Event</h4>
        {isReviewed && (
          <Badge variant="outline" className="ml-auto text-[10px] border-emerald-400 text-emerald-700">
            <Check className="h-3 w-3 mr-1" /> Reviewed
          </Badge>
        )}
      </div>

      {/* Timeline */}
      {claim.emergency_event_summary && (
        <div className="rounded-md border bg-card p-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">Timeline</p>
          <p className="text-xs text-foreground whitespace-pre-line">{claim.emergency_event_summary}</p>
        </div>
      )}

      {/* Billing Recommendation */}
      {claim.emergency_billing_recommendation && (
        <div className="rounded-md border border-amber-400/30 bg-amber-50 dark:bg-amber-950/20 p-3">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">Billing Recommendation</p>
          <p className="text-xs text-amber-700 dark:text-amber-400">{claim.emergency_billing_recommendation}</p>
        </div>
      )}

      {/* Current decision */}
      {isReviewed && claim.emergency_billing_override && (
        <div className="rounded-md border bg-card p-3">
          <p className="text-xs font-medium text-muted-foreground">Decision: <span className="text-foreground">{claim.emergency_billing_override}</span></p>
          <p className="text-[10px] text-muted-foreground">
            Reviewed {new Date(claim.emergency_billing_reviewed_at).toLocaleString()}
          </p>
        </div>
      )}

      {/* Action buttons — only if not yet reviewed */}
      {!isReviewed && (
        <div className="space-y-2">
          {action === "override" ? (
            <div className="space-y-2">
              <Textarea
                value={overrideNote}
                onChange={e => setOverrideNote(e.target.value)}
                placeholder="Explain why you are deviating from the recommendation..."
                rows={2}
                className="text-xs"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="text-xs" onClick={() => setAction(null)}>Cancel</Button>
                <Button size="sm" className="text-xs" disabled={saving || !overrideNote.trim()} onClick={() => handleAction("override")}>
                  {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                  Save Override
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => handleAction("accept")} disabled={saving}>
                <Check className="h-3.5 w-3.5" /> Accept Recommendation
              </Button>
              <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => setAction("override")} disabled={saving}>
                <Edit className="h-3.5 w-3.5" /> Override with Note
              </Button>
              <Button size="sm" variant="outline" className="text-xs gap-1.5 text-amber-700 border-amber-400/50" onClick={() => handleAction("escalate")} disabled={saving}>
                <Flag className="h-3.5 w-3.5" /> Flag for Escalation
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

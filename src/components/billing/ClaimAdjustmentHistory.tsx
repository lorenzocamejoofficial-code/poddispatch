import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown, History } from "lucide-react";

interface Adjustment {
  id: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  created_at: string;
  changed_by: string;
}

export function ClaimAdjustmentHistory({ tripId }: { tripId: string }) {
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    supabase
      .from("claim_adjustments" as any)
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setAdjustments((data as any[]) ?? []));
  }, [tripId]);

  if (adjustments.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2 hover:text-foreground transition-colors">
        <History className="h-3.5 w-3.5" />
        Adjustment History ({adjustments.length})
        <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pt-2">
        {adjustments.map(adj => (
          <div key={adj.id} className="rounded-md border bg-muted/30 p-2.5 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground capitalize">{adj.field_changed.replace(/_/g, " ")}</span>
              <span className="text-muted-foreground">{new Date(adj.created_at).toLocaleString()}</span>
            </div>
            <div className="flex gap-3">
              <span className="text-destructive/70 line-through">{adj.old_value ?? "—"}</span>
              <span>→</span>
              <span className="text-[hsl(var(--status-green))] font-medium">{adj.new_value ?? "—"}</span>
            </div>
            {adj.reason && <p className="text-muted-foreground italic">Reason: {adj.reason}</p>}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

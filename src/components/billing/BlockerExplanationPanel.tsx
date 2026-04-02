import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDeduplicatedExplanations, type BlockerExplanation } from "@/lib/blocker-explanations";

interface BlockerExplanationPanelProps {
  blockers: string[];
  tripId: string;
  patientId?: string | null;
  /** Compact mode for inline card display */
  compact?: boolean;
}

function FixButton({ exp, tripId, patientId, compact }: {
  exp: BlockerExplanation;
  tripId: string;
  patientId?: string | null;
  compact?: boolean;
}) {
  const navigate = useNavigate();

  const handleFix = () => {
    switch (exp.fixTarget) {
      case "pcr":
        navigate(`/pcr?trip=${tripId}`);
        break;
      case "patient":
        if (patientId) navigate(`/patients?highlight=${patientId}`);
        else navigate("/patients");
        break;
      case "trip":
        navigate(`/trips-clinical?trip=${tripId}`);
        break;
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className={`shrink-0 gap-1 ${compact ? "h-6 text-[10px] px-2" : "h-7 text-xs"}`}
      onClick={(e) => { e.stopPropagation(); handleFix(); }}
    >
      {exp.fixLabel}
      <ArrowRight className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
    </Button>
  );
}

export function BlockerExplanationPanel({ blockers, tripId, patientId, compact = false }: BlockerExplanationPanelProps) {
  if (!blockers || blockers.length === 0) {
    if (!compact) {
      return (
        <div className="rounded-md border border-[hsl(var(--status-green))]/30 bg-[hsl(var(--status-green))]/5 p-3 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-[hsl(var(--status-green))] shrink-0" />
          <span className="text-sm font-medium text-[hsl(var(--status-green))]">Clean Claim Ready</span>
        </div>
      );
    }
    return null;
  }

  const explanations = getDeduplicatedExplanations(blockers);

  if (compact) {
    // Show first 2 explanations inline on the queue card
    const shown = explanations.slice(0, 2);
    const remaining = explanations.length - shown.length;

    return (
      <div className="mt-1.5 space-y-1" onClick={(e) => e.stopPropagation()}>
        {shown.map((exp, i) => (
          <div key={i} className="flex items-start gap-1.5 rounded border border-destructive/20 bg-destructive/5 px-2 py-1">
            <AlertCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium text-destructive">{exp.title}</p>
              <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{exp.explanation}</p>
            </div>
            <FixButton exp={exp} tripId={tripId} patientId={patientId} compact />
          </div>
        ))}
        {remaining > 0 && (
          <p className="text-[10px] text-muted-foreground pl-1">+{remaining} more issue{remaining > 1 ? "s" : ""}</p>
        )}
      </div>
    );
  }

  // Full detail panel
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wider text-destructive">
          Claim Issues ({explanations.length})
        </span>
      </div>
      {explanations.map((exp, i) => (
        <div key={i} className="flex items-start gap-2 rounded-md border border-destructive/15 bg-background/60 p-2.5">
          <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-xs font-semibold text-destructive">{exp.title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{exp.explanation}</p>
          </div>
          <FixButton exp={exp} tripId={tripId} patientId={patientId} />
        </div>
      ))}
    </div>
  );
}

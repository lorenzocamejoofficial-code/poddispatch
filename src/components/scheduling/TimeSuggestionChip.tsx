import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MIN_SAMPLES, type Suggestion } from "@/lib/patient-time-prediction";

interface Props {
  label: string;
  suggestion: Suggestion;
  format?: (v: string | number) => string;
  /** Fills the form field only. The user still saves. */
  onUse?: (v: string | number) => void;
}

/** Advisory-only chip. Never writes data on its own. */
export function TimeSuggestionChip({ label, suggestion, format = (v) => String(v), onUse }: Props) {
  if (suggestion.value == null) return null;
  const fromHistory = suggestion.source === "history";
  const detail = fromHistory
    ? `based on ${suggestion.n} trips · ${suggestion.confidence} confidence`
    : `using plan default (not enough history: ${suggestion.n}/${MIN_SAMPLES})`;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 rounded-md border border-dashed bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground" data-testid="time-suggestion">
      <Sparkles className="h-3 w-3 shrink-0 text-primary" />
      <span><span className="font-medium text-foreground">{label} {format(suggestion.value)}</span> · {detail}</span>
      {onUse && (
        <Button type="button" variant="ghost" size="sm" className="ml-auto h-5 px-1.5 text-[10px] text-primary" onClick={() => onUse(suggestion.value!)}>
          Use suggestion
        </Button>
      )}
    </div>
  );
}

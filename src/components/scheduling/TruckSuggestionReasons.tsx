import { useState } from "react";
import { ChevronDown } from "lucide-react";

export type TruckSuggestionView =
  | { kind: "eligible"; rank: number; reasons: string[] }
  | { kind: "ineligible"; reason: string };

/** Presentational only: advisory rank chip + engine reasons. */
export function TruckSuggestionReasons({ view }: { view: TruckSuggestionView }) {
  const [open, setOpen] = useState(false);
  if (view.kind === "ineligible") {
    return (
      <div className="mb-2 rounded-md border border-border bg-muted/50 px-2 py-1.5 text-[11px]">
        <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 font-semibold text-muted-foreground">Not suitable</span>
        <span className="text-muted-foreground">{view.reason}</span>
      </div>
    );
  }
  const best = view.rank === 1;
  return (
    <div className={`mb-2 rounded-md border px-2 py-1.5 text-[11px] ${best ? "border-primary/50 bg-primary/5" : "border-border bg-muted/30"}`}>
      <button type="button" className="flex w-full items-center gap-1.5 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className={`rounded px-1.5 py-0.5 font-semibold ${best ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
          {best ? "#1 Best fit" : `#${view.rank}`}
        </span>
        <span className="truncate text-muted-foreground">{view.reasons[0]}</span>
        <ChevronDown className={`ml-auto h-3 w-3 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5 pl-1 text-muted-foreground">
          {view.reasons.map((r, i) => <li key={i}>• {r}</li>)}
        </ul>
      )}
    </div>
  );
}

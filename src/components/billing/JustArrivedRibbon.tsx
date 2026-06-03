import { useEffect, useMemo, useState } from "react";
import { Sparkles, X } from "lucide-react";

const SEEN_KEY = "billing_ready_to_bill_last_seen";

interface Claim {
  id: string;
  status: string;
  created_at?: string;
}

interface Props {
  claims: Claim[];
}

/**
 * Small ribbon shown inside the Ready to Bill tab. Tells the biller how
 * many claims have *just landed* from PCR submission since they last
 * opened this stage. Last-seen timestamp is stored in localStorage and
 * cleared on dismiss. Pure presentation — no DB writes.
 */
export function JustArrivedRibbon({ claims }: Props) {
  const [lastSeen, setLastSeen] = useState<string | null>(() => {
    try { return localStorage.getItem(SEEN_KEY); } catch { return null; }
  });

  // Mark current view as seen when the component unmounts (i.e. user navigates
  // away from the Ready to Bill tab). This way the ribbon stays visible while
  // they're working in the tab.
  useEffect(() => {
    return () => {
      try { localStorage.setItem(SEEN_KEY, new Date().toISOString()); } catch { /* ignore */ }
    };
  }, []);

  const newCount = useMemo(() => {
    if (!lastSeen) return 0; // first visit ever: don't show "just arrived"
    const since = new Date(lastSeen).getTime();
    return claims.filter(c => {
      if (c.status !== "ready_to_bill" || !c.created_at) return false;
      return new Date(c.created_at).getTime() > since;
    }).length;
  }, [claims, lastSeen]);

  if (newCount === 0) return null;

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
      <span className="flex items-center gap-2 text-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span>
          <span className="font-semibold">{newCount}</span> new claim{newCount === 1 ? "" : "s"} just arrived from PCR submission.
        </span>
      </span>
      <button
        onClick={() => {
          const now = new Date().toISOString();
          try { localStorage.setItem(SEEN_KEY, now); } catch { /* ignore */ }
          setLastSeen(now);
        }}
        className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
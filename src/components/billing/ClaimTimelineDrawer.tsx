import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Circle,
  History,
  Send,
  FileCheck2,
  DollarSign,
  ClipboardList,
  Activity,
  Filter,
} from "lucide-react";
import {
  useClaimTimeline,
  type TimelineEvent,
  type TimelineStage,
  type TimelineSeverity,
} from "@/hooks/useClaimTimeline";

const STAGE_META: Record<TimelineStage, { label: string; icon: typeof Send }> = {
  submission: { label: "Submission", icon: Send },
  acknowledgment: { label: "Acknowledgment", icon: FileCheck2 },
  payment: { label: "Payment", icon: DollarSign },
  ar: { label: "AR", icon: ClipboardList },
  status: { label: "Status", icon: Activity },
  internal: { label: "Internal", icon: History },
};

function severityIcon(sev: TimelineSeverity) {
  const cls = "h-4 w-4";
  switch (sev) {
    case "success":
      return <CheckCircle2 className={`${cls} text-[hsl(var(--status-green))]`} />;
    case "danger":
      return <XCircle className={`${cls} text-destructive`} />;
    case "warning":
      return <AlertTriangle className={`${cls} text-[hsl(var(--status-yellow))]`} />;
    case "info":
      return <Info className={`${cls} text-primary`} />;
    default:
      return <Circle className={`${cls} text-muted-foreground`} />;
  }
}

function severityBorder(sev: TimelineSeverity) {
  switch (sev) {
    case "success":
      return "border-l-[hsl(var(--status-green))]";
    case "danger":
      return "border-l-destructive";
    case "warning":
      return "border-l-[hsl(var(--status-yellow))]";
    case "info":
      return "border-l-primary";
    default:
      return "border-l-muted-foreground/40";
  }
}

/**
 * Open a claim timeline drawer by setting `?claim=<id>` on the URL.
 * Mount <ClaimTimelineDrawer /> once on the parent page.
 */
export function openClaimTimeline(
  setParams: (
    next: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams),
    opts?: { replace?: boolean }
  ) => void,
  claimId: string,
) {
  setParams(
    (prev) => {
      const next = new URLSearchParams(prev);
      next.set("claim", claimId);
      return next;
    },
    { replace: false },
  );
}

export function ClaimTimelineDrawer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const claimId = searchParams.get("claim");
  const [showInternal, setShowInternal] = useState(false);

  const { loading, events, error, claim } = useClaimTimeline(claimId);

  const visible = useMemo(
    () => (showInternal ? events : events.filter((e) => !e.internal)),
    [events, showInternal],
  );

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of visible) counts[e.stage] = (counts[e.stage] ?? 0) + 1;
    return counts;
  }, [visible]);

  const close = (open: boolean) => {
    if (open) return;
    const next = new URLSearchParams(searchParams);
    next.delete("claim");
    setSearchParams(next, { replace: true });
  };

  return (
    <Sheet open={!!claimId} onOpenChange={close}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col p-0">
        <SheetHeader className="p-4 pb-3 border-b">
          <SheetTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Claim timeline
          </SheetTitle>
          <SheetDescription className="text-xs">
            {claim
              ? `${claim.payer_name ?? claim.payer_type ?? "—"} · DOS ${claim.run_date} · status ${claim.status}`
              : "Loading…"}
          </SheetDescription>
          <div className="flex items-center justify-between pt-2">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(STAGE_META) as TimelineStage[])
                .filter((s) => stageCounts[s])
                .map((s) => {
                  const Meta = STAGE_META[s];
                  const Icon = Meta.icon;
                  return (
                    <Badge key={s} variant="outline" className="text-[10px] gap-1">
                      <Icon className="h-3 w-3" />
                      {Meta.label} {stageCounts[s]}
                    </Badge>
                  );
                })}
            </div>
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Filter className="h-3 w-3" />
              Internal
              <Switch checked={showInternal} onCheckedChange={setShowInternal} />
            </label>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {loading && (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            )}
            {!loading && error && (
              <div className="text-sm text-destructive">Error loading timeline: {error}</div>
            )}
            {!loading && !error && visible.length === 0 && (
              <div className="text-sm text-muted-foreground py-8 text-center">
                No events recorded for this claim yet.
              </div>
            )}
            {!loading &&
              visible.map((e) => <TimelineRow key={e.id} event={e} />)}
          </div>
        </ScrollArea>

        <div className="border-t p-3 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => close(false)}>
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TimelineRow({ event }: { event: TimelineEvent }) {
  const Meta = STAGE_META[event.stage];
  const Icon = Meta.icon;
  return (
    <div
      className={`rounded-md border bg-card pl-3 pr-3 py-2 border-l-4 ${severityBorder(event.severity)}`}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5">{severityIcon(event.severity)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{event.title}</span>
            <Badge variant="outline" className="text-[10px] gap-1">
              <Icon className="h-3 w-3" />
              {Meta.label}
            </Badge>
            {event.internal && (
              <Badge variant="outline" className="text-[10px]">
                internal
              </Badge>
            )}
          </div>
          {event.detail && (
            <p className="text-xs text-muted-foreground mt-0.5 break-words">{event.detail}</p>
          )}
          {event.footnotes?.map((f, i) => (
            <p key={i} className="text-[11px] text-muted-foreground mt-1 italic">
              ↳ {f}
            </p>
          ))}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
            <span>
              {new Date(event.at).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {event.actor && <span className="truncate">· {event.actor}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Small inline trigger that opens the timeline drawer for the given claim.
 * Variants: "icon" (compact icon button) or "button" (icon + label).
 */
export function TimelineTrigger({
  claimId,
  variant = "icon",
  className,
}: {
  claimId: string | null | undefined;
  variant?: "icon" | "button";
  className?: string;
}) {
  const [, setSearchParams] = useSearchParams();
  if (!claimId) return null;

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    openClaimTimeline(setSearchParams, claimId);
  };

  if (variant === "icon") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={`h-7 w-7 ${className ?? ""}`}
        onClick={onClick}
        title="View claim timeline"
      >
        <History className="h-3.5 w-3.5" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={`h-7 text-[11px] px-2 gap-1 ${className ?? ""}`}
      onClick={onClick}
    >
      <History className="h-3 w-3" />
      Timeline
    </Button>
  );
}
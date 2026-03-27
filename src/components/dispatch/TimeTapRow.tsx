import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TimeTapRowProps {
  dispatch_time?: string | null;
  arrived_pickup_at?: string | null;
  at_scene_time?: string | null;
  left_scene_time?: string | null;
  arrived_dropoff_at?: string | null;
  in_service_time?: string | null;
}

function formatTime(ts: string | null | undefined): string | null {
  if (!ts) return null;
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return null;
  }
}

const TAPS = [
  { key: "dispatch_time", label: "Dispatched" },
  { key: "arrived_pickup_at", label: "En Route" },
  { key: "at_scene_time", label: "On Scene" },
  { key: "left_scene_time", label: "Transporting" },
  { key: "arrived_dropoff_at", label: "At Dest" },
  { key: "in_service_time", label: "In Service" },
] as const;

export function TimeTapRow(props: TimeTapRowProps) {
  const anyTap = TAPS.some((t) => props[t.key]);
  if (!anyTap) return null;

  return (
    <div className="flex items-start gap-1 mt-1.5">
      {TAPS.map((tap) => {
        const value = props[tap.key];
        const done = !!value;
        const time = formatTime(value);
        return (
          <TooltipProvider key={tap.key}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center min-w-[2rem]">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      done
                        ? "bg-[hsl(var(--status-green))]"
                        : "bg-muted-foreground/30"
                    }`}
                  />
                  {time && (
                    <span className="text-[8px] leading-tight text-muted-foreground mt-0.5 font-mono">
                      {time}
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {tap.label}
                {time ? ` · ${time}` : " · Pending"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}

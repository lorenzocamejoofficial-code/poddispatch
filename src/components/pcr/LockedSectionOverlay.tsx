import { Lock } from "lucide-react";

interface LockedSectionOverlayProps {
  reason: string;
}

export function LockedSectionOverlay({ reason }: LockedSectionOverlayProps) {
  return (
    <div className="relative rounded-lg border-2 border-muted bg-muted/30 p-6 pointer-events-none select-none">
      <div className="flex flex-col items-center justify-center gap-2 text-center py-4">
        <Lock className="h-6 w-6 text-muted-foreground/50" />
        <p className="text-sm font-medium text-muted-foreground/70">Section Locked</p>
        <p className="text-xs text-muted-foreground/50 max-w-[240px]">{reason}</p>
      </div>
    </div>
  );
}

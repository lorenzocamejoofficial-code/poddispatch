import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotificationFeed, type NotificationMode } from "@/hooks/useNotificationFeed";
import { NotificationPanel } from "./NotificationPanel";
import { cn } from "@/lib/utils";

interface Props {
  mode?: NotificationMode;
  className?: string;
}

export function NotificationBell({ mode = "admin", className }: Props) {
  const [open, setOpen] = useState(false);
  const feed = useNotificationFeed(mode);
  const showDot = feed.unreadCount > 0;
  const actionPing = feed.actionRequired.some((a) => !a.read);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Notifications${showDot ? ` — ${feed.unreadCount} unread` : ""}`}
        className={cn("relative", className)}
        onClick={() => setOpen(true)}
      >
        <Bell className="h-5 w-5" />
        {showDot && (
          <span
            className={cn(
              "absolute top-1.5 right-1.5 inline-flex h-2 w-2 rounded-full",
              actionPing ? "bg-destructive animate-pulse" : "bg-primary"
            )}
          />
        )}
      </Button>
      <NotificationPanel open={open} onOpenChange={setOpen} feed={feed} mode={mode} />
    </>
  );
}
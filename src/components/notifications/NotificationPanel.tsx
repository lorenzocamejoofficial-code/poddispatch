import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCheck,
  Inbox,
  MoreHorizontal,
  Megaphone,
  CircleDot,
} from "lucide-react";
import type {
  NotificationItem,
  NotificationMode,
} from "@/hooks/useNotificationFeed";

interface Feed {
  items: NotificationItem[];
  actionRequired: NotificationItem[];
  fyi: NotificationItem[];
  system: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  digestMode: boolean;
  markRead: (item: NotificationItem) => Promise<void>;
  markAllRead: () => Promise<void>;
  snooze: (item: NotificationItem, hours: number) => Promise<void>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feed: Feed;
  mode: NotificationMode;
}

function relativeTime(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

function Row({
  item,
  onClick,
  onSnooze,
  onMarkRead,
}: {
  item: NotificationItem;
  onClick: (item: NotificationItem) => void;
  onSnooze: (item: NotificationItem, hours: number) => void;
  onMarkRead: (item: NotificationItem) => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-md border p-3 transition-colors cursor-pointer hover:bg-muted/40",
        item.read ? "opacity-60" : "border-border bg-card",
        item.tier === "action" && !item.read && "border-destructive/40 bg-destructive/5"
      )}
      onClick={() => onClick(item)}
    >
      <div className="mt-0.5">
        {item.tier === "action" ? (
          <AlertTriangle className="h-4 w-4 text-destructive" />
        ) : item.tier === "system" ? (
          <Megaphone className="h-4 w-4 text-primary" />
        ) : (
          <CircleDot className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{item.title}</p>
          {!item.read && (
            <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" aria-label="unread" />
          )}
        </div>
        {item.body && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.body}</p>
        )}
        <p className="text-[10px] text-muted-foreground/70 mt-1">{relativeTime(item.created_at)}</p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          {!item.read && (
            <DropdownMenuItem onClick={() => onMarkRead(item)}>Mark as read</DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onSnooze(item, 4)}>Snooze 4 hours</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSnooze(item, 24)}>Snooze 1 day</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSnooze(item, 24 * 7)}>Snooze 1 week</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function Section({
  title,
  items,
  emptyHint,
  onClickItem,
  onSnooze,
  onMarkRead,
}: {
  title: string;
  items: NotificationItem[];
  emptyHint?: string;
  onClickItem: (item: NotificationItem) => void;
  onSnooze: (item: NotificationItem, hours: number) => void;
  onMarkRead: (item: NotificationItem) => void;
}) {
  if (items.length === 0 && !emptyHint) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <span className="text-[10px] text-muted-foreground">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="px-2 py-3 text-xs text-muted-foreground italic">{emptyHint}</p>
      ) : (
        items.map((it) => (
          <Row
            key={it.id}
            item={it}
            onClick={onClickItem}
            onSnooze={onSnooze}
            onMarkRead={onMarkRead}
          />
        ))
      )}
    </div>
  );
}

export function NotificationPanel({ open, onOpenChange, feed, mode }: Props) {
  const navigate = useNavigate();

  const handleClick = async (item: NotificationItem) => {
    if (!item.read) await feed.markRead(item);
    if (item.link) {
      onOpenChange(false);
      navigate(item.link);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader className="space-y-1">
          <SheetTitle className="flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            Notifications
            {feed.unreadCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px]">
                {feed.unreadCount} unread
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {mode === "creator"
              ? "System-wide activity across all tenants."
              : feed.digestMode
              ? "Digest mode is on — only action items show here. FYI bundles into your morning summary."
              : "Everything happening across your operation, grouped by priority."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center justify-between border-b pb-2 pt-2">
          <p className="text-[11px] text-muted-foreground">
            Per-user read state — marking does not affect teammates.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            disabled={feed.unreadCount === 0}
            onClick={feed.markAllRead}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </Button>
        </div>

        <ScrollArea className="flex-1 -mx-2 px-2">
          {feed.loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
          ) : feed.items.length === 0 ? (
            <div className="py-10 text-center">
              <Inbox className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">You're all caught up.</p>
            </div>
          ) : (
            <div className="space-y-5 pb-4">
              <Section
                title="Action Required"
                items={feed.actionRequired}
                onClickItem={handleClick}
                onSnooze={feed.snooze}
                onMarkRead={feed.markRead}
              />
              <Section
                title="FYI"
                items={feed.fyi}
                onClickItem={handleClick}
                onSnooze={feed.snooze}
                onMarkRead={feed.markRead}
              />
              <Section
                title="System"
                items={feed.system}
                onClickItem={handleClick}
                onSnooze={feed.snooze}
                onMarkRead={feed.markRead}
              />
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
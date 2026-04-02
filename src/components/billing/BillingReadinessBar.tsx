import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

interface BillingReadinessBarProps {
  readyCount: number;
  blockedCount: number;
  reviewCount: number;
  activeFilter: string | null;
  onFilter: (filter: string | null) => void;
}

export function BillingReadinessBar({
  readyCount,
  blockedCount,
  reviewCount,
  activeFilter,
  onFilter,
}: BillingReadinessBarProps) {
  const total = readyCount + blockedCount + reviewCount;
  if (total === 0) return null;

  const items = [
    {
      key: "ready",
      label: "Ready to Bill",
      count: readyCount,
      icon: CheckCircle,
      activeClass: "border-[hsl(var(--status-green))] bg-[hsl(var(--status-green))]/10 text-[hsl(var(--status-green))]",
      inactiveClass: "border-border hover:border-[hsl(var(--status-green))]/50 text-[hsl(var(--status-green))]",
    },
    {
      key: "blocked",
      label: "Blocked",
      count: blockedCount,
      icon: XCircle,
      activeClass: "border-destructive bg-destructive/10 text-destructive",
      inactiveClass: "border-border hover:border-destructive/50 text-destructive",
    },
    {
      key: "review",
      label: "In Review",
      count: reviewCount,
      icon: AlertTriangle,
      activeClass: "border-[hsl(var(--status-yellow))] bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]",
      inactiveClass: "border-border hover:border-[hsl(var(--status-yellow))]/50 text-[hsl(var(--status-yellow))]",
    },
  ];

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card p-2">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2">
        Queue Health
      </span>
      {items.map(({ key, label, count, icon: Icon, activeClass, inactiveClass }) => (
        <button
          key={key}
          onClick={() => onFilter(activeFilter === key ? null : key)}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            activeFilter === key ? activeClass : inactiveClass
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="text-lg font-bold">{count}</span>
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
      {activeFilter && (
        <button
          onClick={() => onFilter(null)}
          className="text-[10px] text-muted-foreground hover:text-foreground underline px-1"
        >
          Clear
        </button>
      )}
    </div>
  );
}

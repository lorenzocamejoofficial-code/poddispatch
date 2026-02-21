import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, ChevronDown } from "lucide-react";

export type ViewAsRole = "creator" | "owner" | "dispatcher" | "biller" | "crew";

const VIEW_OPTIONS: { value: ViewAsRole; label: string; desc: string }[] = [
  { value: "creator", label: "Creator Dashboard", desc: "System-level view (default)" },
  { value: "owner", label: "Company Owner", desc: "Full admin access — synthetic data" },
  { value: "dispatcher", label: "Dispatcher", desc: "Dispatch + scheduling view" },
  { value: "biller", label: "Biller", desc: "Billing & claims view" },
  { value: "crew", label: "Crew (Read-Only)", desc: "Mobile crew preview" },
];

interface ViewAsSwitcherProps {
  current: ViewAsRole;
  onChange: (role: ViewAsRole) => void;
}

export function ViewAsSwitcher({ current, onChange }: ViewAsSwitcherProps) {
  const currentOption = VIEW_OPTIONS.find((o) => o.value === current);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-xs">
          <Eye className="h-3.5 w-3.5" />
          View: {currentOption?.label}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs">View Mode</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {VIEW_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="flex flex-col items-start gap-0.5"
          >
            <div className="flex items-center gap-2 w-full">
              <span className="font-medium text-sm">{opt.label}</span>
              {opt.value === current && (
                <Badge variant="secondary" className="ml-auto text-[9px]">Active</Badge>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground">{opt.desc}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-[10px] text-muted-foreground">
          ⚠️ Simulated views use synthetic data only — no real PHI.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

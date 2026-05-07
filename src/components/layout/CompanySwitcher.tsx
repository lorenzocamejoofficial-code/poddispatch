import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Building2, Check, ChevronsUpDown } from "lucide-react";

/**
 * Sidebar tenant switcher. Only renders for users with 2+ company memberships.
 * Picking a company calls switchCompany() which persists
 * profiles.active_company_id and hard-reloads to wipe tenant-scoped state.
 */
export function CompanySwitcher() {
  const { memberships, activeCompanyId, switchCompany } = useAuth();

  if (memberships.length <= 1) return null;

  const active = memberships.find((m) => m.company_id === activeCompanyId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <span className="flex items-center gap-2 truncate">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-sidebar-primary" />
            <span className="truncate text-xs font-medium">
              {active?.company_name ?? "Select company"}
            </span>
          </span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-xs">Switch company</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.company_id}
            onClick={() => {
              if (m.company_id !== activeCompanyId) {
                void switchCompany(m.company_id);
              }
            }}
            className="flex items-center justify-between gap-2"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">{m.company_name}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {m.role}
              </span>
            </div>
            {m.company_id === activeCompanyId && (
              <Check className="h-3.5 w-3.5 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
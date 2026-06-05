import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, Settings2, BookOpen, Users, Settings, FlaskConical,
  Play, Building2, LifeBuoy, ShieldAlert, BarChart3,
} from "lucide-react";

interface Co { id: string; name: string; onboarding_status: string | null }

const NAV = [
  { label: "System Dashboard", href: "/system", icon: LayoutDashboard },
  { label: "Company Console", href: "/creator-console", icon: Settings2 },
  { label: "Ops Playbook", href: "/creator-playbook", icon: BookOpen },
  { label: "Crew UI Preview", href: "/crew-preview", icon: Users },
  { label: "Settings", href: "/creator-settings", icon: Settings },
  { label: "Simulation Lab", href: "/simulation-lab", icon: FlaskConical },
  { label: "Enter App Simulation", href: "/dispatch", icon: Play },
];

const JUMP = [
  { label: "SaaS Metrics", href: "/system?tab=metrics", icon: BarChart3 },
  { label: "Support Tickets", href: "/creator-console?tab=support", icon: LifeBuoy },
  { label: "Remittance Quarantine", href: "/creator-console?tab=quarantine", icon: ShieldAlert },
  { label: "Pending Companies", href: "/creator-console?tab=pending", icon: Building2 },
];

export function CreatorCommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Co[]>([]);

  useEffect(() => {
    if (!open || companies.length > 0) return;
    supabase
      .from("companies")
      .select("id, name, onboarding_status")
      .eq("creator_test_tenant", false)
      .eq("is_sandbox", false)
      .is("deleted_at", null)
      .order("name")
      .limit(200)
      .then(({ data }) => setCompanies(data ?? []));
  }, [open, companies.length]);

  const go = useCallback((href: string) => {
    onOpenChange(false);
    setTimeout(() => navigate(href), 50);
  }, [navigate, onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump to a page or company…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {NAV.map((item) => (
            <CommandItem key={item.href} onSelect={() => go(item.href)}>
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Jump To">
          {JUMP.map((item) => (
            <CommandItem key={item.href} onSelect={() => go(item.href)}>
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        {companies.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Companies">
              {companies.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`company ${c.name} ${c.id}`}
                  onSelect={() => go(`/creator-console/${c.id}`)}
                >
                  <Building2 className="h-4 w-4" />
                  <span className="flex-1 truncate">{c.name}</span>
                  {c.onboarding_status && (
                    <span className="text-[10px] text-muted-foreground capitalize">
                      {c.onboarding_status.replace(/_/g, " ")}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
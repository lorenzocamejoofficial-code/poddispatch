import { usePreviewRole, type PreviewRole } from "@/hooks/usePreviewRole";
import { useSandboxMode } from "@/hooks/useSandboxMode";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Eye, ChevronDown, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate, useLocation } from "react-router-dom";

const ROLE_OPTIONS: { value: PreviewRole; label: string; desc: string }[] = [
  { value: "creator", label: "Creator", desc: "System-level view (default)" },
  { value: "owner", label: "Owner / Admin", desc: "Full admin access — synthetic data" },
  { value: "dispatcher", label: "Dispatcher", desc: "Dispatch + scheduling view" },
  { value: "biller", label: "Biller", desc: "Billing & claims view" },
  { value: "crew", label: "Crew", desc: "Mobile crew preview (read-only)" },
];

export function PreviewRoleBar() {
  const { previewRole, setPreviewRole } = usePreviewRole();
  const { sandboxMode, setSandboxMode } = useSandboxMode();
  const navigate = useNavigate();
  const location = useLocation();
  const currentOption = ROLE_OPTIONS.find((o) => o.value === previewRole);

  const handleToggleSandbox = (on: boolean) => {
    setSandboxMode(on);
    if (on && !location.pathname.startsWith("/sandbox")) {
      navigate("/sandbox/dispatch");
    } else if (!on && location.pathname.startsWith("/sandbox")) {
      navigate("/system");
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Sandbox toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground hidden sm:inline">Sandbox</span>
            <Switch checked={sandboxMode} onCheckedChange={handleToggleSandbox} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-[200px]">
          Toggle sandbox mode to preview pages with synthetic data
        </TooltipContent>
      </Tooltip>

      {/* Sandbox badge */}
      {sandboxMode && (
        <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-[9px] gap-1 hidden md:inline-flex">
          <AlertTriangle className="h-2.5 w-2.5" />
          SANDBOX — Synthetic Data — No Real PHI
        </Badge>
      )}

      {/* Role switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
            <Eye className="h-3 w-3" />
            View: {currentOption?.label}
            <ChevronDown className="h-2.5 w-2.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-xs">Preview As Role</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {ROLE_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => setPreviewRole(opt.value)}
              className="flex flex-col items-start gap-0.5"
            >
              <div className="flex items-center gap-2 w-full">
                <span className="font-medium text-sm">{opt.label}</span>
                {opt.value === previewRole && (
                  <Badge variant="secondary" className="ml-auto text-[9px]">Active</Badge>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground">{opt.desc}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5 text-[10px] text-muted-foreground space-y-0.5">
            <p>⚠️ This is a <strong>UI preview</strong> using synthetic data only.</p>
            <p>No real PHI is accessible. RLS + tenant isolation unchanged.</p>
            <p>Intended for testing and debugging RBAC + UI composition.</p>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

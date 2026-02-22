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

// Human-readable permission labels per role
const ROLE_PERMISSIONS: Record<PreviewRole, string[]> = {
  creator: ["Full system access", "All modules", "All actions"],
  owner: ["All modules", "All actions", "Settings management", "Employee management"],
  dispatcher: ["View Scheduling Calendar", "Create/Assign Runs", "Manage Patients", "Manage Trucks", "View Trips", "View Facilities"],
  biller: ["View Completed Trips", "Submit Claims", "Edit Claims", "Manage Compliance", "View Facilities"],
  crew: ["View Assigned Run Sheet", "Update Run Status", "Submit Documentation"],
};

export function PreviewRoleBar() {
  const { previewRole, setPreviewRole, isPreviewActive } = usePreviewRole();
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
    <div className="flex items-center gap-3">
      {/* Sandbox toggle */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground hidden sm:inline">Sandbox</span>
        <Switch checked={sandboxMode} onCheckedChange={handleToggleSandbox} />
      </div>

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
        <DropdownMenuContent align="end" className="w-72">
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
          {/* Permission summary */}
          <div className="px-2 py-2 space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Permissions: {currentOption?.label}
            </p>
            <div className="flex flex-wrap gap-1">
              {ROLE_PERMISSIONS[previewRole].map((perm) => (
                <Badge key={perm} variant="outline" className="text-[9px] font-normal">
                  {perm}
                </Badge>
              ))}
            </div>
          </div>
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5 text-[10px] text-muted-foreground">
            ⚠️ UI preview only — synthetic data, no real PHI. RLS unchanged.
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

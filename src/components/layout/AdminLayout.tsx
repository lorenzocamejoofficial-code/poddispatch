import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSidebarBadges, getBadgeForPath } from "@/hooks/useSidebarBadges";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Truck,
  ClipboardList,
  Settings,
  LogOut,
  Menu,
  X,
  Send,
  FileText,
  DollarSign,
  ShieldCheck,
  Building2,
  BarChart3,
  ArrowRightLeft,
  FlaskConical,
  AlertTriangle,
  Eye,
  FileOutput,
  Mail,
  Home,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageTour } from "@/components/tour/PageTour";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ContextualHelpPanel } from "@/components/help/ContextualHelpPanel";
import { useCompanyName } from "@/hooks/useCompanyName";
import { BugReportDialog } from "@/components/BugReportDialog";
import { CompanySwitcher } from "@/components/layout/CompanySwitcher";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User as UserIcon, HelpCircle, Bug } from "lucide-react";

/**
 * Single consistent sign-out routine used by both the sidebar and the
 * top-right account menu. Clears local storage so per-user UI state
 * (sidebar collapse, last-selected date, etc.) doesn't leak between
 * accounts on a shared device.
 */
async function performSignOut(
  signOut: () => Promise<void>,
  navigate: (to: string) => void,
) {
  try { await signOut(); } finally {
    try { localStorage.clear(); } catch {}
    navigate("/login");
  }
}

interface NavItem {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: string[]; // which roles can see this nav item
}

interface NavSection {
  id: string;
  label: string | null; // null = no header (Home)
  items: NavItem[];
}

// Grouped sidebar sections. Item-level `roles` continues to drive visibility
// using the same pattern used elsewhere in the app. Sections render only if
// at least one item is visible for the current role.
const navSections: NavSection[] = [
  {
    id: "dispatch",
    label: "Dispatch",
    items: [
      { path: "/dispatch", label: "Dispatch Command", icon: LayoutDashboard, roles: ["owner", "manager", "dispatcher"] },
      { path: "/scheduling", label: "Patient Runs / Scheduling", icon: ClipboardList, roles: ["owner", "manager", "dispatcher"] },
      { path: "/crew-schedule", label: "Crew Schedule Delivery", icon: Send, roles: ["owner", "manager", "dispatcher"] },
      { path: "/trucks", label: "Trucks & Crews", icon: Truck, roles: ["owner", "manager", "dispatcher"] },
      { path: "/override-monitor", label: "Override Monitor", icon: Eye, roles: ["owner"] },
    ],
  },
  {
    id: "clinical",
    label: "Clinical",
    items: [
      { path: "/trips", label: "Trips & Clinical", icon: FileText, roles: ["owner", "manager", "billing"] },
      { path: "/compliance", label: "Compliance & QA", icon: ShieldCheck, roles: ["owner", "manager", "billing"] },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    items: [
      { path: "/billing", label: "Billing & Claims", icon: DollarSign, roles: ["owner", "manager", "billing"] },
      { path: "/reports", label: "Reports & Metrics", icon: BarChart3, roles: ["owner", "manager", "billing"] },
    ],
  },
  {
    id: "company",
    label: "Company",
    items: [
      { path: "/patients", label: "Patients", icon: Users, roles: ["owner", "manager", "dispatcher", "billing"] },
      { path: "/facilities", label: "Facilities", icon: Building2, roles: ["owner", "manager", "dispatcher"] },
      { path: "/employees", label: "Employees", icon: UserPlus, roles: ["owner", "manager"] },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      { path: "/settings", label: "Company Settings", icon: Settings, roles: ["owner", "manager", "dispatcher"] },
      { path: "/migration", label: "Migration & Onboarding", icon: ArrowRightLeft, roles: ["owner", "manager"] },
      { path: "/admin/email-activity", label: "Email Activity", icon: Mail, roles: ["owner"] },
      { path: "/legal", label: "Legal & Compliance", icon: ShieldCheck, roles: ["owner", "manager", "dispatcher", "billing"] },
    ],
  },
];

// Role-adaptive Home landing path.
function homePathForRole(role: string | null | undefined): string {
  switch (role) {
    case "dispatcher":
      return "/dispatch";
    case "billing":
    case "biller":
      return "/billing";
    case "owner":
    case "manager":
    default:
      return "/owner-dashboard";
  }
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, signOut, role, isSystemCreator } = useAuth();
  const badgeCounts = useSidebarBadges(role);
  const location = useLocation();
  const navigate = useNavigate();
  const { companyName } = useCompanyName();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [bugOpen, setBugOpen] = useState(false);

  // System creator gets full access to all nav items
  // Regular users need owner, dispatcher, or billing role
  // Map biller → billing for nav matching
  const effectiveNavRole = role === "biller" ? "billing" : role;
  if (!isSystemCreator && (!effectiveNavRole || !["owner", "manager", "dispatcher", "billing"].includes(effectiveNavRole))) {
    return null;
  }

  // Filter sections/items by role. Creator sees every item.
  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: isSystemCreator
        ? section.items
        : section.items.filter((it) => effectiveNavRole && it.roles.includes(effectiveNavRole)),
    }))
    .filter((section) => section.items.length > 0);

  const homePath = homePathForRole(effectiveNavRole);

  // Persisted per-section collapse state. Default: all open.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem("sidebar_section_state");
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  });
  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = { ...prev, [id]: prev[id] === false ? true : false };
      try { localStorage.setItem("sidebar_section_state", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // Flat list of all visible items (for header title lookup).
  const allVisibleItems = visibleSections.flatMap((s) => s.items);

  const renderItem = (item: NavItem) => {
    const active = location.pathname === item.path;
    const badgeCount = getBadgeForPath(item.path, badgeCounts);
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={() => setSidebarOpen(false)}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-primary"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        )}
      >
        <item.icon className="h-4 w-4" />
        <span className="flex-1">{item.label}</span>
        {badgeCount > 0 && (
          <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
      </Link>
    );
  };

  // Settings always renders at the bottom, separated.
  const mainSections = visibleSections.filter((s) => s.id !== "settings");
  const settingsSection = visibleSections.find((s) => s.id === "settings");

  const homeActive = location.pathname === homePath || location.pathname === "/";

  return (
    <div className="flex h-screen overflow-hidden bg-dispatch-surface">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <Truck className="h-5 w-5 text-sidebar-primary" />
          <span className="font-bold text-sidebar-primary">{companyName}</span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto text-sidebar-foreground lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {/* Multi-membership users: tenant switcher renders just below brand;
            self-hides for single-membership users. */}
        <CompanySwitcher />

        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {/* System Creator: back to control tower */}
          {isSystemCreator && (
            <>
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                Creator
              </p>
              <Link
                to="/system"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
              >
                <ShieldCheck className="h-4 w-4" />
                ← System Dashboard
              </Link>
              <Link
                to="/simulation-lab"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors mb-2"
              >
                <FlaskConical className="h-4 w-4" />
                Simulation Lab
              </Link>
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                App Simulation
              </p>
            </>
          )}

          {/* Home — role-adaptive landing */}
          <Link
            to={homePath}
            onClick={() => setSidebarOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors mb-2",
              homeActive
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <Home className="h-4 w-4" />
            <span className="flex-1">Home</span>
          </Link>

          {mainSections.map((section) => {
            const isOpen = openSections[section.id] !== false; // default open
            const hasActive = section.items.some((it) => location.pathname === it.path);
            return (
              <Collapsible key={section.id} open={isOpen || hasActive} onOpenChange={() => toggleSection(section.id)}>
                <CollapsibleTrigger className="flex w-full items-center gap-1 px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 hover:text-sidebar-foreground/70 transition-colors">
                  <ChevronDown className={cn("h-3 w-3 transition-transform", !(isOpen || hasActive) && "-rotate-90")} />
                  <span>{section.label}</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1">
                  {section.items.map(renderItem)}
                </CollapsibleContent>
              </Collapsible>
            );
          })}

          {settingsSection && (
            <>
              <div className="my-3 border-t border-sidebar-border" />
              {(() => {
                const isOpen = openSections[settingsSection.id] !== false;
                const hasActive = settingsSection.items.some((it) => location.pathname === it.path);
                return (
                  <Collapsible open={isOpen || hasActive} onOpenChange={() => toggleSection(settingsSection.id)}>
                    <CollapsibleTrigger className="flex w-full items-center gap-1 px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 hover:text-sidebar-foreground/70 transition-colors">
                      <ChevronDown className={cn("h-3 w-3 transition-transform", !(isOpen || hasActive) && "-rotate-90")} />
                      <span>{settingsSection.label}</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-1">
                      {settingsSection.items.map(renderItem)}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })()}
            </>
          )}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="mb-1 px-3 flex items-center gap-2">
            <span className="text-xs text-sidebar-foreground/50 truncate flex-1">
              {user?.email}
            </span>
            <span className="rounded bg-sidebar-accent px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sidebar-primary">
              {role}
            </span>
          </div>
          <button
            onClick={() => performSignOut(signOut, navigate)}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
          <a
            href="/legal"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-xs font-medium text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Legal & Compliance
          </a>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Simulation Mode Banner — creator only */}
        {isSystemCreator && (
          <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-xs font-bold text-black">
            <AlertTriangle className="h-3.5 w-3.5" />
            SIMULATION MODE — Sandbox Company · No real PHI
            <AlertTriangle className="h-3.5 w-3.5" />
          </div>
        )}
        <header className="flex h-14 items-center gap-3 border-b bg-card px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold text-foreground flex-1">
            {allVisibleItems.find((i) => i.path === location.pathname)?.label ?? "PodDispatch"}
          </h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <UserIcon className="h-4 w-4" />
                <span className="hidden sm:inline max-w-[160px] truncate">
                  {user?.email ?? "Account"}
                </span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground truncate">
                {user?.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/account")}>
                <UserIcon className="h-4 w-4 mr-2" />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setHelpOpen(true)}>
                <HelpCircle className="h-4 w-4 mr-2" />
                Help
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBugOpen(true)}>
                <Bug className="h-4 w-4 mr-2" />
                Bug Report
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => performSignOut(signOut, navigate)}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Bug report dialog — controlled by account menu */}
          <BugReportDialog
            currentPath={location.pathname}
            userId={user?.id}
            open={bugOpen}
            onOpenChange={setBugOpen}
          />
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
        <ContextualHelpPanel
          routeKey={
            // Disambiguate routes that exist in both AdminLayout (admin-side)
            // and CrewLayout (crew-side) so the help content matches the
            // surface the user is actually looking at.
            location.pathname === "/crew-schedule"
              ? "/crew-schedule-admin"
              : location.pathname
          }
          open={helpOpen}
          onOpenChange={setHelpOpen}
        />
        <PageTour />
      </div>
    </div>
  );
}

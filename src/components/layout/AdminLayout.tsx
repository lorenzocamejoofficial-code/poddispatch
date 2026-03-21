import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSidebarBadges, getBadgeForPath } from "@/hooks/useSidebarBadges";
import { supabase } from "@/integrations/supabase/client";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { HelpButton } from "@/components/help/HelpButton";

interface NavItem {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: string[]; // which roles can see this nav item
}

const navItems: NavItem[] = [
  { path: "/", label: "Dispatch Command", icon: LayoutDashboard, roles: ["admin", "dispatcher"] },
  { path: "/scheduling", label: "Patient Runs / Scheduling", icon: ClipboardList, roles: ["admin", "dispatcher"] },
  { path: "/crew-schedule", label: "Crew Schedule Delivery", icon: Send, roles: ["admin", "dispatcher"] },
  { path: "/patients", label: "Patients", icon: Users, roles: ["admin", "dispatcher", "billing"] },
  { path: "/trips", label: "Trips & Clinical", icon: FileText, roles: ["admin", "billing"] },
  { path: "/billing", label: "Billing & Claims", icon: DollarSign, roles: ["admin", "billing"] },
  { path: "/compliance", label: "Compliance & QA", icon: ShieldCheck, roles: ["admin", "billing"] },
  { path: "/facilities", label: "Facilities", icon: Building2, roles: ["admin", "dispatcher", "billing"] },
  { path: "/reports", label: "Reports & Metrics", icon: BarChart3, roles: ["admin", "billing"] },
  { path: "/employees", label: "Employees", icon: UserPlus, roles: ["admin", "dispatcher"] },
  { path: "/trucks", label: "Trucks & Crews", icon: Truck, roles: ["admin", "dispatcher"] },
  { path: "/migration", label: "Migration & Onboarding", icon: ArrowRightLeft, roles: ["admin", "dispatcher"] },
  { path: "/override-monitor", label: "Override Monitor", icon: Eye, roles: ["admin"] },
  { path: "/settings", label: "Settings", icon: Settings, roles: ["admin", "dispatcher"] },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, signOut, role, isSystemCreator } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("PodDispatch");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    supabase
      .from("company_settings")
      .select("company_name")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.company_name) setCompanyName(data.company_name);
      });
  }, []);

  // System creator gets full access to all nav items
  // Regular users need admin, dispatcher, or billing role
  // Map actual DB roles to nav role categories
  const effectiveNavRole = role === "owner" ? "admin" : role === "biller" ? "billing" : role;
  if (!isSystemCreator && (!effectiveNavRole || !["admin", "dispatcher", "billing"].includes(effectiveNavRole))) {
    return null;
  }

  // System creator sees everything; regular users see role-filtered nav
  // For creators, remap "/" to "/simulation" since "/" redirects to /system
  const visibleNav = isSystemCreator
    ? navItems.map(item => item.path === "/" ? { ...item, path: "/simulation" } : item)
    : navItems.filter(item => effectiveNavRole && item.roles.includes(effectiveNavRole));

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
          {visibleNav.map((item) => {
            const active = location.pathname === item.path;
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
                {item.label}
              </Link>
            );
          })}
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
            onClick={() => { signOut(); navigate("/login"); }}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
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
            {navItems.find((i) => i.path === location.pathname)?.label ?? "PodDispatch"}
          </h2>
          <HelpButton routeKey={location.pathname} />
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { signOut(); localStorage.clear(); navigate("/login"); }}
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

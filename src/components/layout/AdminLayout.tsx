import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  { path: "/patients", label: "Patients", icon: Users, roles: ["admin", "dispatcher"] },
  { path: "/trips", label: "Trips & Clinical", icon: FileText, roles: ["admin", "dispatcher", "billing"] },
  { path: "/billing", label: "Billing & Claims", icon: DollarSign, roles: ["admin", "billing"] },
  { path: "/compliance", label: "Compliance & QA", icon: ShieldCheck, roles: ["admin", "billing"] },
  { path: "/facilities", label: "Facilities", icon: Building2, roles: ["admin", "dispatcher", "billing"] },
  { path: "/reports", label: "Reports & Metrics", icon: BarChart3, roles: ["admin"] },
  { path: "/employees", label: "Employees", icon: UserPlus, roles: ["admin"] },
  { path: "/trucks", label: "Trucks & Crews", icon: Truck, roles: ["admin", "dispatcher"] },
  { path: "/migration", label: "Migration & Onboarding", icon: ArrowRightLeft, roles: ["admin"] },
  { path: "/simulation", label: "Company Simulation", icon: FlaskConical, roles: ["admin"] },
  { path: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, signOut, role } = useAuth();
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

  // Allow admin, dispatcher, and billing roles to use this layout
  if (!role || !["admin", "dispatcher", "billing"].includes(role)) {
    return null;
  }

  const visibleNav = navItems.filter(item => role && item.roles.includes(role));

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

        <nav className="flex-1 space-y-1 p-3">
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
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

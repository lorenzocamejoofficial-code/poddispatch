import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSandboxMode } from "@/hooks/useSandboxMode";
import { PreviewRoleBar } from "@/components/creator/PreviewRoleBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HelpButton } from "@/components/help/HelpButton";
import {
  LayoutDashboard, Users, Truck, ClipboardList, Settings, LogOut,
  Send, FileText, DollarSign, ShieldCheck, Building2, BarChart3,
  UserPlus, FlaskConical, AlertTriangle, Menu, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const sandboxNavItems = [
  { path: "/sandbox/dispatch", label: "Dispatch Command", icon: LayoutDashboard },
  { path: "/sandbox/scheduling", label: "Patient Runs / Scheduling", icon: ClipboardList },
  { path: "/sandbox/crew-schedule", label: "Crew Schedule Delivery", icon: Send },
  { path: "/sandbox/patients", label: "Patients", icon: Users },
  { path: "/sandbox/trips", label: "Trips & Clinical", icon: FileText },
  { path: "/sandbox/billing", label: "Billing & Claims", icon: DollarSign },
  { path: "/sandbox/compliance", label: "Compliance & QA", icon: ShieldCheck },
  { path: "/sandbox/facilities", label: "Facilities", icon: Building2 },
  { path: "/sandbox/reports", label: "Reports & Metrics", icon: BarChart3 },
  { path: "/sandbox/employees", label: "Employees", icon: UserPlus },
  { path: "/sandbox/trucks", label: "Trucks & Crews", icon: Truck },
  { path: "/sandbox/settings", label: "Settings", icon: Settings },
];

const creatorNavItems = [
  { path: "/system", label: "System Dashboard", icon: LayoutDashboard },
  { path: "/creator-console", label: "Company Console", icon: Settings },
  { path: "/simulation", label: "Company Simulation", icon: FlaskConical },
];

export function SandboxLayout({ children, pageLabel }: { children: ReactNode; pageLabel?: string }) {
  const { user, signOut } = useAuth();
  const { sandboxMode, setSandboxMode } = useSandboxMode();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    signOut();
    localStorage.clear();
    navigate("/login");
  };

  const handleToggleSandbox = (on: boolean) => {
    setSandboxMode(on);
    if (!on) navigate("/system");
  };

  const currentLabel = pageLabel ?? sandboxNavItems.find(i => i.path === location.pathname)?.label ?? "Sandbox";

  return (
    <div className="flex h-screen overflow-hidden bg-dispatch-surface">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <span className="font-bold text-sidebar-primary text-sm">SandboxCo</span>
          <Badge variant="outline" className="ml-auto text-[8px] border-amber-500/50 text-amber-600">SANDBOX</Badge>
          <Button variant="ghost" size="icon" className="ml-1 text-sidebar-foreground lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {/* Creator nav */}
          <p className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">Creator</p>
          {creatorNavItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}

          {/* Sandbox nav */}
          <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-600">Sandbox App</p>
          {sandboxNavItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-amber-500/10 text-amber-700" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
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
            <span className="text-xs text-sidebar-foreground/50 truncate flex-1">{user?.email}</span>
            <Badge className="text-[8px] bg-amber-500/20 text-amber-700 border-0">CREATOR</Badge>
          </div>
          <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Sandbox banner */}
        <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-xs font-bold text-black">
          <AlertTriangle className="h-3.5 w-3.5" />
          SANDBOX MODE — All data is synthetic. No real PHI.
          <AlertTriangle className="h-3.5 w-3.5" />
        </div>

        <header className="flex h-14 items-center gap-3 border-b bg-card px-4 lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold text-foreground flex-1">{currentLabel}</h2>

          {/* Sandbox toggle + View-as dropdown */}
          <PreviewRoleBar />

          <HelpButton routeKey={location.pathname} />

          <Button variant="ghost" size="sm" className="gap-2 text-xs text-muted-foreground hover:text-foreground" onClick={handleLogout}>
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </Button>

          <Badge variant="secondary" className="text-xs hidden md:inline-flex">No PHI</Badge>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

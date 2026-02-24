import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, ClipboardCheck, Settings2, Play,
  ShieldCheck, LogOut, Menu, X, Settings, FlaskConical,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface NavItem {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const creatorNavItems: NavItem[] = [
  { path: "/system", label: "System Dashboard", icon: LayoutDashboard },
  { path: "/pending-companies", label: "Pending Companies", icon: ClipboardCheck },
  { path: "/creator-console", label: "Company Console", icon: Settings2 },
  { path: "/creator-settings", label: "Settings", icon: Settings },
];

export function CreatorLayout({ children, title }: { children: ReactNode; title?: string }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    signOut();
    localStorage.clear();
    navigate("/login");
  };

  const resolvedTitle =
    title ?? creatorNavItems.find((i) => i.path === location.pathname)?.label ?? "System Creator";

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
          <ShieldCheck className="h-5 w-5 text-sidebar-primary" />
          <span className="font-bold text-sidebar-primary">PodDispatch</span>
          <Badge variant="outline" className="ml-auto text-[9px]">CREATOR</Badge>
          <Button
            variant="ghost"
            size="icon"
            className="ml-1 text-sidebar-foreground lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          {/* Creator Tools Section */}
          <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            Creator System
          </p>
          <div className="space-y-1 mb-4">
            {creatorNavItems.map((item) => {
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
          </div>

          {/* Simulation */}
          <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            Simulation
          </p>
          <Link
            to="/simulation"
            onClick={() => setSidebarOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              location.pathname === "/simulation"
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <Play className="h-4 w-4" />
            Enter App Simulation
          </Link>
          <Link
            to="/simulation-lab"
            onClick={() => setSidebarOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              location.pathname === "/simulation-lab"
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <FlaskConical className="h-4 w-4" />
            Simulation Lab
          </Link>
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="mb-1 px-3">
            <span className="text-xs text-sidebar-foreground/50 truncate">{user?.email}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
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
          <h2 className="text-base font-semibold text-foreground truncate flex-1">{resolvedTitle}</h2>
          <Badge variant="secondary" className="text-[10px] hidden md:inline-flex shrink-0">No PHI</Badge>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground shrink-0"
            onClick={handleLogout}
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

import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LayoutDashboard, FileText, LogOut, Menu, X, Truck, Users, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCompanyName } from "@/hooks/useCompanyName";
import { supabase } from "@/integrations/supabase/client";

const crewNav = [
  { path: "/crew-dashboard", label: "Crew Dashboard", icon: LayoutDashboard },
  { path: "/crew-patients", label: "Patients", icon: Users },
  { path: "/crew-schedule", label: "Schedule", icon: CalendarDays },
  { path: "/pcr", label: "PCR", icon: FileText },
];

export function CrewLayout({ children }: { children: ReactNode }) {
  const { user, signOut, profileId } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { companyName } = useCompanyName();
  const [hasKickback, setHasKickback] = useState(false);

  // Check for kicked_back PCRs assigned to this crew member
  useEffect(() => {
    if (!profileId) return;
    const today = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`; })();
    (async () => {
      const { data: crewRow } = await supabase
        .from("crews")
        .select("truck_id")
        .eq("active_date", today)
        .or(`member1_id.eq.${profileId},member2_id.eq.${profileId},member3_id.eq.${profileId}`)
        .maybeSingle();
      if (!crewRow) { setHasKickback(false); return; }

      const { data: trips } = await supabase
        .from("trip_records")
        .select("id")
        .eq("run_date", today)
        .eq("truck_id", crewRow.truck_id)
        .eq("pcr_status", "kicked_back")
        .limit(1);
      setHasKickback((trips ?? []).length > 0);
    })();
  }, [profileId]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <Truck className="h-5 w-5 text-sidebar-primary" />
          <span className="font-bold text-sidebar-primary">{companyName}</span>
          <Button variant="ghost" size="icon" className="ml-auto lg:hidden text-sidebar-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {crewNav.map((item) => {
            const active = location.pathname === item.path;
            const showBadge = item.path === "/pcr" && hasKickback;
            return (
              <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors relative",
                  active ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}>
                <item.icon className="h-4 w-4" />
                {item.label}
                {showBadge && (
                  <span className="ml-auto h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <p className="px-3 mb-2 text-xs text-sidebar-foreground/50 truncate">{user?.email}</p>
          <button onClick={() => { signOut(); navigate("/login"); }}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-3 border-b bg-card px-4">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold text-foreground flex-1">
            {crewNav.find(i => i.path === location.pathname)?.label ?? "Crew"}
          </h2>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { QuestionEngine } from "@/components/simulation/QuestionEngine";
import { SimulationResults } from "@/components/simulation/SimulationResults";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PreviewRoleBar } from "@/components/creator/PreviewRoleBar";
import { HelpButton } from "@/components/help/HelpButton";
import { FlaskConical, ShieldCheck, LogOut, LayoutDashboard, Settings2 } from "lucide-react";
import { runSimulation, type CompanyProfile, type SimulationResult } from "@/lib/simulation-engine";

const sidebarItems = [
  { path: "/system", label: "System Dashboard", icon: LayoutDashboard },
  { path: "/creator-console", label: "Company Console", icon: Settings2 },
  { path: "/simulation", label: "Company Simulation", icon: FlaskConical },
];

export default function CompanySimulation() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const handleComplete = (p: CompanyProfile) => {
    setProfile(p);
    setResult(runSimulation(p));
  };

  const handleReset = () => {
    setProfile(null);
    setResult(null);
  };

  const handleLogout = () => {
    signOut();
    localStorage.clear();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-dispatch-surface">
      {/* Sidebar — only 3 creator items, no sandbox app links */}
      <aside className="hidden lg:flex w-60 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <ShieldCheck className="h-5 w-5 text-sidebar-primary" />
          <span className="font-bold text-sidebar-primary">PodDispatch</span>
          <Badge variant="outline" className="ml-auto text-[9px]">CREATOR</Badge>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {sidebarItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
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

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-3 border-b bg-card px-4 lg:px-6">
          <h2 className="text-lg font-semibold text-foreground flex-1">Company Simulation</h2>
          <PreviewRoleBar />
          <HelpButton routeKey="/simulation" />
          <Button variant="ghost" size="sm" className="gap-2 text-xs text-muted-foreground hover:text-foreground" onClick={handleLogout}>
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
          <Badge variant="secondary" className="text-xs hidden md:inline-flex">No PHI</Badge>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <FlaskConical className="h-6 w-6 text-primary" />
                  Company Simulation Mode
                </h1>
                <p className="text-sm text-muted-foreground">
                  Stress-test PodDispatch against your real company operations before going live.
                </p>
              </div>
              <Badge variant="outline" className="ml-auto text-xs">Internal Testing</Badge>
            </div>

            {!result ? (
              <QuestionEngine onComplete={handleComplete} />
            ) : (
              <SimulationResults result={result} profile={profile!} onReset={handleReset} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

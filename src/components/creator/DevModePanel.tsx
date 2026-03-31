import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import {
  Route, Shield, Database, Flag, ChevronDown, ChevronRight,
} from "lucide-react";

const ROUTES = [
  { path: "/", label: "Dispatch Command", roles: ["owner", "dispatcher"] },
  { path: "/scheduling", label: "Patient Runs / Scheduling", roles: ["owner", "dispatcher"] },
  { path: "/crew-schedule", label: "Crew Schedule Delivery", roles: ["owner", "dispatcher"] },
  { path: "/patients", label: "Patients", roles: ["owner", "dispatcher"] },
  { path: "/trips", label: "Trips & Clinical", roles: ["owner", "dispatcher", "billing"] },
  { path: "/billing", label: "Billing & Claims", roles: ["owner", "billing"] },
  { path: "/compliance", label: "Compliance & QA", roles: ["owner", "billing"] },
  { path: "/facilities", label: "Facilities", roles: ["owner", "dispatcher", "billing"] },
  { path: "/reports", label: "Reports & Metrics", roles: ["owner"] },
  { path: "/employees", label: "Employees", roles: ["owner"] },
  { path: "/trucks", label: "Trucks & Crews", roles: ["owner", "dispatcher"] },
  { path: "/migration", label: "Migration & Onboarding", roles: ["owner"] },
  { path: "/simulation", label: "Company Simulation", roles: ["owner"] },
  { path: "/settings", label: "Settings", roles: ["owner"] },
  { path: "/system", label: "System Dashboard", roles: ["system_creator"] },
  { path: "/creator-console", label: "Company Console", roles: ["system_creator"] },
  { path: "/crew/:token", label: "Crew Run Sheet", roles: ["public"] },
];

const ROLES_MATRIX = [
  { role: "Owner", dispatch: true, scheduling: true, patients: true, trips: true, billing: true, compliance: true, facilities: true, reports: true, employees: true, trucks: true, settings: true },
  { role: "Dispatcher", dispatch: true, scheduling: true, patients: true, trips: true, billing: false, compliance: false, facilities: true, reports: false, employees: false, trucks: true, settings: false },
  { role: "Billing", dispatch: false, scheduling: false, patients: false, trips: true, billing: true, compliance: true, facilities: true, reports: false, employees: false, trucks: false, settings: false },
  { role: "Crew", dispatch: false, scheduling: false, patients: false, trips: false, billing: false, compliance: false, facilities: false, reports: false, employees: false, trucks: false, settings: false },
];

const DB_TABLES = [
  { name: "companies", desc: "Multi-tenant company records" },
  { name: "profiles", desc: "User profiles linked to auth" },
  { name: "user_roles", desc: "RBAC role assignments" },
  { name: "patients", desc: "Patient records (PHI)" },
  { name: "trucks", desc: "Vehicle fleet" },
  { name: "crews", desc: "Daily crew assignments" },
  { name: "runs", desc: "Legacy dispatch runs" },
  { name: "scheduling_legs", desc: "Scheduling A/B legs" },
  { name: "truck_run_slots", desc: "Truck-to-leg assignments" },
  { name: "trip_records", desc: "Trip lifecycle + clinical docs" },
  { name: "claim_records", desc: "Billing claims" },
  { name: "facilities", desc: "Facility registry" },
  { name: "alerts", desc: "Dispatch alerts" },
  { name: "operational_alerts", desc: "Crew operational alerts" },
  { name: "crew_share_tokens", desc: "Secure crew link tokens" },
  { name: "subscription_records", desc: "Company subscriptions" },
  { name: "audit_logs", desc: "System audit trail" },
];

export function DevModePanel() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    routes: true,
    flags: true,
    roles: false,
    schema: false,
  });

  const toggle = (key: string) =>
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  return (
    <div className="space-y-4">
      {/* Feature Flags */}
      <Section
        title="Feature Flags"
        icon={<Flag className="h-4 w-4" />}
        open={openSections.flags}
        onToggle={() => toggle("flags")}
      >
        <div className="space-y-2">
          {Object.entries(FEATURE_FLAGS).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between text-sm">
              <code className="font-mono text-xs text-muted-foreground">{key}</code>
              <Badge variant={value ? "default" : "secondary"} className="text-[10px]">
                {String(value)}
              </Badge>
            </div>
          ))}
        </div>
      </Section>

      {/* Route List */}
      <Section
        title="Route Map"
        icon={<Route className="h-4 w-4" />}
        open={openSections.routes}
        onToggle={() => toggle("routes")}
      >
        <div className="space-y-1">
          {ROUTES.map((r) => (
            <div key={r.path} className="flex items-center justify-between text-xs">
              <code className="font-mono text-muted-foreground">{r.path}</code>
              <div className="flex gap-1">
                {r.roles.map((role) => (
                  <Badge key={role} variant="outline" className="text-[9px] px-1">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Role Permissions Matrix */}
      <Section
        title="Role Permissions Matrix"
        icon={<Shield className="h-4 w-4" />}
        open={openSections.roles}
        onToggle={() => toggle("roles")}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1 pr-3 text-muted-foreground font-medium">Role</th>
                {["Dispatch", "Sched", "Patients", "Trips", "Billing", "QA", "Facil", "Reports", "Emp", "Trucks", "Settings"].map((h) => (
                  <th key={h} className="text-center py-1 px-1 text-muted-foreground font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLES_MATRIX.map((r) => (
                <tr key={r.role} className="border-b border-border/50">
                  <td className="py-1 pr-3 font-medium text-foreground">{r.role}</td>
                  {[r.dispatch, r.scheduling, r.patients, r.trips, r.billing, r.compliance, r.facilities, r.reports, r.employees, r.trucks, r.settings].map((v, i) => (
                    <td key={i} className="text-center py-1 px-1">
                      {v ? <span className="text-[hsl(var(--status-green))]">✓</span> : <span className="text-muted-foreground/40">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Database Schema Reference */}
      <Section
        title="Database Tables (Schema Only)"
        icon={<Database className="h-4 w-4" />}
        open={openSections.schema}
        onToggle={() => toggle("schema")}
      >
        <p className="text-[10px] text-muted-foreground mb-2">No raw data shown — schema reference only.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
          {DB_TABLES.map((t) => (
            <div key={t.name} className="flex items-center gap-2 text-xs py-0.5">
              <code className="font-mono text-primary">{t.name}</code>
              <span className="text-muted-foreground">— {t.desc}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader
        className="pb-2 cursor-pointer select-none"
        onClick={onToggle}
      >
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          {icon}
          {title}
          {open ? <ChevronDown className="h-3.5 w-3.5 ml-auto" /> : <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
        </CardTitle>
      </CardHeader>
      {open && <CardContent>{children}</CardContent>}
    </Card>
  );
}

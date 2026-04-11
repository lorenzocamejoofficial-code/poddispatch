import { SandboxLayout } from "@/components/layout/SandboxLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePreviewRole } from "@/hooks/usePreviewRole";
import { AlertTriangle, Info } from "lucide-react";
import {
  generateTrucks, generatePatients, generateTrips,
  generateClaims, generateFacilities, generateEmployees,
  type SandboxTruck, type SandboxPatient, type SandboxTrip,
  type SandboxClaim, type SandboxFacility, type SandboxEmployee,
} from "@/lib/sandbox-data";

type PageKey =
  | "dispatch" | "scheduling" | "crew-schedule" | "patients"
  | "trips" | "billing" | "compliance" | "facilities"
  | "reports" | "employees" | "trucks" | "settings";

const PAGE_LABELS: Record<PageKey, string> = {
  dispatch: "Dispatch Command",
  scheduling: "Patient Runs / Scheduling",
  "crew-schedule": "Crew Schedule Delivery",
  patients: "Patients",
  trips: "Trips & Clinical",
  billing: "Billing & Claims",
  compliance: "Compliance & QA",
  facilities: "Facilities",
  reports: "Reports & Metrics",
  employees: "Employees",
  trucks: "Trucks & Crews",
  settings: "Settings",
};

const PAGE_MODULE: Record<PageKey, string> = {
  dispatch: "dispatch",
  scheduling: "scheduling",
  "crew-schedule": "crew-schedule",
  patients: "patients",
  trips: "trips",
  billing: "billing",
  compliance: "compliance",
  facilities: "facilities",
  reports: "reports",
  employees: "employees",
  trucks: "trucks",
  settings: "settings",
};

/**
 * RoleGate: ALWAYS renders the full page content.
 * If the current preview role lacks access, it overlays a banner and disables pointer events,
 * but NEVER replaces the page with an empty view or redirects.
 */
function RoleGate({ module, children }: { module: string; children: React.ReactNode }) {
  const { canView, previewRole, isPreviewActive } = usePreviewRole();
  const permitted = !isPreviewActive || canView(module);

  if (permitted) return <>{children}</>;

  return (
    <div className="relative">
      <div className="sticky top-0 z-10 mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          <strong>{previewRole}</strong> role does not have access to {PAGE_LABELS[module as PageKey] ?? module}.
          Controls are disabled. Switch roles using "View as" above.
        </span>
      </div>
      <div className="opacity-40 pointer-events-none select-none">
        {children}
      </div>
    </div>
  );
}

/** Conditionally disable a section with tooltip */
export function RoleDisabled({ action, children }: { action: string; children: React.ReactNode }) {
  const { canAct, previewRole, isPreviewActive } = usePreviewRole();
  if (!isPreviewActive || canAct(action)) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="opacity-50 pointer-events-none cursor-not-allowed">{children}</div>
      </TooltipTrigger>
      <TooltipContent className="text-xs">Not permitted for {previewRole} role</TooltipContent>
    </Tooltip>
  );
}

export default function SandboxPage({ pageKey }: { pageKey: PageKey }) {
  return (
    <SandboxLayout pageLabel={PAGE_LABELS[pageKey]}>
      <Collapsible className="mb-4">
        <CollapsibleTrigger className="text-xs text-primary hover:underline flex items-center gap-1">
          <Info className="h-3 w-3" />
          How this works
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
          <p>This is the <strong>{PAGE_LABELS[pageKey]}</strong> page rendered with <strong>synthetic sandbox data</strong>.</p>
          <p>All data shown is synthetic — no real patient or company data is used.</p>
          <p>Use the <strong>"View as"</strong> switcher to see how each role experiences this page. Restricted roles see the full layout but with disabled controls.</p>
          <p>No cross-company or real PHI is accessible. RLS + tenant isolation are unchanged.</p>
        </CollapsibleContent>
      </Collapsible>

      <RoleGate module={PAGE_MODULE[pageKey]}>
        {pageKey === "dispatch" && <DispatchSandbox />}
        {pageKey === "scheduling" && <SchedulingSandbox />}
        {pageKey === "crew-schedule" && <CrewScheduleSandbox />}
        {pageKey === "patients" && <PatientsSandbox />}
        {pageKey === "trips" && <TripsSandbox />}
        {pageKey === "billing" && <BillingSandbox />}
        {pageKey === "compliance" && <ComplianceSandbox />}
        {pageKey === "facilities" && <FacilitiesSandbox />}
        {pageKey === "reports" && <ReportsSandbox />}
        {pageKey === "employees" && <EmployeesSandbox />}
        {pageKey === "trucks" && <TrucksSandbox />}
        {pageKey === "settings" && <SettingsSandbox />}
      </RoleGate>
    </SandboxLayout>
  );
}

// ─── Dispatch ──────────────────────────────────────────────

function DispatchSandbox() {
  const trucks = generateTrucks();
  const statusColor: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-800",
    transporting: "bg-blue-100 text-blue-800",
    en_route: "bg-amber-100 text-amber-800",
    arrived: "bg-indigo-100 text-indigo-800",
    with_patient: "bg-purple-100 text-purple-800",
    pending: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Active Trucks" value={trucks.filter(t => t.runs.length > 0).length} />
        <StatCard label="Total Runs" value={trucks.reduce((a, t) => a + t.runs.length, 0)} />
        <StatCard label="Completed" value={trucks.reduce((a, t) => a + t.runs.filter(r => r.status === "completed").length, 0)} />
        <StatCard label="In Progress" value={trucks.reduce((a, t) => a + t.runs.filter(r => r.status !== "completed" && r.status !== "pending").length, 0)} />
      </div>

      {/* Action bar */}
      <RoleDisabled action="assign_run">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="text-xs">+ Add Run</Button>
          <Button size="sm" variant="outline" className="text-xs">Auto-Assign</Button>
        </div>
      </RoleDisabled>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {trucks.map(truck => (
          <Card key={truck.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>{truck.name}</span>
                <Badge variant="outline" className="text-[10px]">{truck.runs.length} runs</Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">{truck.crewNames.join(", ")}</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {truck.runs.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No runs assigned</p>
              ) : truck.runs.map(run => (
                <div key={run.id} className="flex items-center justify-between rounded border p-2 text-xs">
                  <div className="space-y-0.5">
                    <p className="font-medium text-foreground">{run.patientName}</p>
                    <p className="text-muted-foreground">{run.pickupTime} · {run.tripType}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor[run.status] ?? statusColor.pending}`}>
                    {run.status.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Scheduling ────────────────────────────────────────────

function SchedulingSandbox() {
  const trucks = generateTrucks();
  const patients = generatePatients();

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  const weekDates = days.map((day, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return { day, date: d.getDate(), month: d.getMonth() + 1, isToday: d.toDateString() === today.toDateString() };
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Trucks Available" value={trucks.length} />
        <StatCard label="Patients in Pool" value={patients.filter(p => p.status === "active").length} />
        <StatCard label="Legs Scheduled" value={trucks.reduce((a, t) => a + t.runs.length, 0)} />
        <StatCard label="Unassigned" value={2} />
      </div>

      {/* Action bar */}
      <RoleDisabled action="create_run">
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="default" className="text-xs">+ New Run</Button>
          <Button size="sm" variant="outline" className="text-xs">Auto-Generate from Template</Button>
          <Button size="sm" variant="outline" className="text-xs">Copy Crew Assignments Forward</Button>
        </div>
      </RoleDisabled>

      {/* Weekly calendar header */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Weekly Schedule</CardTitle>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="text-xs h-7">← Prev</Button>
              <Button size="sm" variant="ghost" className="text-xs h-7">Today</Button>
              <Button size="sm" variant="ghost" className="text-xs h-7">Next →</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDates.map(wd => (
              <div
                key={wd.day}
                className={`text-center rounded p-2 text-xs ${wd.isToday ? "bg-primary/10 font-bold text-primary" : "text-muted-foreground"}`}
              >
                <div className="font-medium">{wd.day}</div>
                <div className="text-lg">{wd.date}</div>
              </div>
            ))}
          </div>

          {/* Calendar grid with runs */}
          <div className="border rounded-lg overflow-hidden">
            {trucks.slice(0, 5).map((truck, truckIdx) => (
              <div key={truck.id} className={`grid grid-cols-7 gap-px ${truckIdx > 0 ? "border-t" : ""}`}>
                {weekDates.map((wd, dayIdx) => {
                  // Show runs on some days based on truck pattern
                  const hasRuns = truck.runs.length > 0 && (dayIdx % 2 === truckIdx % 2);
                  const dayRuns = hasRuns ? truck.runs.slice(0, 2) : [];
                  return (
                    <div key={dayIdx} className="min-h-[60px] p-1 bg-card hover:bg-accent/50 transition-colors">
                      {dayIdx === 0 && (
                        <p className="text-[10px] font-semibold text-foreground mb-1 truncate">{truck.name}</p>
                      )}
                      {dayRuns.map(run => (
                        <div
                          key={run.id}
                          className="rounded bg-primary/10 border border-primary/20 p-1 mb-0.5 text-[9px] cursor-grab hover:bg-primary/20 transition-colors"
                          title={`${run.patientName} — ${run.pickupTime}`}
                        >
                          <span className="font-medium truncate block">{run.patientName.split(" ")[2] ?? run.patientName}</span>
                          <span className="text-muted-foreground">{run.pickupTime}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Truck Builder */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Truck Builder</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {trucks.slice(0, 5).map(truck => (
              <div key={truck.id} className="rounded border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{truck.name}</p>
                  <span className="text-xs text-muted-foreground">{truck.crewNames.join(", ")}</span>
                </div>
                {truck.runs.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">No legs — drag from Run Pool to assign</p>
                ) : truck.runs.map(run => (
                  <div key={run.id} className="rounded bg-muted/40 p-2 text-xs cursor-grab hover:bg-muted/70 transition-colors border border-transparent hover:border-border">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{run.patientName}</p>
                      <Badge variant="outline" className="text-[9px]">{run.tripType}</Badge>
                    </div>
                    <p className="text-muted-foreground">{run.pickupTime} → {run.destination}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Run Pool */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Run Pool (Unassigned Legs)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {patients.filter(p => p.status === "active").slice(0, 4).map(p => (
              <div key={p.id} className="rounded border border-dashed p-2 text-xs cursor-grab hover:bg-accent/50 transition-colors">
                <p className="font-medium text-foreground">{p.firstName} {p.lastName}</p>
                <p className="text-muted-foreground">{p.transportType} · {p.scheduleDays} · {p.primaryPayer}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Crew Schedule ─────────────────────────────────────────

function CrewScheduleSandbox() {
  const trucks = generateTrucks();
  return (
    <div className="space-y-4">
      <RoleDisabled action="assign_run">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="text-xs">Send All Run Sheets</Button>
          <Button size="sm" variant="outline" className="text-xs">Preview as Crew</Button>
        </div>
      </RoleDisabled>
      <Card>
        <CardHeader><CardTitle className="text-sm">Crew Schedule Delivery</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {trucks.filter(t => t.runs.length > 0).map(truck => (
            <div key={truck.id} className="rounded border p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{truck.name}</p>
                  <p className="text-xs text-muted-foreground">{truck.crewNames.join(", ")}</p>
                </div>
                <Badge variant="outline" className="text-[10px]">Link Sent ✓</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{truck.runs.length} runs assigned for today</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Patients ──────────────────────────────────────────────

function PatientsSandbox() {
  const patients = generatePatients();
  const statusColor: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-800",
    in_hospital: "bg-amber-100 text-amber-800",
    vacation: "bg-blue-100 text-blue-800",
    paused: "bg-muted text-muted-foreground",
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Patients" value={patients.length} />
        <StatCard label="Active" value={patients.filter(p => p.status === "active").length} />
        <StatCard label="Dialysis" value={patients.filter(p => p.transportType === "dialysis").length} />
        <StatCard label="Outpatient" value={patients.filter(p => p.transportType === "outpatient").length} />
      </div>

      <RoleDisabled action="manage_patients">
        <div className="flex gap-2">
          <Button size="sm" variant="default" className="text-xs">+ Add Patient</Button>
          <Button size="sm" variant="outline" className="text-xs">Import</Button>
        </div>
      </RoleDisabled>

      <Card>
        <CardContent className="pt-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Transport</th>
                <th className="pb-2 font-medium">Schedule</th>
                <th className="pb-2 font-medium">Payer</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {patients.map(p => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-accent/50">
                  <td className="py-2 font-medium text-foreground">{p.firstName} {p.lastName}</td>
                  <td className="py-2">{p.transportType}</td>
                  <td className="py-2">{p.scheduleDays}</td>
                  <td className="py-2">{p.primaryPayer}</td>
                  <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor[p.status] ?? statusColor.active}`}>{p.status}</span></td>
                  <td className="py-2">
                    <RoleDisabled action="manage_patients">
                      <Button size="sm" variant="ghost" className="text-[10px] h-6">Edit</Button>
                    </RoleDisabled>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Trips & Clinical ──────────────────────────────────────

function TripsSandbox() {
  const trips = generateTrips();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Today's Trips" value={trips.length} />
        <StatCard label="Completed" value={trips.filter(t => t.status === "completed").length} />
        <StatCard label="Doc Complete" value={trips.filter(t => t.documentationComplete).length} />
        <StatCard label="Ready for Billing" value={trips.filter(t => t.claimReady).length} />
      </div>
      <Card>
        <CardContent className="pt-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Patient</th>
                <th className="pb-2 font-medium">Route</th>
                <th className="pb-2 font-medium">Miles</th>
                <th className="pb-2 font-medium">Crew</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Docs</th>
              </tr>
            </thead>
            <tbody>
              {trips.map(t => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-accent/50">
                  <td className="py-2 font-medium text-foreground">{t.patientName}</td>
                  <td className="py-2 text-muted-foreground">{t.pickupLocation} → {t.destination}</td>
                  <td className="py-2">{t.loadedMiles || "—"}</td>
                  <td className="py-2">{t.crewNames}</td>
                  <td className="py-2"><Badge variant="outline" className="text-[10px]">{t.status}</Badge></td>
                  <td className="py-2">{t.documentationComplete ? <Badge className="bg-emerald-100 text-emerald-800 text-[10px] border-0">✓ Complete</Badge> : <Badge variant="destructive" className="text-[10px]">Missing</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Billing ───────────────────────────────────────────────

function BillingSandbox() {
  const claims = generateClaims();
  const statusColor: Record<string, string> = {
    ready_to_bill: "bg-amber-100 text-amber-800",
    submitted: "bg-blue-100 text-blue-800",
    paid: "bg-emerald-100 text-emerald-800",
    denied: "bg-red-100 text-red-800",
    needs_correction: "bg-orange-100 text-orange-800",
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Claims" value={claims.length} />
        <StatCard label="Paid" value={claims.filter(c => c.status === "paid").length} />
        <StatCard label="Pending" value={claims.filter(c => c.status === "submitted" || c.status === "ready_to_bill").length} />
        <StatCard label="Denied" value={claims.filter(c => c.status === "denied").length} />
      </div>

      <RoleDisabled action="submit_claim">
        <div className="flex gap-2">
          <Button size="sm" variant="default" className="text-xs">Submit Selected</Button>
          <Button size="sm" variant="outline" className="text-xs">Batch Submit All Ready</Button>
        </div>
      </RoleDisabled>

      <Card>
        <CardContent className="pt-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Patient</th>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Payer</th>
                <th className="pb-2 font-medium">Charge</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {claims.map(c => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-accent/50">
                  <td className="py-2 font-medium text-foreground">{c.patientName}</td>
                  <td className="py-2">{c.runDate}</td>
                  <td className="py-2">{c.payerName}</td>
                  <td className="py-2">${c.totalCharge.toFixed(2)}</td>
                  <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor[c.status] ?? ""}`}>{c.status.replace(/_/g, " ")}</span></td>
                  <td className="py-2">
                    <RoleDisabled action="edit_claim">
                      <Button size="sm" variant="ghost" className="text-[10px] h-6">Edit</Button>
                    </RoleDisabled>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Compliance ────────────────────────────────────────────

function ComplianceSandbox() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="QA Reviews" value={3} />
        <StatCard label="Pending" value={2} />
        <StatCard label="Resolved" value={1} />
        <StatCard label="Flags This Week" value={4} />
      </div>

      <RoleDisabled action="manage_compliance">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="text-xs">Review Next</Button>
          <Button size="sm" variant="outline" className="text-xs">Export Report</Button>
        </div>
      </RoleDisabled>

      <Card>
        <CardHeader><CardTitle className="text-sm">QA Review Queue</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {[
            { patient: "Test Patient G", reason: "Missing PCS documentation", status: "pending" },
            { patient: "Test Patient D", reason: "Authorization expired", status: "pending" },
            { patient: "Test Patient A", reason: "Vitals incomplete", status: "resolved" },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between rounded border p-2 text-xs hover:bg-accent/50">
              <div>
                <p className="font-medium text-foreground">{item.patient}</p>
                <p className="text-muted-foreground">{item.reason}</p>
              </div>
              <Badge variant={item.status === "resolved" ? "secondary" : "destructive"} className="text-[10px]">{item.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Facilities ────────────────────────────────────────────

function FacilitiesSandbox() {
  const facilities = generateFacilities();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Total Facilities" value={facilities.length} />
        <StatCard label="Active" value={facilities.filter(f => f.active).length} />
        <StatCard label="Inactive" value={facilities.filter(f => !f.active).length} />
      </div>
      <Card>
        <CardContent className="pt-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Address</th>
                <th className="pb-2 font-medium">Phone</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {facilities.map(f => (
                <tr key={f.id} className="border-b last:border-0 hover:bg-accent/50">
                  <td className="py-2 font-medium text-foreground">{f.name}</td>
                  <td className="py-2">{f.type}</td>
                  <td className="py-2 text-muted-foreground">{f.address}</td>
                  <td className="py-2">{f.phone}</td>
                  <td className="py-2"><Badge variant={f.active ? "secondary" : "outline"} className="text-[10px]">{f.active ? "Active" : "Inactive"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Reports ───────────────────────────────────────────────

function ReportsSandbox() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Revenue (MTD)" value="$12,450" isText />
        <StatCard label="Trips (MTD)" value={87} />
        <StatCard label="Clean Claim %" value="82%" isText />
        <StatCard label="Avg Miles/Trip" value="11.3" isText />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm">Monthly Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="space-y-2">
              <p className="text-muted-foreground">Top Payer: <span className="font-medium text-foreground">Medicare (62%)</span></p>
              <p className="text-muted-foreground">Denial Rate: <span className="font-medium text-foreground">8.2%</span></p>
              <p className="text-muted-foreground">AR {">"} 30 Days: <span className="font-medium text-foreground">$3,200</span></p>
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground">Total Crews: <span className="font-medium text-foreground">5 active</span></p>
              <p className="text-muted-foreground">Trucks Utilized: <span className="font-medium text-foreground">4/5 (80%)</span></p>
              <p className="text-muted-foreground">No-Show Rate: <span className="font-medium text-foreground">3.4%</span></p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Employees ─────────────────────────────────────────────

function EmployeesSandbox() {
  const employees = generateEmployees();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Total Employees" value={employees.length} />
        <StatCard label="Active" value={employees.filter(e => e.active).length} />
        <StatCard label="Inactive" value={employees.filter(e => !e.active).length} />
      </div>

      <RoleDisabled action="manage_employees">
        <div className="flex gap-2">
          <Button size="sm" variant="default" className="text-xs">+ Add Employee</Button>
        </div>
      </RoleDisabled>

      <Card>
        <CardContent className="pt-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Cert Level</th>
                <th className="pb-2 font-medium">Phone</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(e => (
                <tr key={e.id} className="border-b last:border-0 hover:bg-accent/50">
                  <td className="py-2 font-medium text-foreground">{e.fullName}</td>
                  <td className="py-2">{e.certLevel}</td>
                  <td className="py-2">{e.phone}</td>
                  <td className="py-2"><Badge variant={e.active ? "secondary" : "outline"} className="text-[10px]">{e.active ? "Active" : "Inactive"}</Badge></td>
                  <td className="py-2">
                    <RoleDisabled action="manage_employees">
                      <Button size="sm" variant="ghost" className="text-[10px] h-6">Edit</Button>
                    </RoleDisabled>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Trucks & Crews ────────────────────────────────────────

function TrucksSandbox() {
  const trucks = generateTrucks();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Total Trucks" value={trucks.length} />
        <StatCard label="With Runs" value={trucks.filter(t => t.runs.length > 0).length} />
        <StatCard label="Idle" value={trucks.filter(t => t.runs.length === 0).length} />
      </div>

      <RoleDisabled action="manage_trucks">
        <div className="flex gap-2">
          <Button size="sm" variant="default" className="text-xs">+ Add Truck</Button>
          <Button size="sm" variant="outline" className="text-xs">Manage Crews</Button>
        </div>
      </RoleDisabled>

      <Card>
        <CardContent className="pt-4 space-y-3">
          {trucks.map(t => (
            <div key={t.id} className="flex items-center justify-between rounded border p-3 text-xs hover:bg-accent/50">
              <div>
                <p className="font-semibold text-foreground">{t.name}</p>
                <p className="text-muted-foreground">Crew: {t.crewNames.join(", ") || "Unassigned"}</p>
              </div>
              <div className="text-right">
                <p className="font-medium text-foreground">{t.runs.length} runs</p>
                <p className="text-muted-foreground">{t.runs.filter(r => r.status === "completed").length} completed</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Settings ──────────────────────────────────────────────

function SettingsSandbox() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Company Settings</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-xs">
          {[
            ["Company Name", "SandboxCo"],
            ["Session Timeout", "30 minutes"],
            ["Load Time Buffer", "10 minutes"],
            ["Unload Time Buffer", "10 minutes"],
            ["Grace Window", "15 minutes"],
            ["Facility Delay Buffer", "10 minutes"],
            ["Dialysis B-Leg Buffer", "15 minutes"],
            ["Discharge Buffer", "20 minutes"],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between border-b pb-2 last:border-0">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium text-foreground">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Shared ────────────────────────────────────────────────

function StatCard({ label, value, isText }: { label: string; value: number | string; isText?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

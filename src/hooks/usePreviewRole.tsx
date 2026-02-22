import { createContext, useContext, useState, ReactNode, useCallback } from "react";

export type PreviewRole = "creator" | "owner" | "dispatcher" | "biller" | "crew";

interface PreviewRoleContextType {
  previewRole: PreviewRole;
  setPreviewRole: (role: PreviewRole) => void;
  /** Check if a module is visible for the current preview role */
  canView: (module: string) => boolean;
  /** Check if an action is permitted for the current preview role */
  canAct: (action: string) => boolean;
  isPreviewActive: boolean; // true when viewing as non-creator role
  /** Get human-readable capabilities for the current role */
  capabilities: string[];
}

// Which modules each role can see
const ROLE_MODULES: Record<PreviewRole, string[]> = {
  creator: ["*"],
  owner: ["dispatch", "scheduling", "crew-schedule", "patients", "trips", "billing", "compliance", "facilities", "reports", "employees", "trucks", "settings"],
  dispatcher: ["dispatch", "scheduling", "crew-schedule", "patients", "trips", "facilities", "trucks", "employees"],
  biller: ["trips", "billing", "compliance", "patients", "facilities", "reports"],
  crew: ["crew-schedule"],
};

// Which actions each role can perform
const ROLE_ACTIONS: Record<PreviewRole, string[]> = {
  creator: ["*"],
  owner: ["*"],
  dispatcher: ["assign_run", "edit_schedule", "manage_patients", "manage_trucks", "view_trips", "create_run", "move_run", "manage_employees"],
  biller: ["submit_claim", "edit_claim", "view_trips", "manage_compliance", "view_patients"],
  crew: ["update_status", "submit_documentation"],
};

// Human-readable capability descriptions per role
const ROLE_CAPABILITIES: Record<PreviewRole, string[]> = {
  creator: ["Full system access", "All modules", "All actions", "Company Simulation"],
  owner: ["All modules", "All CRUD actions", "Settings management", "Employee management", "Reports access"],
  dispatcher: ["View/Edit Scheduling Calendar", "Create/Assign Runs", "Drag & Drop Runs", "Manage Patients", "Manage Trucks & Crews", "Manage Employees", "View Trips", "View Facilities"],
  biller: ["View/Edit Billing & Claims", "Submit/Edit Claims", "View Completed Trips", "Manage Compliance & QA", "View Patients (billing fields)", "View Reports & Metrics", "View Facilities"],
  crew: ["View Assigned Run Sheet", "Update Run Status", "Submit Documentation", "Report No-Show / Delay"],
};

const PreviewRoleContext = createContext<PreviewRoleContextType | undefined>(undefined);

export function PreviewRoleProvider({ children }: { children: ReactNode }) {
  const [previewRole, setPreviewRoleState] = useState<PreviewRole>(() => {
    try {
      return (localStorage.getItem("preview_role") as PreviewRole) || "creator";
    } catch {
      return "creator";
    }
  });

  const setPreviewRole = useCallback((role: PreviewRole) => {
    setPreviewRoleState(role);
    try { localStorage.setItem("preview_role", role); } catch {}
  }, []);

  const canView = useCallback((module: string) => {
    const modules = ROLE_MODULES[previewRole];
    return modules.includes("*") || modules.includes(module);
  }, [previewRole]);

  const canAct = useCallback((action: string) => {
    const actions = ROLE_ACTIONS[previewRole];
    return actions.includes("*") || actions.includes(action);
  }, [previewRole]);

  const isPreviewActive = previewRole !== "creator";
  const capabilities = ROLE_CAPABILITIES[previewRole];

  return (
    <PreviewRoleContext.Provider value={{ previewRole, setPreviewRole, canView, canAct, isPreviewActive, capabilities }}>
      {children}
    </PreviewRoleContext.Provider>
  );
}

export function usePreviewRole() {
  const ctx = useContext(PreviewRoleContext);
  if (!ctx) throw new Error("usePreviewRole must be used within PreviewRoleProvider");
  return ctx;
}

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
}

// Which modules each role can see
const ROLE_MODULES: Record<PreviewRole, string[]> = {
  creator: ["*"],
  owner: ["dispatch", "scheduling", "crew-schedule", "patients", "trips", "billing", "compliance", "facilities", "reports", "employees", "trucks", "settings"],
  dispatcher: ["dispatch", "scheduling", "crew-schedule", "patients", "trips", "facilities", "trucks"],
  biller: ["trips", "billing", "compliance", "facilities"],
  crew: ["crew-schedule"],
};

// Which actions each role can perform
const ROLE_ACTIONS: Record<PreviewRole, string[]> = {
  creator: ["*"],
  owner: ["*"],
  dispatcher: ["assign_run", "edit_schedule", "manage_patients", "manage_trucks", "view_trips"],
  biller: ["submit_claim", "edit_claim", "view_trips", "manage_compliance"],
  crew: ["update_status", "submit_documentation"],
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

  return (
    <PreviewRoleContext.Provider value={{ previewRole, setPreviewRole, canView, canAct, isPreviewActive }}>
      {children}
    </PreviewRoleContext.Provider>
  );
}

export function usePreviewRole() {
  const ctx = useContext(PreviewRoleContext);
  if (!ctx) throw new Error("usePreviewRole must be used within PreviewRoleProvider");
  return ctx;
}

import { createContext, useContext, useState, ReactNode, useCallback } from "react";

interface SandboxModeContextType {
  sandboxMode: boolean;
  toggleSandbox: () => void;
  setSandboxMode: (on: boolean) => void;
}

const SandboxModeContext = createContext<SandboxModeContextType | undefined>(undefined);

export function SandboxModeProvider({ children }: { children: ReactNode }) {
  const [sandboxMode, setSandboxModeState] = useState(() => {
    try { return localStorage.getItem("sandbox_mode") === "true"; } catch { return false; }
  });

  const setSandboxMode = useCallback((on: boolean) => {
    setSandboxModeState(on);
    try { localStorage.setItem("sandbox_mode", String(on)); } catch {}
  }, []);

  const toggleSandbox = useCallback(() => {
    setSandboxMode(!sandboxMode);
  }, [sandboxMode, setSandboxMode]);

  return (
    <SandboxModeContext.Provider value={{ sandboxMode, toggleSandbox, setSandboxMode }}>
      {children}
    </SandboxModeContext.Provider>
  );
}

export function useSandboxMode() {
  const ctx = useContext(SandboxModeContext);
  if (!ctx) throw new Error("useSandboxMode must be used within SandboxModeProvider");
  return ctx;
}

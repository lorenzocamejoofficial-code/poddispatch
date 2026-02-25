import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface SimulationSessionContextType {
  simulationRunId: string | null;
  sandboxCompanyId: string | null;
  refreshToken: number;
  setSimulationRunId: (runId: string | null) => void;
  setSandboxCompanyId: (companyId: string | null) => void;
  triggerSimulationRefresh: () => void;
}

const SIM_RUN_STORAGE_KEY = "simulation_run_id";
const SIM_COMPANY_STORAGE_KEY = "simulation_company_id";

const SimulationSessionContext = createContext<SimulationSessionContextType | undefined>(undefined);

export function SimulationSessionProvider({ children }: { children: ReactNode }) {
  const [simulationRunId, setSimulationRunIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SIM_RUN_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const [sandboxCompanyId, setSandboxCompanyIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SIM_COMPANY_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const [refreshToken, setRefreshToken] = useState(0);

  const setSimulationRunId = useCallback((runId: string | null) => {
    setSimulationRunIdState(runId);
    try {
      if (runId) localStorage.setItem(SIM_RUN_STORAGE_KEY, runId);
      else localStorage.removeItem(SIM_RUN_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
  }, []);

  const setSandboxCompanyId = useCallback((companyId: string | null) => {
    setSandboxCompanyIdState(companyId);
    try {
      if (companyId) localStorage.setItem(SIM_COMPANY_STORAGE_KEY, companyId);
      else localStorage.removeItem(SIM_COMPANY_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
  }, []);

  const triggerSimulationRefresh = useCallback(() => {
    setRefreshToken(token => token + 1);
  }, []);

  useEffect(() => {
    const handleRefresh = () => setRefreshToken(token => token + 1);
    window.addEventListener("simulation-refresh", handleRefresh as EventListener);
    return () => window.removeEventListener("simulation-refresh", handleRefresh as EventListener);
  }, []);

  const value = useMemo(
    () => ({
      simulationRunId,
      sandboxCompanyId,
      refreshToken,
      setSimulationRunId,
      setSandboxCompanyId,
      triggerSimulationRefresh,
    }),
    [simulationRunId, sandboxCompanyId, refreshToken, setSimulationRunId, setSandboxCompanyId, triggerSimulationRefresh]
  );

  return <SimulationSessionContext.Provider value={value}>{children}</SimulationSessionContext.Provider>;
}

export function useSimulationSession() {
  const ctx = useContext(SimulationSessionContext);
  if (!ctx) throw new Error("useSimulationSession must be used within SimulationSessionProvider");
  return ctx;
}

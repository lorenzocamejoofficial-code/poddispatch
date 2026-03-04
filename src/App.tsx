import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { SchedulingProvider } from "@/hooks/useSchedulingStore";
import { SimulationSessionProvider } from "@/hooks/useSimulationSession";
import Login from "./pages/Login";
import DispatchBoard from "./pages/DispatchBoard";
import CrewView from "./pages/CrewView";
import Patients from "./pages/Patients";
import Employees from "./pages/Employees";
import TrucksCrews from "./pages/TrucksCrews";
import Runs from "./pages/Runs";
import Scheduling from "./pages/Scheduling";
import AdminSettings from "./pages/AdminSettings";
import CrewScheduleAdmin from "./pages/CrewScheduleAdmin";
import DailyRunSheet from "./pages/DailyRunSheet";
import NotFound from "./pages/NotFound";
import TripsAndClinical from "./pages/TripsAndClinical";
import BillingAndClaims from "./pages/BillingAndClaims";
import ComplianceAndQA from "./pages/ComplianceAndQA";
import FacilitiesPage from "./pages/FacilitiesPage";
import ReportsAndMetrics from "./pages/ReportsAndMetrics";
import MigrationOnboarding from "./pages/MigrationOnboarding";

import SystemCreatorDashboard from "./pages/SystemCreatorDashboard";
import CompanySignup from "./pages/CompanySignup";
import PendingApproval from "./pages/PendingApproval";
import CreatorConsole from "./pages/CreatorConsole";
import SandboxPage from "./pages/SandboxPage";
import PendingCompaniesAdmin from "./pages/PendingCompaniesAdmin";
import CreatorSettings from "./pages/CreatorSettings";
import SimulationLab from "./pages/SimulationLab";
import AcceptInvite from "./pages/AcceptInvite";
import CreateCompany from "./pages/CreateCompany";
// SandboxModeProvider and PreviewRoleProvider removed — no role-based view filtering
const queryClient = new QueryClient();

function SessionWarningBanner() {
  const { sessionWarning, signOut } = useAuth();
  if (!sessionWarning) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-4 bg-destructive px-4 py-2 text-sm text-destructive-foreground shadow-lg">
      <span>⚠️ Your session will expire in 2 minutes due to inactivity. Move your mouse or press a key to stay logged in.</span>
      <button
        onClick={signOut}
        className="rounded border border-destructive-foreground/40 px-3 py-1 text-xs font-medium hover:bg-destructive-foreground/10 transition-colors"
      >
        Sign Out Now
      </button>
    </div>
  );
}

function AppRoutes() {
  const { user, role, loading, isSystemCreator, onboardingStatus, activeCompanyId } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Public routes (no auth)
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<CompanySignup />} />
        <Route path="/invite" element={<AcceptInvite />} />
        <Route path="/crew/:token" element={<DailyRunSheet />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Authenticated but no company membership — must create or accept invite
  if (!isSystemCreator && !activeCompanyId) {
    return (
      <Routes>
        <Route path="/create-company" element={<CreateCompany />} />
        <Route path="/invite" element={<AcceptInvite />} />
        <Route path="*" element={<Navigate to="/create-company" replace />} />
      </Routes>
    );
  }

  // Pending approval — company created but not yet activated
  // Non-creator users whose company is not active get locked to PendingApproval
  if (!isSystemCreator && onboardingStatus && onboardingStatus !== "active") {
    return (
      <Routes>
        <Route path="/pending-approval" element={<PendingApproval />} />
        <Route path="*" element={<Navigate to="/pending-approval" replace />} />
      </Routes>
    );
  }

  // Newly approved companies route to migration first
  // (handled naturally — they have active status and land on "/" which is DispatchBoard)
  
  // System creator — full access to everything
  if (isSystemCreator) {
    return (
      <SchedulingProvider>
        <Routes>
          {/* Creator-specific pages (use CreatorLayout internally) */}
          <Route path="/system" element={<SystemCreatorDashboard />} />
          <Route path="/creator-console" element={<CreatorConsole />} />
          <Route path="/pending-companies" element={<PendingCompaniesAdmin />} />
          <Route path="/creator-settings" element={<CreatorSettings />} />
          <Route path="/simulation-lab" element={<SimulationLab />} />
          {/* App Simulation — all operational pages */}
          <Route path="/simulation" element={<DispatchBoard />} />
          <Route path="/scheduling" element={<Scheduling />} />
          <Route path="/crew-schedule" element={<CrewScheduleAdmin />} />
          <Route path="/crew/:token" element={<DailyRunSheet />} />
          <Route path="/runs" element={<Runs />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/trips" element={<TripsAndClinical />} />
          <Route path="/billing" element={<BillingAndClaims />} />
          <Route path="/compliance" element={<ComplianceAndQA />} />
          <Route path="/facilities" element={<FacilitiesPage />} />
          <Route path="/reports" element={<ReportsAndMetrics />} />
          <Route path="/migration" element={<MigrationOnboarding />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/trucks" element={<TrucksCrews />} />
          <Route path="/settings" element={<AdminSettings />} />
          {/* Default: creator lands on System Dashboard */}
          <Route path="/" element={<Navigate to="/system" replace />} />
          <Route path="/login" element={<Navigate to="/system" replace />} />
          <Route path="/sandbox/*" element={<Navigate to="/system" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </SchedulingProvider>
    );
  }

  // Pending approval route (available to all authenticated users)
  // The actual gating by onboarding_status will be checked in the individual pages

  // Crew role — mobile-only view
  if (role === "crew") {
    return (
      <Routes>
        <Route path="/" element={<CrewView />} />
        <Route path="/crew/:token" element={<DailyRunSheet />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Dispatcher role — dispatch + scheduling + trips + patients, no billing/reports/settings
  if (role === "dispatcher") {
    return (
      <SchedulingProvider>
        <Routes>
          <Route path="/" element={<DispatchBoard />} />
          <Route path="/scheduling" element={<Scheduling />} />
          <Route path="/crew-schedule" element={<CrewScheduleAdmin />} />
          <Route path="/crew/:token" element={<DailyRunSheet />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/trips" element={<TripsAndClinical />} />
          <Route path="/facilities" element={<FacilitiesPage />} />
          <Route path="/trucks" element={<TrucksCrews />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SchedulingProvider>
    );
  }

  // Biller role — completed trips + claims + compliance + facilities
  if (role === "biller") {
    return (
      <SchedulingProvider>
        <Routes>
          <Route path="/" element={<BillingAndClaims />} />
          <Route path="/trips" element={<TripsAndClinical />} />
          <Route path="/billing" element={<BillingAndClaims />} />
          <Route path="/compliance" element={<ComplianceAndQA />} />
          <Route path="/facilities" element={<FacilitiesPage />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SchedulingProvider>
    );
  }

  // Admin role — full access
  return (
    <SchedulingProvider>
      <Routes>
        <Route path="/pending-approval" element={<PendingApproval />} />
        <Route path="/" element={<DispatchBoard />} />
        <Route path="/scheduling" element={<Scheduling />} />
        <Route path="/crew-schedule" element={<CrewScheduleAdmin />} />
        <Route path="/crew/:token" element={<DailyRunSheet />} />
        <Route path="/runs" element={<Runs />} />
        <Route path="/patients" element={<Patients />} />
        <Route path="/trips" element={<TripsAndClinical />} />
        <Route path="/billing" element={<BillingAndClaims />} />
        <Route path="/compliance" element={<ComplianceAndQA />} />
        <Route path="/facilities" element={<FacilitiesPage />} />
        <Route path="/reports" element={<ReportsAndMetrics />} />
        <Route path="/migration" element={<MigrationOnboarding />} />
        <Route path="/simulation" element={<Navigate to="/" replace />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/trucks" element={<TrucksCrews />} />
        <Route path="/settings" element={<AdminSettings />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </SchedulingProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <SimulationSessionProvider>
            <SessionWarningBanner />
            <AppRoutes />
          </SimulationSessionProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

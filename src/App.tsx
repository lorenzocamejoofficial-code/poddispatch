import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { SchedulingProvider } from "@/hooks/useSchedulingStore";
import { SimulationSessionProvider } from "@/hooks/useSimulationSession";
import { HipaaAcknowledgmentGate } from "@/components/compliance/HipaaAcknowledgmentGate";
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
import CrewUIPreview from "./pages/CrewUIPreview";
import OverrideMonitor from "./pages/OverrideMonitor";
import AcceptInvite from "./pages/AcceptInvite";
import CreateCompany from "./pages/CreateCompany";
import AccountSettings from "./pages/AccountSettings";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ForgotEmail from "./pages/ForgotEmail";
import SuspendedPage from "./pages/SuspendedPage";
import CrewDashboard from "./pages/CrewDashboard";
import PCRPage from "./pages/PCRPage";
import CrewPatients from "./pages/crew/CrewPatients";
import CrewSchedulePage from "./pages/crew/CrewSchedule";
import OnboardingWizard from "./pages/OnboardingWizard";
import TrialExpired from "./pages/TrialExpired";
import EDIExport from "./pages/EDIExport";
import LegalPage from "./pages/LegalPage";
import RemittanceImport from "./pages/RemittanceImport";
import OwnerDashboard from "./pages/OwnerDashboard";
import ARCommandCenter from "./pages/ARCommandCenter";
import CrewInspectionChecklist from "./components/inspection/CrewInspectionChecklist";
import { useCrewViewEligibility } from "./hooks/useCrewViewEligibility";

/** Wrapper that renders crew routes only if the user is eligible (has cert + assigned today) */
function CrewRouteGate({ children }: { children: React.ReactNode }) {
  const { profileId } = useAuth();
  const { eligible, loading } = useCrewViewEligibility(profileId);
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!eligible) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Token links redirect to login with crew mode when unauthenticated
function TokenLoginRedirect() {
  const { token } = useParams<{ token: string }>();
  return <Navigate to={`/login?mode=crew&token_redirect=${token}`} replace />;
}
// SandboxModeProvider and PreviewRoleProvider removed — no role-based view filtering
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s — prevent unnecessary re-fetches on navigation
      refetchOnWindowFocus: false,
    },
  },
});

function SessionWarningBanner() {
  const { sessionWarning, signOut } = useAuth();
  if (!sessionWarning) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-4 bg-destructive px-4 py-2 text-sm text-destructive-foreground shadow-lg">
      <span>⚠️ Your session will expire in 5 minutes due to inactivity. Move your mouse or press a key to stay logged in.</span>
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
  const { user, role, loading, membershipLoaded, isSystemCreator, onboardingStatus, activeCompanyId, subscriptionStatus, wizardCompleted } = useAuth();

  // Show loading while auth session OR membership data is still resolving
  if (loading || (user && !membershipLoaded)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  // Public routes (no auth)
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<CompanySignup />} />
        <Route path="/legal" element={<LegalPage />} />
        <Route path="/invite" element={<AcceptInvite />} />
        {/* Token links redirect to login with crew mode pre-selected */}
        <Route path="/crew/:token" element={<TokenLoginRedirect />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/forgot-email" element={<ForgotEmail />} />
        <Route path="/reset-password" element={<ResetPassword />} />
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

  // Suspended — company exists but suspended
  if (!isSystemCreator && onboardingStatus === "suspended") {
    return (
      <Routes>
        <Route path="/suspended" element={<SuspendedPage />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/suspended" replace />} />
      </Routes>
    );
  }

  // Pending approval — company created but not yet activated
  if (!isSystemCreator && onboardingStatus && onboardingStatus !== "active") {
    return (
      <Routes>
        <Route path="/pending-approval" element={<PendingApproval />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/pending-approval" replace />} />
      </Routes>
    );
  }

  // Trial expired — block access for non-creators
  if (!isSystemCreator && subscriptionStatus === "trial_expired") {
    return (
      <Routes>
        <Route path="/trial-expired" element={<TrialExpired />} />
        <Route path="*" element={<Navigate to="/trial-expired" replace />} />
      </Routes>
    );
  }

  // New owner hasn't completed wizard — force redirect (owner/admin only)
  if (!isSystemCreator && (role === "owner" || role === "creator") && wizardCompleted === false) {
    return (
      <SchedulingProvider>
        <Routes>
          <Route path="/onboarding" element={<OnboardingWizard />} />
          <Route path="/account" element={<AccountSettings />} />
          <Route path="*" element={<Navigate to="/onboarding" replace />} />
        </Routes>
      </SchedulingProvider>
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
          <Route path="/crew-preview" element={<CrewUIPreview />} />
          <Route path="/override-monitor" element={<OverrideMonitor />} />
          <Route path="/crew-dashboard" element={<CrewDashboard />} />
          <Route path="/crew-patients" element={<CrewPatients />} />
          <Route path="/crew-schedule" element={<CrewSchedulePage />} />
           <Route path="/pcr" element={<PCRPage />} />
           <Route path="/crew-checklist" element={<CrewInspectionChecklist />} />
          {/* App Simulation — all operational pages */}
          <Route path="/simulation" element={<DispatchBoard />} />
          <Route path="/scheduling" element={<Scheduling />} />
          <Route path="/crew-schedule" element={<CrewScheduleAdmin />} />
          <Route path="/crew/:token" element={<DailyRunSheet />} />
          <Route path="/runs" element={<Runs />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/trips" element={<TripsAndClinical />} />
          <Route path="/billing" element={<BillingAndClaims />} />
          <Route path="/ar-command-center" element={<ARCommandCenter />} />
          <Route path="/edi-export" element={<EDIExport />} />
          <Route path="/remittance-import" element={<RemittanceImport />} />
          <Route path="/owner-dashboard" element={<OwnerDashboard />} />
          <Route path="/compliance" element={<ComplianceAndQA />} />
          <Route path="/facilities" element={<FacilitiesPage />} />
          <Route path="/reports" element={<ReportsAndMetrics />} />
          <Route path="/migration" element={<MigrationOnboarding />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/trucks" element={<TrucksCrews />} />
          <Route path="/settings" element={<AdminSettings />} />
          <Route path="/account" element={<AccountSettings />} />
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
      <HipaaAcknowledgmentGate>
        <Routes>
          <Route path="/" element={<CrewDashboard />} />
          <Route path="/crew-dashboard" element={<CrewDashboard />} />
          <Route path="/crew-patients" element={<CrewPatients />} />
          <Route path="/crew-schedule" element={<CrewSchedulePage />} />
          <Route path="/pcr" element={<PCRPage />} />
          <Route path="/crew-checklist" element={<CrewInspectionChecklist />} />
          <Route path="/crew/:token" element={<DailyRunSheet />} />
          <Route path="/account" element={<AccountSettings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HipaaAcknowledgmentGate>
    );
  }

  // Dispatcher role — dispatch + scheduling + trips + patients, no billing/reports/settings
  if (role === "dispatcher") {
    return (
      <HipaaAcknowledgmentGate>
        <SchedulingProvider>
          <Routes>
            <Route path="/" element={<DispatchBoard />} />
            <Route path="/scheduling" element={<Scheduling />} />
            <Route path="/crew-schedule" element={<CrewScheduleAdmin />} />
            <Route path="/crew/:token" element={<DailyRunSheet />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/facilities" element={<FacilitiesPage />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/trucks" element={<TrucksCrews />} />
            <Route path="/migration" element={<MigrationOnboarding />} />
            <Route path="/settings" element={<AdminSettings />} />
            <Route path="/account" element={<AccountSettings />} />
            {/* Crew routes for dispatchers with cert + crew assignment */}
            <Route path="/crew-dashboard" element={<CrewRouteGate><CrewDashboard /></CrewRouteGate>} />
            <Route path="/crew-patients" element={<CrewRouteGate><CrewPatients /></CrewRouteGate>} />
            <Route path="/pcr" element={<CrewRouteGate><PCRPage /></CrewRouteGate>} />
            <Route path="/crew-checklist" element={<CrewRouteGate><CrewInspectionChecklist /></CrewRouteGate>} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SchedulingProvider>
      </HipaaAcknowledgmentGate>
    );
  }

  // Biller role — completed trips + claims + compliance + facilities
  if (role === "biller") {
    return (
      <HipaaAcknowledgmentGate>
        <SchedulingProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/trips" replace />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/trips" element={<TripsAndClinical />} />
            <Route path="/billing" element={<BillingAndClaims />} />
            <Route path="/edi-export" element={<EDIExport />} />
            <Route path="/remittance-import" element={<RemittanceImport />} />
            <Route path="/compliance" element={<ComplianceAndQA />} />
            <Route path="/facilities" element={<FacilitiesPage />} />
            <Route path="/reports" element={<ReportsAndMetrics />} />
            <Route path="/account" element={<AccountSettings />} />
            {/* Crew routes for billers with cert + crew assignment */}
            <Route path="/crew-dashboard" element={<CrewRouteGate><CrewDashboard /></CrewRouteGate>} />
            <Route path="/crew-patients" element={<CrewRouteGate><CrewPatients /></CrewRouteGate>} />
            <Route path="/crew-schedule" element={<CrewRouteGate><CrewSchedulePage /></CrewRouteGate>} />
            <Route path="/pcr" element={<CrewRouteGate><PCRPage /></CrewRouteGate>} />
            <Route path="/crew-checklist" element={<CrewRouteGate><CrewInspectionChecklist /></CrewRouteGate>} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SchedulingProvider>
      </HipaaAcknowledgmentGate>
    );
  }

  // Admin role — full access
  return (
    <SchedulingProvider>
      <Routes>
        <Route path="/pending-approval" element={<PendingApproval />} />
        <Route path="/onboarding" element={<OnboardingWizard />} />
        <Route path="/trial-expired" element={<TrialExpired />} />
        <Route path="/" element={<DispatchBoard />} />
        <Route path="/scheduling" element={<Scheduling />} />
        <Route path="/crew-schedule" element={<CrewScheduleAdmin />} />
        <Route path="/crew/:token" element={<DailyRunSheet />} />
        <Route path="/runs" element={<Runs />} />
        <Route path="/patients" element={<Patients />} />
        <Route path="/trips" element={<TripsAndClinical />} />
        <Route path="/billing" element={<BillingAndClaims />} />
        <Route path="/edi-export" element={<EDIExport />} />
        <Route path="/remittance-import" element={<RemittanceImport />} />
        <Route path="/owner-dashboard" element={<OwnerDashboard />} />
        <Route path="/compliance" element={<ComplianceAndQA />} />
        <Route path="/facilities" element={<FacilitiesPage />} />
        <Route path="/reports" element={<ReportsAndMetrics />} />
        <Route path="/migration" element={<MigrationOnboarding />} />
        <Route path="/simulation" element={<Navigate to="/" replace />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/trucks" element={<TrucksCrews />} />
        <Route path="/settings" element={<AdminSettings />} />
        <Route path="/override-monitor" element={<OverrideMonitor />} />
        <Route path="/account" element={<AccountSettings />} />
        {/* Crew routes for owners with cert + crew assignment */}
        <Route path="/crew-dashboard" element={<CrewRouteGate><CrewDashboard /></CrewRouteGate>} />
        <Route path="/crew-patients" element={<CrewRouteGate><CrewPatients /></CrewRouteGate>} />
        <Route path="/pcr" element={<CrewRouteGate><PCRPage /></CrewRouteGate>} />
        <Route path="/crew-checklist" element={<CrewRouteGate><CrewInspectionChecklist /></CrewRouteGate>} />
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

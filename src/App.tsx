import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { toast } from "@/hooks/use-toast";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { SchedulingProvider } from "@/hooks/useSchedulingStore";
import { SimulationSessionProvider } from "@/hooks/useSimulationSession";
import { HipaaAcknowledgmentGate } from "@/components/compliance/HipaaAcknowledgmentGate";
// Eagerly load only what's needed for first paint on the public/auth path.
import Login from "./pages/Login";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Everything else is lazy. The browser only fetches the chunk for the
// route a user actually visits, dramatically cutting initial JS parse time
// (which was the main cause of the "page is slow" freezes).
const DispatchBoard = lazy(() => import("./pages/DispatchBoard"));
const Patients = lazy(() => import("./pages/Patients"));
const Employees = lazy(() => import("./pages/Employees"));
const TrucksCrews = lazy(() => import("./pages/TrucksCrews"));
const Runs = lazy(() => import("./pages/Runs"));
const Scheduling = lazy(() => import("./pages/Scheduling"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const CrewScheduleAdmin = lazy(() => import("./pages/CrewScheduleAdmin"));
const DailyRunSheet = lazy(() => import("./pages/DailyRunSheet"));
const TripsAndClinical = lazy(() => import("./pages/TripsAndClinical"));
const BillingAndClaims = lazy(() => import("./pages/BillingAndClaims"));
const ComplianceAndQA = lazy(() => import("./pages/ComplianceAndQA"));
const FacilitiesPage = lazy(() => import("./pages/FacilitiesPage"));
const ReportsAndMetrics = lazy(() => import("./pages/ReportsAndMetrics"));
const MigrationOnboarding = lazy(() => import("./pages/MigrationOnboarding"));
const SystemCreatorDashboard = lazy(() => import("./pages/SystemCreatorDashboard"));
const CompanySignup = lazy(() => import("./pages/CompanySignup"));
const PendingApproval = lazy(() => import("./pages/PendingApproval"));
const CreatorConsole = lazy(() => import("./pages/CreatorConsole"));
const CreatorSettings = lazy(() => import("./pages/CreatorSettings"));
const SimulationLab = lazy(() => import("./pages/SimulationLab"));
const CrewUIPreview = lazy(() => import("./pages/CrewUIPreview"));
const OverrideMonitor = lazy(() => import("./pages/OverrideMonitor"));
const EmailActivity = lazy(() => import("./pages/EmailActivity"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const CreateCompany = lazy(() => import("./pages/CreateCompany"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ForgotEmail = lazy(() => import("./pages/ForgotEmail"));
const CreatorRecovery = lazy(() => import("./pages/CreatorRecovery"));
const SuspendedPage = lazy(() => import("./pages/SuspendedPage"));
const CrewDashboard = lazy(() => import("./pages/CrewDashboard"));
const PCRPage = lazy(() => import("./pages/PCRPage"));
const CrewPatients = lazy(() => import("./pages/crew/CrewPatients"));
const CrewSchedulePage = lazy(() => import("./pages/crew/CrewSchedule"));
const OnboardingWizard = lazy(() => import("./pages/OnboardingWizard"));
const TrialExpired = lazy(() => import("./pages/TrialExpired"));
const CompletePayment = lazy(() => import("./pages/CompletePayment"));
const EDIExport = lazy(() => import("./pages/EDIExport"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const RemittanceImport = lazy(() => import("./pages/RemittanceImport"));
const OwnerDashboard = lazy(() => import("./pages/OwnerDashboard"));
const ARCommandCenter = lazy(() => import("./pages/ARCommandCenter"));
const CrewInspectionChecklist = lazy(() => import("./components/inspection/CrewInspectionChecklist"));
import { useCrewViewEligibility } from "./hooks/useCrewViewEligibility";
import { MaintenanceGate } from "./components/MaintenanceGate";

// Lightweight fallback shown while a route chunk is downloading. Stays
// visually consistent with the app's existing loading screens.
function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

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

/**
 * Watches for `?payment=success` (or `?payment=cancelled`) on any route and
 * surfaces a toast / banner to the user. Used by the Stripe checkout
 * success_url + cancel_url flow.
 */
function PaymentResultHandler() {
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshOnboardingStatus } = useAuth();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const result = params.get("payment");
    if (!result) return;
    if (result === "success") {
      toast({
        title: "Welcome to PodDispatch",
        description: "Your subscription is active.",
      });
      // Pull the latest onboarding_status (webhook flips it to `active`).
      refreshOnboardingStatus().catch(() => {});
      // Stripe redirects to /onboarding?payment=success after checkout.
      // The webhook flips the company gate to `active`; once auth state
      // refreshes, the wizard-completion gate will route the owner into
      // the Getting Started (Onboarding) wizard automatically.
      params.delete("payment");
      const cleanSearch = params.toString();
      navigate(
        { pathname: "/onboarding", search: cleanSearch ? `?${cleanSearch}` : "" },
        { replace: true },
      );
      return;
    } else if (result === "cancelled") {
      toast({
        title: "Checkout cancelled",
        description: "You can subscribe again whenever you're ready.",
        variant: "destructive",
      });
    }
    params.delete("payment");
    const search = params.toString();
    navigate(
      { pathname: location.pathname, search: search ? `?${search}` : "" },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);
  return null;
}

function AppRoutes() {
  const { user, role, loading, membershipLoaded, isSystemCreator, onboardingStatus, activeCompanyId, subscriptionStatus, wizardCompleted, passwordRecoveryMode } = useAuth();
  const location = useLocation();
  const isPasswordRecoveryFlow =
    passwordRecoveryMode ||
    location.pathname === "/reset-password" ||
    location.hash.includes("type=recovery") ||
    new URLSearchParams(location.search).get("type") === "recovery" ||
    new URLSearchParams(location.search).has("token_hash");

  // Show loading while auth session OR membership data is still resolving
  if (!isPasswordRecoveryFlow && (loading || (user && !membershipLoaded))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  // Password recovery must stay public/auth-agnostic. Recovery links create a
  // temporary session, so role-based routing would otherwise send creators to
  // /system or show the app 404 before they can set a new password.
  if (isPasswordRecoveryFlow) {
    return (
      <Routes>
        <Route path="*" element={<ResetPassword />} />
      </Routes>
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
        <Route path="/creator-recovery" element={<CreatorRecovery />} />
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

  // Approved by admin but payment not yet completed — gate behind Stripe checkout.
  // Must come BEFORE the generic pending-approval gate below, otherwise
  // approved_pending_payment would be routed to /pending-approval.
  if (!isSystemCreator && onboardingStatus === "approved_pending_payment") {
    return (
      <Routes>
        <Route path="/complete-payment" element={<CompletePayment />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/complete-payment" replace />} />
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
          {/*
            Allow the production pages that the onboarding wizard links to.
            Without these, navigate("/patients") etc. from the wizard would
            hit the catch-all below and bounce back to /onboarding, making
            the "Go to ..." buttons appear broken. The wizard's focus
            listener auto-detects completion when the user returns.
            DO NOT remove these without also redesigning the wizard CTAs.
          */}
          <Route path="/patients" element={<Patients />} />
          <Route path="/trucks" element={<TrucksCrews />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/billing" element={<BillingAndClaims />} />
          <Route path="/settings" element={<AdminSettings />} />
          <Route path="/legal" element={<LegalPage />} />
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
          <Route path="/creator-settings" element={<CreatorSettings />} />
          <Route path="/simulation-lab" element={<SimulationLab />} />
          <Route path="/crew-preview" element={<CrewUIPreview />} />
          <Route path="/override-monitor" element={<OverrideMonitor />} />
          <Route path="/crew-dashboard" element={<CrewDashboard />} />
          <Route path="/admin/email-activity" element={<EmailActivity />} />
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
          <Route path="/legal" element={<LegalPage />} />
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
          <Route path="/legal" element={<LegalPage />} />
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
            <Route path="/dispatch" element={<DispatchBoard />} />
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
            <Route path="/legal" element={<LegalPage />} />
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
            <Route path="/ar-command-center" element={<ARCommandCenter />} />
            <Route path="/edi-export" element={<EDIExport />} />
            <Route path="/remittance-import" element={<RemittanceImport />} />
            <Route path="/compliance" element={<ComplianceAndQA />} />
            <Route path="/facilities" element={<FacilitiesPage />} />
            <Route path="/reports" element={<ReportsAndMetrics />} />
            <Route path="/account" element={<AccountSettings />} />
            <Route path="/legal" element={<LegalPage />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
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
        {/* Owners land on a role-aware redirector; per the audit, the
         * Lovable placeholder Index is replaced with role-based routing. */}
        <Route path="/" element={<Index />} />
        <Route path="/dispatch" element={<DispatchBoard />} />
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
        <Route path="/dashboard" element={<OwnerDashboard />} />
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
        <Route path="/admin/email-activity" element={<EmailActivity />} />
        <Route path="/legal" element={<LegalPage />} />
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
            <MaintenanceGate>
              <PaymentResultHandler />
              <AppRoutes />
            </MaintenanceGate>
          </SimulationSessionProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

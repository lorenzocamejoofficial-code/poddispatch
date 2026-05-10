import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/**
 * Role-based home redirector. Each role lands on the home that makes sense
 * for their job. Owners who haven't completed the onboarding wizard are
 * routed to the wizard first.
 *
 * The auth/wizard/subscription gating that runs higher up in App.tsx already
 * handles the "not logged in", "pending approval", "trial expired", and
 * "wizard not completed" cases — so by the time this component renders for
 * an owner, the wizard is already known to be complete.
 */
const Index = () => {
  const { role, isSystemCreator, loading, membershipLoaded } = useAuth();

  if (loading || !membershipLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isSystemCreator) return <Navigate to="/system" replace />;

  switch (role) {
    case "creator":
    case "owner":
    case "manager":
      return <Navigate to="/owner-dashboard" replace />;
    case "dispatcher":
      return <Navigate to="/dispatch" replace />;
    case "biller":
      return <Navigate to="/billing" replace />;
    case "crew":
      return <Navigate to="/crew-dashboard" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
};

export default Index;

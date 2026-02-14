import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { SchedulingProvider } from "@/hooks/useSchedulingStore";
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

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Public route: crew share link (no auth required)
  // This needs to be outside auth checks

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/crew/:token" element={<DailyRunSheet />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Crew role
  if (role === "crew") {
    return (
      <Routes>
        <Route path="/" element={<CrewView />} />
        <Route path="/crew/:token" element={<DailyRunSheet />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Admin role
  return (
    <SchedulingProvider>
      <Routes>
        <Route path="/" element={<DispatchBoard />} />
        <Route path="/scheduling" element={<Scheduling />} />
        <Route path="/crew-schedule" element={<CrewScheduleAdmin />} />
        <Route path="/crew/:token" element={<DailyRunSheet />} />
        <Route path="/runs" element={<Runs />} /> {/* legacy */}
        <Route path="/patients" element={<Patients />} />
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
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

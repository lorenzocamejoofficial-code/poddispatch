import { useState, useEffect, useRef, createContext, useContext, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// HIPAA: Session automatically expires after this many milliseconds of inactivity.
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_MS = 5 * 60 * 1000;       // warn 5 min before expiry
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;

export type MembershipRole = "creator" | "owner" | "dispatcher" | "biller" | "crew";
export type OnboardingStatus = "signup_started" | "agreements_accepted" | "payment_pending" | "payment_confirmed" | "pending_approval" | "active" | "rejected" | "suspended" | "payment_issue";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: MembershipRole | null;
  activeCompanyId: string | null;
  profileId: string | null;
  loading: boolean;
  membershipLoaded: boolean;
  sessionWarning: boolean;
  isSystemCreator: boolean;
  onboardingStatus: OnboardingStatus | null;
  subscriptionStatus: string | null;
  wizardCompleted: boolean | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshOnboardingStatus: () => Promise<void>;
  isAdmin: boolean;
  isOwner: boolean;
  isDispatcher: boolean;
  isBilling: boolean;
  isCrew: boolean;
  isCreator: boolean;
  canManageTrips: boolean;
  canManageBilling: boolean;
  canManagePatients: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<MembershipRole | null>(null);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [membershipLoaded, setMembershipLoaded] = useState(false);
  const [sessionWarning, setSessionWarning] = useState(false);
  const [isSystemCreator, setIsSystemCreator] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [wizardCompleted, setWizardCompleted] = useState<boolean | null>(null);

  // HIPAA: inactivity timeout refs
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userRef = useRef<User | null>(null);
  // Guard to prevent onAuthStateChange from running before getSession completes
  const sessionInitialized = useRef(false);

  const loadUserData = async (userId: string) => {
    const [{ data: membershipData }, { data: profileData }, { data: scData }] = await Promise.all([
      supabase.from("company_memberships").select("company_id, role").eq("user_id", userId).limit(1).maybeSingle(),
      supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle(),
      supabase.from("system_creators").select("id").eq("user_id", userId).maybeSingle(),
    ]);
    if (membershipData) {
      setRole(membershipData.role as MembershipRole);
      setActiveCompanyId(membershipData.company_id);
      const { data: companyData } = await supabase
        .from("companies")
        .select("onboarding_status")
        .eq("id", membershipData.company_id)
        .maybeSingle();
      if (companyData) {
        setOnboardingStatus(companyData.onboarding_status as OnboardingStatus);
      }
    }
    if (profileData) setProfileId(profileData.id);
    setIsSystemCreator(!!scData);
    setMembershipLoaded(true);
  };

  const refreshOnboardingStatus = useCallback(async () => {
    if (!activeCompanyId) return;
    const { data } = await supabase
      .from("companies")
      .select("onboarding_status")
      .eq("id", activeCompanyId)
      .maybeSingle();
    if (data) setOnboardingStatus(data.onboarding_status as OnboardingStatus);
  }, [activeCompanyId]);

  const doSignOut = useCallback(async () => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);
    setSessionWarning(false);
    await supabase.auth.signOut();
    setRole(null);
    setActiveCompanyId(null);
    setProfileId(null);
    setIsSystemCreator(false);
    setOnboardingStatus(null);
    setMembershipLoaded(false);
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (!userRef.current) return;

    setSessionWarning(false);
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);

    warningTimer.current = setTimeout(() => {
      setSessionWarning(true);
    }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS);

    inactivityTimer.current = setTimeout(() => {
      doSignOut();
    }, INACTIVITY_TIMEOUT_MS);
  }, [doSignOut]);

  // HIPAA: attach/detach activity listeners based on login state
  useEffect(() => {
    userRef.current = user;
    if (user) {
      resetInactivityTimer();
      ACTIVITY_EVENTS.forEach((evt) =>
        window.addEventListener(evt, resetInactivityTimer, { passive: true })
      );
    } else {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      if (warningTimer.current) clearTimeout(warningTimer.current);
      setSessionWarning(false);
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, resetInactivityTimer)
      );
    }
    return () => {
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, resetInactivityTimer)
      );
    };
  }, [user, resetInactivityTimer]);

  useEffect(() => {
    // CRITICAL: Set up onAuthStateChange FIRST (as required by Supabase docs),
    // but gate it so it only processes events AFTER getSession has completed.
    // This prevents the INITIAL_SESSION event from clearing state before
    // the persisted session is restored from storage.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        // Skip events until getSession has initialized the baseline
        if (!sessionInitialized.current) return;

        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          // Use setTimeout to avoid calling Supabase inside the callback (deadlock prevention)
          setTimeout(() => {
            loadUserData(newSession.user.id).finally(() => setLoading(false));
          }, 0);
        } else {
          setRole(null);
          setActiveCompanyId(null);
          setProfileId(null);
          setIsSystemCreator(false);
          setOnboardingStatus(null);
          setMembershipLoaded(false);
          setLoading(false);
        }
      }
    );

    // THEN call getSession to restore the persisted session from storage.
    // This is the source of truth for the initial auth state.
    supabase.auth.getSession().then(({ data: { session: restoredSession } }) => {
      // Mark initialization complete so future onAuthStateChange events process normally
      sessionInitialized.current = true;

      setSession(restoredSession);
      setUser(restoredSession?.user ?? null);
      if (restoredSession?.user) {
        loadUserData(restoredSession.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await doSignOut();
  };

  // Derived role checks
  const isCreator = role === "creator";
  const isOwner = role === "owner";
  const isAdmin = isOwner || isCreator;
  const isDispatcher = role === "dispatcher" || isAdmin;
  const isBilling = role === "biller" || isAdmin;
  const isCrew = role === "crew";
  const canManageTrips = isAdmin || role === "dispatcher";
  const canManageBilling = isAdmin || role === "biller";
  const canManagePatients = isAdmin || role === "dispatcher";

  return (
    <AuthContext.Provider value={{
      user, session, role, activeCompanyId, profileId, loading, membershipLoaded, sessionWarning, isSystemCreator, onboardingStatus, signIn, signOut, refreshOnboardingStatus,
      isAdmin, isOwner, isDispatcher, isBilling, isCrew, isCreator,
      canManageTrips, canManageBilling, canManagePatients,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

import { useState, useEffect, useRef, createContext, useContext, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// HIPAA: Session automatically expires after this many milliseconds of inactivity.
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_MS = 5 * 60 * 1000;       // warn 5 min before expiry
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;
const PASSWORD_RECOVERY_STORAGE_KEY = "poddispatch_password_recovery";

// Throttle activity-driven inactivity timer resets. Without this, every
// mousemove/scroll event triggered clearTimeout+setTimeout AND a React state
// setter (setSessionWarning), causing AuthProvider — which sits above the
// entire app — to re-render hundreds of times per second during normal mouse
// use. Firefox would then surface "this page is slowing down" warnings and
// the UI would visibly freeze. We only need to reset the timer at most once
// every few seconds; that is more than precise enough for a 30-minute idle
// gate.
const ACTIVITY_THROTTLE_MS = 5_000;

function hasPasswordRecoveryMarker() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return (
    window.location.pathname === "/reset-password" ||
    window.location.hash.includes("type=recovery") ||
    params.get("type") === "recovery" ||
    params.has("token_hash")
  );
}

export type MembershipRole = "creator" | "owner" | "manager" | "dispatcher" | "biller" | "crew";
export type OnboardingStatus = "signup_started" | "agreements_accepted" | "payment_pending" | "payment_confirmed" | "pending_approval" | "approved_pending_payment" | "active" | "rejected" | "suspended" | "payment_issue";

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
  refreshWizardStatus: () => Promise<void>;
  passwordRecoveryMode: boolean;
  setPasswordRecoveryMode: (active: boolean) => void;
  isAdmin: boolean;
  isOwner: boolean;
  isOwnerOrCreator: boolean;
  isManager: boolean;
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
  const [passwordRecoveryMode, setPasswordRecoveryModeState] = useState(() => {
    if (hasPasswordRecoveryMarker()) return true;
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(PASSWORD_RECOVERY_STORAGE_KEY) === "true";
  });

  // HIPAA: inactivity timeout refs
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userRef = useRef<User | null>(null);
  // Track when we last reset the inactivity timer so we can throttle the
  // high-frequency events (mousemove/scroll) without re-rendering the whole
  // provider tree on every pixel of motion.
  const lastActivityResetRef = useRef<number>(0);
  // Track current warning state in a ref so the activity handler can avoid
  // calling the state setter (and triggering a re-render) when nothing has
  // actually changed.
  const sessionWarningRef = useRef(false);
  // Guard to prevent onAuthStateChange from running before getSession completes
  const sessionInitialized = useRef(false);

  const setPasswordRecoveryMode = useCallback((active: boolean) => {
    setPasswordRecoveryModeState(active);
    if (typeof window === "undefined") return;
    if (active) {
      window.sessionStorage.setItem(PASSWORD_RECOVERY_STORAGE_KEY, "true");
    } else {
      window.sessionStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
    }
  }, []);

  const loadUserData = async (userId: string) => {
    const [{ data: membershipData }, { data: profileData }, { data: scData }] = await Promise.all([
      supabase.from("company_memberships").select("company_id, role").eq("user_id", userId).limit(1).maybeSingle(),
      supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle(),
      supabase.from("system_creators").select("id").eq("user_id", userId).maybeSingle(),
    ]);
    if (membershipData) {
      setRole(membershipData.role as MembershipRole);
      setActiveCompanyId(membershipData.company_id);
      const [{ data: companyData }, { data: subData }, { data: migData }] = await Promise.all([
        supabase.from("companies").select("onboarding_status").eq("id", membershipData.company_id).maybeSingle(),
        supabase.from("subscription_records").select("subscription_status").eq("company_id", membershipData.company_id).maybeSingle(),
        supabase.from("migration_settings").select("wizard_completed").eq("company_id", membershipData.company_id).maybeSingle(),
      ]);
      if (companyData) setOnboardingStatus(companyData.onboarding_status as OnboardingStatus);
      setSubscriptionStatus(subData?.subscription_status ?? null);
      setWizardCompleted(migData ? (migData as any).wizard_completed : null);
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

  const refreshWizardStatus = useCallback(async () => {
    if (!activeCompanyId) return;
    const { data } = await supabase
      .from("migration_settings")
      .select("wizard_completed")
      .eq("company_id", activeCompanyId)
      .maybeSingle();
    if (data) setWizardCompleted((data as any).wizard_completed);
  }, [activeCompanyId]);

  const doSignOut = useCallback(async () => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);
    sessionWarningRef.current = false;
    setSessionWarning(false);
    await supabase.auth.signOut();
    setRole(null);
    setActiveCompanyId(null);
    setProfileId(null);
    setIsSystemCreator(false);
    setOnboardingStatus(null);
    setSubscriptionStatus(null);
    setWizardCompleted(null);
    setMembershipLoaded(false);
    setPasswordRecoveryMode(false);
  }, [setPasswordRecoveryMode]);

  const resetInactivityTimer = useCallback(() => {
    if (!userRef.current) return;

    // Throttle: only do real work every ACTIVITY_THROTTLE_MS. This is the
    // critical perf fix — mousemove fires 60+ times/sec and previously each
    // event cleared+recreated two timers AND called a React setState.
    const now = Date.now();
    if (now - lastActivityResetRef.current < ACTIVITY_THROTTLE_MS) return;
    lastActivityResetRef.current = now;

    // Only call the state setter if the warning is actually showing.
    // Avoids a provider-wide re-render on every throttled tick.
    if (sessionWarningRef.current) {
      sessionWarningRef.current = false;
      setSessionWarning(false);
    }
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);

    warningTimer.current = setTimeout(() => {
      sessionWarningRef.current = true;
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
      // Reset throttle so the initial arm runs immediately.
      lastActivityResetRef.current = 0;
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
      (event, newSession) => {
        if (event === "PASSWORD_RECOVERY") {
          setPasswordRecoveryMode(true);
          if (window.location.pathname !== "/reset-password") {
            window.history.replaceState({}, "", "/reset-password");
          }
        }

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
  const isManager = role === "manager";
  // NARROW: only owner/creator (legal owner of the company). Used for
  // subscription, NPI/EIN, role assignment, support correspondence,
  // clearinghouse credentials. Manager does NOT pass.
  const isOwnerOrCreator = isOwner || isCreator;
  // BROAD admin tier: owner/creator/manager.
  const isAdmin = isOwnerOrCreator || isManager;
  const isDispatcher = role === "dispatcher" || isAdmin;
  const isBilling = role === "biller" || isAdmin;
  const isCrew = role === "crew";
  const canManageTrips = isAdmin || role === "dispatcher";
  const canManageBilling = isAdmin || role === "biller";
  const canManagePatients = isAdmin || role === "dispatcher";

  return (
    <AuthContext.Provider value={{
      user, session, role, activeCompanyId, profileId, loading, membershipLoaded, sessionWarning, isSystemCreator, onboardingStatus, subscriptionStatus, wizardCompleted, signIn, signOut, refreshOnboardingStatus, refreshWizardStatus, passwordRecoveryMode, setPasswordRecoveryMode,
      isAdmin, isOwner, isDispatcher, isBilling, isCrew, isCreator,
      isOwnerOrCreator, isManager,
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

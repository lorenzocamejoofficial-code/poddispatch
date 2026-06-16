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

export interface MembershipSummary {
  company_id: string;
  company_name: string;
  role: MembershipRole;
}

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
  memberships: MembershipSummary[];
  needsCompanySelection: boolean;
  switchCompany: (companyId: string) => Promise<{ error: string | null }>;
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
  const [memberships, setMemberships] = useState<MembershipSummary[]>([]);
  const [needsCompanySelection, setNeedsCompanySelection] = useState(false);
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
  // Tracks the timestamp (ms) of the most recent local switchCompany() call.
  // The realtime profile subscription uses this to suppress a redundant
  // reload in the originating tab — switchCompany() already issues its own
  // window.location.assign("/"), so the echoed UPDATE event would otherwise
  // trigger a second reload. Other tabs (where lastSwitchAtRef stays 0)
  // reload normally to stay in sync.
  const lastSwitchAtRef = useRef<number>(0);
  // Before reading membership/profile routing state, claim any employee invite
  // whose email matches the signed-in account. This prevents already-existing
  // users from landing in their old/pending company instead of the crew role
  // assigned from Employees.
  const inviteClaimAttemptedForRef = useRef<Set<string>>(new Set());

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
    if (!inviteClaimAttemptedForRef.current.has(userId)) {
      inviteClaimAttemptedForRef.current.add(userId);
      await supabase.functions.invoke("claim-employee-invites").catch(() => {
        // Non-fatal: normal membership loading below still decides routing.
      });
    }

    // Single query: memberships JOIN companies (for switcher labels).
    // Filter out memberships whose company has been soft-deleted.
    const [
      { data: membershipRows },
      { data: profileData },
      { data: scData },
    ] = await Promise.all([
      supabase
        .from("company_memberships")
        .select("company_id, role, companies:company_id(id, name, deleted_at)")
        .eq("user_id", userId),
      supabase
        .from("profiles")
        .select("id, active_company_id")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase.from("system_creators").select("id").eq("user_id", userId).maybeSingle(),
    ]);

    if (profileData) setProfileId(profileData.id);
    setIsSystemCreator(!!scData);

    const liveMemberships: MembershipSummary[] = (membershipRows ?? [])
      .filter((m: any) => m.companies && !m.companies.deleted_at)
      .map((m: any) => ({
        company_id: m.company_id,
        company_name: m.companies?.name ?? "Unnamed company",
        role: m.role as MembershipRole,
      }));
    setMemberships(liveMemberships);

    // Resolve active company:
    //   - profiles.active_company_id if it points to a live membership
    //   - else: single membership auto-selects
    //   - else: needs explicit selection
    let resolvedCompanyId: string | null = null;
    const profileActive = (profileData as any)?.active_company_id ?? null;
    if (profileActive && liveMemberships.some((m) => m.company_id === profileActive)) {
      resolvedCompanyId = profileActive;
    } else if (liveMemberships.length === 1) {
      resolvedCompanyId = liveMemberships[0].company_id;
      // Backfill profile so server-side get_my_company_id() agrees.
      if (profileData?.id) {
        await supabase
          .from("profiles")
          .update({ active_company_id: resolvedCompanyId } as any)
          .eq("id", profileData.id);
      }
    }

    if (resolvedCompanyId) {
      const activeMembership = liveMemberships.find((m) => m.company_id === resolvedCompanyId)!;
      setRole(activeMembership.role);
      setActiveCompanyId(resolvedCompanyId);
      setNeedsCompanySelection(false);
      const [{ data: companyData }, { data: subData }, { data: migData }] = await Promise.all([
        supabase.from("companies").select("onboarding_status").eq("id", resolvedCompanyId).maybeSingle(),
        supabase.from("subscription_records").select("subscription_status, trial_ends_at, trial_started_at, trial_skipped").eq("company_id", resolvedCompanyId).maybeSingle(),
        supabase.from("migration_settings").select("wizard_completed").eq("company_id", resolvedCompanyId).maybeSingle(),
      ]);
      if (companyData) setOnboardingStatus(companyData.onboarding_status as OnboardingStatus);

      // App-side trial timer model:
      //   trial_skipped       → straight to payment (no trial granted).
      //   trial_pending_start → not yet visited; start the timer now via edge fn.
      //   trial_started_at + 30d in the past → expired.
      const sub: any = subData ?? {};
      let effectiveStatus: string | null = sub.subscription_status ?? null;

      // Kick off the "start trial on first login" edge function. Fire & forget.
      if (effectiveStatus === "trial_pending_start" && !sub.trial_started_at) {
        supabase.functions.invoke("start-trial-timer-if-needed", {
          body: { company_id: resolvedCompanyId },
        }).catch(() => { /* non-fatal */ });
        // Optimistically treat as active trial in this session.
        effectiveStatus = "trial_active";
      }

      // Compute expiry from trial_started_at + 30 days (new model), with
      // backward-compat fallback to trial_ends_at for legacy rows.
      const startedAt = sub.trial_started_at ? new Date(sub.trial_started_at).getTime() : null;
      const legacyEnd = sub.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : null;
      const effectiveEnd =
        startedAt != null ? startedAt + 30 * 24 * 60 * 60 * 1000 : legacyEnd;
      if (
        (effectiveStatus === "trial" || effectiveStatus === "trial_active" || effectiveStatus === "TEST_ACTIVE") &&
        effectiveEnd != null && effectiveEnd <= Date.now()
      ) {
        effectiveStatus = "trial_expired";
      }
      setSubscriptionStatus(effectiveStatus);
      setWizardCompleted(migData ? (migData as any).wizard_completed : null);
    } else {
      setRole(null);
      setActiveCompanyId(null);
      setOnboardingStatus(null);
      setSubscriptionStatus(null);
      setWizardCompleted(null);
      // Multi-membership user with no active selection — gate to /select-company.
      // Creators bypass this naturally (system_creators check above).
      setNeedsCompanySelection(liveMemberships.length > 1 && !scData);
    }
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
    setMemberships([]);
    setNeedsCompanySelection(false);
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
          setMemberships([]);
          setNeedsCompanySelection(false);
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

  // Switch the active company. Persists to profiles.active_company_id, then
  // performs a hard reload so every in-memory tenant-scoped store
  // (SchedulingProvider, react-query cache, realtime channels) is wiped
  // cleanly. This is the deliberate "store reset" mechanism — a soft
  // setActiveCompanyId would leak prior-tenant data through subscriptions
  // and stale cached queries.
  const switchCompany = useCallback(async (companyId: string) => {
    if (!user) return { error: "Not authenticated" };
    // System creators may switch into a creator_test_tenant they don't have
    // a membership row for — the get_my_company_id() bypass resolves access
    // server-side. All other users must be explicit members.
    if (!memberships.some((m) => m.company_id === companyId) && !isSystemCreator) {
      return { error: "You are not a member of that company" };
    }
    if (!profileId) return { error: "Profile not loaded" };
    // Stamp BEFORE the write so the echoed realtime UPDATE in this tab
    // falls within the suppression window.
    lastSwitchAtRef.current = Date.now();
    const { error } = await supabase
      .from("profiles")
      .update({ active_company_id: companyId } as any)
      .eq("id", profileId);
    if (error) {
      lastSwitchAtRef.current = 0;
      return { error: error.message };
    }
    // Hard reload for full tenant-scope reset.
    if (typeof window !== "undefined") {
      window.location.assign("/");
    }
    return { error: null };
  }, [user, memberships, profileId, isSystemCreator]);

  // Cross-tab tenant-switch sync. When profiles.active_company_id changes
  // server-side (e.g. user picked a different company in another tab), any
  // other tab still rendering the old tenant's UI must reload — otherwise
  // it would show stale UI while every new server query resolves under
  // the new active_company_id (data-corruption risk).
  //
  // The originating tab is suppressed via lastSwitchAtRef so it doesn't
  // reload twice (switchCompany already called window.location.assign).
  // The channel is keyed by user.id and torn down on signout / unmount.
  useEffect(() => {
    if (!user || !profileId) return;
    const channel = supabase
      .channel(`profile-active-company-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newActive = (payload.new as any)?.active_company_id ?? null;
          const oldActive = (payload.old as any)?.active_company_id ?? null;
          // Only react to active_company_id changes; ignore name/phone edits.
          if (newActive === oldActive) return;
          // If the local UI already matches what the server now says, no-op.
          if (newActive === activeCompanyId) return;
          // Suppress the originating tab's echo (switchCompany already reloaded).
          if (Date.now() - lastSwitchAtRef.current < 2000) return;
          if (typeof window !== "undefined") {
            window.location.reload();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profileId, activeCompanyId]);

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
      user, session, role, activeCompanyId, profileId, loading, membershipLoaded, sessionWarning, isSystemCreator, onboardingStatus, subscriptionStatus, wizardCompleted,
      memberships, needsCompanySelection, switchCompany,
      signIn, signOut, refreshOnboardingStatus, refreshWizardStatus, passwordRecoveryMode, setPasswordRecoveryMode,
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

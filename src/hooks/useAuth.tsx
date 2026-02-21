import { useState, useEffect, useRef, createContext, useContext, ReactNode, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// HIPAA: Session automatically expires after this many milliseconds of inactivity.
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_MS = 2 * 60 * 1000;       // warn 2 min before expiry
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;

type AppRole = "admin" | "crew" | "dispatcher" | "billing";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profileId: string | null;
  loading: boolean;
  sessionWarning: boolean;
  isSystemCreator: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  // Role convenience checks
  isAdmin: boolean;
  isDispatcher: boolean;
  isBilling: boolean;
  isCrew: boolean;
  canManageTrips: boolean;    // admin or dispatcher
  canManageBilling: boolean;  // admin or billing
  canManagePatients: boolean; // admin or dispatcher
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionWarning, setSessionWarning] = useState(false);
  const [isSystemCreator, setIsSystemCreator] = useState(false);

  // HIPAA: inactivity timeout refs
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userRef = useRef<User | null>(null);

  const loadUserData = async (userId: string) => {
    const [{ data: roleData }, { data: profileData }, { data: scData }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle(),
      supabase.from("system_creators").select("id").eq("user_id", userId).maybeSingle(),
    ]);
    if (roleData) setRole(roleData.role as AppRole);
    if (profileData) setProfileId(profileData.id);
    setIsSystemCreator(!!scData);
  };

  // HIPAA: sign out and clear all session data
  const doSignOut = useCallback(async () => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);
    setSessionWarning(false);
    await supabase.auth.signOut();
    setRole(null);
    setProfileId(null);
    setIsSystemCreator(false);
  }, []);

  // HIPAA: reset inactivity timers on user activity
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => {
            loadUserData(session.user.id).finally(() => setLoading(false));
          }, 0);
        } else {
          setRole(null);
          setProfileId(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id).finally(() => setLoading(false));
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
  const isAdmin = role === "admin";
  const isDispatcher = role === "dispatcher";
  const isBilling = role === "billing";
  const isCrew = role === "crew";
  const canManageTrips = isAdmin || isDispatcher;
  const canManageBilling = isAdmin || isBilling;
  const canManagePatients = isAdmin || isDispatcher;

  return (
    <AuthContext.Provider value={{
      user, session, role, profileId, loading, sessionWarning, isSystemCreator, signIn, signOut,
      isAdmin, isDispatcher, isBilling, isCrew,
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

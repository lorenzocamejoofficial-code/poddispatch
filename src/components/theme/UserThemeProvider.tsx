import { useEffect, useRef } from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type ThemeChoice = "light" | "dark" | "system";
const VALID: ThemeChoice[] = ["light", "dark", "system"];

/**
 * Keeps the signed-in user's theme choice on their profile so it follows them
 * across devices and survives logout. Load-once on sign-in, then save on change.
 */
function ThemeSync({ userId }: { userId: string }) {
  const { theme, setTheme } = useTheme();
  const loaded = useRef(false);
  const lastSaved = useRef<string | null>(null);

  // Load the stored preference once per user.
  useEffect(() => {
    let cancelled = false;
    loaded.current = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("theme_preference")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      const stored = (data as { theme_preference?: string } | null)?.theme_preference;
      if (stored && VALID.includes(stored as ThemeChoice)) {
        lastSaved.current = stored;
        setTheme(stored);
      }
      loaded.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, setTheme]);

  // Save any later change back to the profile.
  useEffect(() => {
    if (!loaded.current || !theme) return;
    if (!VALID.includes(theme as ThemeChoice)) return;
    if (theme === lastSaved.current) return;
    lastSaved.current = theme;
    void supabase
      .from("profiles")
      .update({ theme_preference: theme })
      .eq("user_id", userId);
  }, [theme, userId]);

  return null;
}

export function UserThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const scope = user?.id ?? "guest";

  return (
    <ThemeProvider
      key={scope}
      attribute="class"
      defaultTheme="light"
      enableSystem
      storageKey={`poddispatch-theme:${scope}`}
    >
      {user?.id && <ThemeSync userId={user.id} />}
      {children}
    </ThemeProvider>
  );
}

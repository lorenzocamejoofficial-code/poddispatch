import { ThemeProvider } from "next-themes";
import { useAuth } from "@/hooks/useAuth";

/**
 * Theme is a personal preference, so it is stored per signed-in user on the
 * device (`poddispatch-theme:<user id>`). Remounting on user change makes
 * next-themes re-read the new user's key, so one person's night mode never
 * carries over to the next person who signs in on the same browser.
 */
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
      {children}
    </ThemeProvider>
  );
}

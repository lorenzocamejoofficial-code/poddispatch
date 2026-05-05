import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

/** Reads ?focus=<key> from the URL, scrolls the matching [data-focus="<key>"]
 *  element into view, and applies a short ring highlight. Idempotent — safe
 *  to call multiple times in the same component. */
export function useFocusScroll(deps: any[] = []) {
  const [params] = useSearchParams();
  const focus = params.get("focus");
  useEffect(() => {
    if (!focus) return;
    // Allow the page to render first
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-focus="${focus}"]`) as HTMLElement | null;
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-amber-500", "ring-offset-2", "rounded-md");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-amber-500", "ring-offset-2", "rounded-md");
      }, 2500);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, ...deps]);
}

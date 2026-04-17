/**
 * Tiny helper to debounce realtime refetches.
 * Returns a stable function (use inside useMemo/useCallback) that
 * coalesces rapid bursts of postgres_changes events into a single fetch.
 */
export function createDebouncer(fn: () => void, delay = 500) {
  let t: ReturnType<typeof setTimeout> | null = null;
  const debounced = () => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn();
    }, delay);
  };
  debounced.cancel = () => {
    if (t) {
      clearTimeout(t);
      t = null;
    }
  };
  return debounced;
}

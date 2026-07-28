## Fix Bug 2 — Re-check Status button feedback

Contained to `src/pages/OnboardingWizard.tsx`. Uses existing `toast` from `sonner` (already imported line 14) and existing `progress.completedCount` from the hook.

### Change 1 — `refreshAutoDetect` (lines 176–208)

**Before:** flips `step_rates_verified` and `return`s early on the rates path; only calls `progress.reload()` in the else branch.

**After:**
- Compute `ratesValid` as today.
- If `ratesValid && !progress.step_rates_verified`, call `progress.markStep("step_rates_verified", true)` — but do **not** return.
- **Always** call `await progress.reload()` at the end so all other steps re-detect on every click.
- Return the fresh `completedCount` (read via a second small select or by capturing `progress.completedCount` before/after using a ref/snapshot).

Implementation note: `progress.markStep` already calls `load()` internally, and `progress.reload()` also calls `load()`. To avoid a duplicate fetch, restructure to: capture `before = progress.completedCount`, run the rates check + persist if needed, call `progress.reload()` once, then compare `progress.completedCount` after the state settles. Since React state updates are async, use the return value of `reload()` isn't available — instead re-query the flags inline or trigger the toast in a `useEffect` that watches `completedCount`.

**Simpler approach chosen:** snapshot `before` at click time, `await progress.reload()` (single fetch), and read `after` from a ref that mirrors `progress.completedCount`. If `after > before` → success toast; else → info toast.

### Change 2 — Button (lines 424–426)

Add local `isRechecking` state. Button becomes:
```tsx
<Button variant="outline" disabled={isRechecking} onClick={handleRecheck}>
  {isRechecking ? "Checking…" : "Re-check status"}
</Button>
```

`handleRecheck` wraps `refreshAutoDetect` with `setIsRechecking(true)` → `await refreshAutoDetect()` → toast → `setIsRechecking(false)`.

### Toast copy
- Progress advanced: `toast.success("Setup progress updated.")`
- No change: `toast("No new progress detected yet.")`

### Out of scope
- Detection rules (Bug 1)
- Hook internals
- Other step behaviors, other buttons

### Verification
- Typecheck (`tsgo --noEmit`) passes.
- `progress.reload()` runs on every click regardless of rates outcome.
- Toast fires on both branches; button shows "Checking…" during the async run.

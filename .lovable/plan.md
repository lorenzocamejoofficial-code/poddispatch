## Fix Bug 3 — persistent "Continue Setup" affordance

### (a) Where to mount
`src/components/layout/AdminLayout.tsx` wraps every authenticated admin/owner/dispatcher/billing production page (billing, trucks, employees, facilities, patients, dispatch, etc.). Mount a small floating button here so it appears on every production page without editing each one.

Placement: a fixed, bottom-right pill button (`fixed bottom-4 right-4 z-40`) reading `Continue Setup →`, using existing `Button` + `Rocket`/`ArrowRight` icon. Unobtrusive, doesn't cover content, works on mobile.

Not reusing `OnboardingChecklist` component directly — it's a full inline card designed for dashboard headers (already mounted on DispatchBoard and AdminSettings). A floating button is the cleaner pattern for a global affordance and avoids doubling up when the user is on those two pages.

### (b) Visibility conditions
Render only when ALL true:
- `isAdmin` (owner/admin role — matches `OnboardingChecklist`'s gate; onboarding is owner-scoped)
- `!progress.loading`
- `!progress.wizard_completed`
- `!progress.onboarding_dismissed`
- `location.pathname !== "/onboarding"` (don't show on the wizard itself)

Uses the existing `useOnboardingProgress` hook and `useAuth().isAdmin` — no new state system.

### (c) Auto-hide confirmed
`OnboardingChecklist` (lines 21–22) hides when `wizard_completed` or `onboarding_dismissed` are true; the new floating button will use the same flags, so completed operators never see it. (Note: the checklist's stale `completedCount === 5` gate is a separate bug — out of scope here; the `wizard_completed` flag is the authoritative gate and is already correctly derived in the hook.)

### (d) `?from=onboarding` back-button
Skipped as non-trivial: would require editing every production page's header to read the param and render a back link. The persistent floating button already covers the return-path need on every page with a single edit.

### Scope
- Edit: `src/components/layout/AdminLayout.tsx` only.
- No changes to wizard logic, detection, OnboardingChecklist component, or production pages.

### Verification
- Typecheck passes.
- Manually confirm: button visible on `/billing`, `/trucks`, etc. while onboarding incomplete; hidden on `/onboarding`; hidden after wizard completes or is dismissed; not shown to non-admin roles.

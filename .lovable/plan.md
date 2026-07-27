# Plan: Gate Simulation Templates UI to system creators only

## (a) Creator-role check to reuse

`useAuth()` from `@/hooks/useAuth` already exposes `isSystemCreator: boolean` (see `src/hooks/useAuth.tsx` line 87, set from the `system_creators` table lookup at line 160/164). This is the same flag `src/pages/Index.tsx` and the creator console use to gate creator-only surfaces. Reuse it — no new check.

In `src/pages/Patients.tsx` line 101, the existing destructure will be extended:
```
const { activeCompanyId, role, isSystemCreator } = useAuth();
```

## (b) JSX/logic blocks to wrap

All edits are inside `src/pages/Patients.tsx`. Four gates, all guarded by `isSystemCreator`:

1. **Templates view tabs bar** — lines 910–930 (the whole `<div className="flex items-center gap-1 border-b">` containing "All Patients" / "Simulation Templates" buttons). Wrap in `{isSystemCreator && ( ... )}`. Non-creators never see the tab strip.

2. **"Simulation Templates" description card** — lines 932–941 (`{templatesView && ( ... )}`). Change guard to `{isSystemCreator && templatesView && ( ... )}`. Belt-and-suspenders; `templatesView` can't become true without the tab anyway.

3. **"No simulation templates yet" info card** — lines 943–956. Change guard to `{isSystemCreator && !templatesView && patients.filter(...).length === 0 && ( ... )}`.

4. **Per-row "Template" toggle button** — lines 2083–2093 (the `<Button ...onClick={() => toggleTemplate(p)}>`). Wrap in `{isSystemCreator && ( ... )}`. Also wrap the small "Template" badge shown on the row at lines 1995–1999 (`{(p as any).is_template && ( ... )}`) with the same creator gate, so tenants don't even see the flag state on templated rows.

Also (defensive, still inside the same file): initialize `templatesView` state (line 106) as `useState(false)` — no change needed, but the filter at line 752 (`templatesView ? is_template === true : true`) is a no-op for non-creators since they can't flip the toggle. No logic change required beyond the four JSX gates above.

The `toggleTemplate` function (lines 791–802) stays untouched — dead code for non-creators, live for creators. Keeping it avoids touching non-UI logic.

## (c) Confirmation of scope

- Only `src/pages/Patients.tsx` is modified.
- No changes to patient CRUD, claim logic, billing, other tabs, other pages, or the auth hook.
- Simulation functionality is preserved for system creators.

## Assumption

"System creator" = `isSystemCreator` from `useAuth`, not the `creator` role (which is a company-level role). This matches how the rest of the app gates creator-only tooling. If you actually meant the company `creator` role too, say so and I'll add `|| role === "creator"`.

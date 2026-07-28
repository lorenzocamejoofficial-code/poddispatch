# Add "Add a Facility" step to Getting Started wizard

## Facilities route (verified)
`src/App.tsx` registers `FacilitiesPage` at path **`/facilities`** in every authenticated role branch (owner/admin line 542, dispatcher 498, biller 460, and the shared block at 402). Route: **`/facilities`**.

## Files touched (2)
1. `src/hooks/useOnboardingProgress.ts`
2. `src/pages/OnboardingWizard.tsx`

No other files.

---

## 1. `src/hooks/useOnboardingProgress.ts` — add `step_facility_added`

Mirror the exact `step_trucks_added` mechanism (count query against the `facilities` table scoped to `company_id`, OR-ed with any pre-existing DB flag), then include it in the auto-update block and the `completedCount` math.

**Type additions**
- Add `step_facility_added: boolean;` to the `OnboardingProgress` interface.
- Initialise it to `false` in the `useState` default.

**Detection (mirrors trucks exactly)**
In the `Promise.all([...])`, add:
```ts
supabase.from("facilities" as any).select("id", { count: "exact", head: true }).eq("company_id", activeCompanyId),
```
Destructure as `facilitiesRes`. Then:
```ts
const facilitiesExist = (facilitiesRes.count ?? 0) > 0;
const stepFacility = (settings as any).step_facility_added || facilitiesExist;
```
(Same shape as `trucksExist` / `stepTrucks`.)

**setProgress**: include `step_facility_added: stepFacility`.

**allComplete**: add `&& stepFacility` in the correct position (before patients).

**Auto-update block**:
```ts
if (stepFacility && !(settings as any).step_facility_added) updates.step_facility_added = true;
```

**`completedCount` array**: insert `progress.step_facility_added` between team-invited and patients-added. (Note: this hook's `completedCount` currently counts 6 items including clearinghouse; adding facility makes it 7. That's fine — this hook's count powers the sidebar `OnboardingChecklist`, not the wizard's math. Wizard uses its own local `stepDone`.)

Note: the `migration_settings` DB column `step_facility_added` may not exist. The `update({ step_facility_added: true })` call is cast `as any` and would fail silently at runtime if the column is missing, but the derived state still works from `facilitiesExist`, so completion detection still functions. If desired, a follow-up migration can add the column — out of scope for this fix per user's SCOPE constraint.

---

## 2. `src/pages/OnboardingWizard.tsx` — wire the new step

**Imports**: add `Hospital` to the lucide import (already-used icon set style).

**STEPS array**: insert **immediately before** the "Add Your First Patient" object:
```ts
{
  icon: Hospital,
  title: "Add a Facility",
  description: "Add the dialysis centers, hospitals, or nursing facilities your patients travel to.",
  blurb: "Patients need a drop-off destination. Add at least one facility so you can assign it when creating patients.",
  cta: "Go to Facilities",
  route: "/facilities",
  progressKey: "step_facility_added" as const,
},
```
Result: 6 entries, order = Company Info, Rates, Trucks, Crew, **Facility**, Patient.

**`stepDone` array**: insert `progress.step_facility_added` between `step_team_invited` and `step_patients_added`:
```ts
const stepDone = [
  progress.step_company_info_verified,
  progress.step_rates_verified,
  progress.step_trucks_added,
  progress.step_team_invited,
  progress.step_facility_added,
  progress.step_patients_added,
];
```

**Progress math**:
- `(completedCount / 5) * 100` → `/ 6`
- `completedCount === 5` → `=== 6`
- Label `"{completedCount} of 5 steps complete"` → `"of 6 steps complete"`

No other logic changes. The generic "STEPS 2–6" nav-card renderer already handles any non-first step via `step.route` + `step.cta`, so no per-step branching needed.

---

## Verification
- Typecheck clean.
- Wizard shows 6 chips, reaches 100% only when all 6 done.
- Facility step auto-completes when ≥1 row exists in `facilities` for the company (identical mechanism to trucks).

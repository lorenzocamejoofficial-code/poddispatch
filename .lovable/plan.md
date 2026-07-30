# AUDIT — Owner accessing the Crew side (read-only findings)

## (a) Does an owner-as-crew / view-switch mechanism exist?
**Effectively no.** The only "view switcher" file in the codebase is `src/components/creator/ViewAsSwitcher.tsx` (lines 13–66, roles `creator|owner|manager|dispatcher|biller|crew`) — and a repo-wide search shows **it is imported nowhere**. It is dead code, and by its own footer text (line 61) it was for *synthetic-data* creator previews, not real crew access.

Also present but unrelated to a real owner switch:
- `src/pages/CrewUIPreview.tsx:261` — "Open Crew View" button, on the **system-creator-only** `/crew-preview` route (`src/App.tsx:381`).
- No `viewMode`, `crewMode`, `activeRole`, or "act as" state exists anywhere (search returned only unrelated hits: `SignaturesCard.tsx:381 activeRoles`, help-content titles).

There is **no UI link from the admin side into the crew side**. `src/components/layout/AdminLayout.tsx` nav (line 90–91) only contains `/crew-schedule` ("Crew Schedule Delivery", the *admin* dispatch page) and `/trucks`. No `/crew-dashboard` or `/crew-certifications` entry for any admin role.

## (b) Role-gated or capability-gated?
**Both, in two layers.**

1. **Route registration is ROLE-gated** — `src/App.tsx` branches on `role`:
   - `isSystemCreator` (line 370): all crew routes, ungated (383–388, 393).
   - `role === "crew"` (line 425): home `/` = `CrewDashboard` (429); full crew set 430–436 including **`/crew-schedule` → `CrewSchedulePage`** (432).
   - `role === "dispatcher"` (line 448): home `/` = DispatchBoard; crew routes 469–473 wrapped in `CrewRouteGate`. **No `/crew-schedule` crew page** — line 457 maps `/crew-schedule` to the *admin* `CrewScheduleAdmin`.
   - `role === "biller"` (line 485): home `/` → `/trips`; crew routes 503–508, **including** `/crew-schedule` → `CrewRouteGate><CrewSchedulePage>` (505).
   - **Owner / manager fallback** (line 520–565): home `/` = `<Index />` (530). Crew routes 554–558: `/crew-dashboard`, `/crew-patients`, `/pcr`, `/crew-checklist` (all `CrewRouteGate`-wrapped) and `/crew-certifications` (ungated, 558).
   - Owner wizard-incomplete branch (line 340–364): **no crew routes at all**; `*` → `/onboarding` (360).

2. **Access within those routes is CAPABILITY-gated** — `CrewRouteGate` (`src/App.tsx:107–119`) calls `useCrewViewEligibility(profileId)` and does `if (!eligible) return <Navigate to="/" replace />;` (line 117). No role check.

`src/hooks/useCrewViewEligibility.ts:23–31` checks **only** `profiles.cert_level` being non-empty:
```ts
const { data: profile } = await supabase.from("profiles").select("cert_level").eq("id", profileId).maybeSingle();
setEligible(!!profile?.cert_level);
```
Note this is **not** the real cert gate. The DB gate `public.crew_assignable(_user_id)` (migration `20260623154115…sql:97–114`) requires 3 distinct `crew_certifications` rows with `status='approved'` and unexpired (or `manually_verified`). So the UI gate (a free-text `cert_level` string) and the truck-assignment gate (3 approved certs) are **two different, unlinked checks**.

## (c) Exact reason an owner gets bounced
Two distinct causes, depending on the route:

1. **`/crew-schedule` is the real "missing route" bug.** In the owner/manager branch, `src/App.tsx:533` binds `/crew-schedule` to `CrewScheduleAdmin` (the admin delivery page) — so an owner clicking "Schedule" in the crew sidebar (`src/components/crew/CrewLayout.tsx:18`, `path: "/crew-schedule"`) is silently thrown back to the **admin** page, breaking out of the crew UI. The crew `CrewSchedulePage` is unreachable for owners/managers/dispatchers (only crew role at 432 and biller at 505 have it).
2. **Everything else bounces at `CrewRouteGate`** — if `profiles.cert_level` is empty for that owner, line 117 `<Navigate to="/" replace />` fires; `/` renders `<Index />` (line 530), which for `role==='owner'|'manager'|'creator'` redirects to `/owner-dashboard` (`src/pages/Index.tsx:28–31`). That is the admin-dashboard bounce.
3. Confirmed: owner branch **is** missing `/crew-schedule` (crew version) — the other four crew routes *are* registered, contrary to a blanket "owner branch has no crew routes". `/crew-certifications` (558) is registered and **not** gated, so My Certifications already works for an owner.

## (d) Can an owner hold the certs?
**Yes.** Nothing restricts `crew_certifications` by role:
- `crew_assignable()` takes any `_user_id` and counts approved certs — role-agnostic, so an owner's assignable status is computed identically to a crew member's.
- The INSERT policy (as amended this session) allows self-insert *and* `is_admin()` insert for anyone in the same company, so an owner can enter their own or another's certs.
- `/crew-certifications` is reachable in the owner branch (`src/App.tsx:558`) with no gate.
- Caveat: `profiles.cert_level` (dash format, `EMT-B`…, set in `src/pages/Employees.tsx:649–660`) is the field `useCrewViewEligibility` reads — an owner created outside the employee form may have it null, which alone blocks the crew UI even with three approved certs.

## Summary
| Question | Finding |
|---|---|
| Existing owner-as-crew switch | None wired up; `ViewAsSwitcher.tsx` is unused dead code |
| Crew access gating | Route registration by role + `CrewRouteGate` capability check on `profiles.cert_level` |
| Bounce cause | `/crew-schedule` resolves to the admin page for owners; other crew routes redirect via `CrewRouteGate:117` → `Index.tsx:31` → `/owner-dashboard` |
| Owner can hold certs | Yes — cert tables and `crew_assignable()` are role-agnostic |
| Inconsistency worth noting | UI eligibility (`cert_level` string) ≠ DB assignability (3 approved certs) |

No changes made.

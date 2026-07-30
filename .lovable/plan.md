## 1. Collision confirmed

Both sidebars point at the same path:

- Admin nav: `src/components/layout/AdminLayout.tsx:90` — `{ path: "/crew-schedule", label: "Crew Schedule Delivery", roles: ["owner","manager","dispatcher"] }`
- Crew nav: `src/components/crew/CrewLayout.tsx:18` — `{ path: "/crew-schedule", label: "Schedule" }`

And `/crew-schedule` resolves differently per role branch in `src/App.tsx`:

| Line | Branch | Renders |
|---|---|---|
| 393 | system creator | `CrewScheduleAdmin` |
| 432 | crew | `CrewSchedulePage` |
| 457 | dispatcher | `CrewScheduleAdmin` |
| 505 | biller | `CrewRouteGate` + `CrewSchedulePage` |
| 533 | owner/manager (admin) | `CrewScheduleAdmin` |

So an owner in the crew UI taps Schedule → line 533 → admin page. Root cause is the shared path, exactly as described.

## 2. Recommendation: Option A

Give the crew schedule its own path. Option B would leave one URL meaning two pages, which keeps badges, help content, tours, and deep links ambiguous forever.

**New path: `/my-schedule`** (reads correctly in the crew UI and doesn't collide with the existing `/crew/:token` public run sheet).

## 3. Exact changes

**a. `src/components/crew/CrewLayout.tsx:18`** — change `path: "/crew-schedule"` → `path: "/my-schedule"`.

**b. `src/App.tsx`** — add `/my-schedule` in every branch that renders the crew UI, keeping `/crew-schedule` bound to `CrewScheduleAdmin` where it already is:
- crew branch (~432): replace `/crew-schedule` → `/my-schedule` with `<CrewSchedulePage />` (crew role has no admin page, so no need to keep the old path; optionally add a `<Navigate to="/my-schedule" replace />` on `/crew-schedule` for old bookmarks — I'd include this).
- biller branch (~505): replace `/crew-schedule` → `/my-schedule`, still `CrewRouteGate`-wrapped.
- owner/manager branch (~533): **keep** `/crew-schedule` → `CrewScheduleAdmin`, and **add** `<Route path="/my-schedule" element={<CrewRouteGate><CrewSchedulePage /></CrewRouteGate>} />`.
- system creator branch (~393): keep `/crew-schedule` → admin page, add `/my-schedule` → `CrewSchedulePage` (creator branch is ungated, matching its other crew routes at 383–388).
- dispatcher branch (~457): keep `/crew-schedule` → admin page; add `/my-schedule` → `CrewRouteGate`-wrapped `CrewSchedulePage` so a certified dispatcher riding a truck gets the same behavior as biller/owner. Say the word if you'd rather leave dispatcher untouched.

**c. Supporting path references** (needed so the crew badge/help stay attached to the crew page):
- `src/hooks/useCrewBadges.ts:180` — map `"/my-schedule"` to `tabKey = "schedule"`.
- `src/components/help/helpContent.ts:300` and `helpContentQA.ts:223` — the `/crew-schedule` entries are the crew-facing copy; re-key them to `/my-schedule`. The separate `/crew-schedule-admin` help key (helpContentQA.ts:236) stays as-is.

## 4. Untouched

`src/pages/CrewScheduleAdmin.tsx`, `AdminLayout.tsx` nav (still `/crew-schedule`, still lands on the admin delivery page), `AdminLayout.tsx:449` help-key remap, `tourContent.ts:414`, `DevModePanel.tsx:12`. No change to `useCrewViewEligibility` or `CrewRouteGate` logic, cert enums, or truck schema.

Verification after build: typecheck, plus load `/my-schedule` and `/crew-schedule` as an owner and confirm crew page vs admin delivery page respectively.

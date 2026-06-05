---
name: Per-Page Product Tour
description: Auto-firing first-visit guided tours per (user_id, page_key), role-scoped, replayable from Account Settings
type: feature
---
Every authenticated user sees a centered-modal guided tour the first time they land on each main page (Patients, Dispatch, Scheduling, Trucks, Employees, Trips, Billing, Remittance Import, Reports, Facilities, Compliance, Owner Dashboard, Crew Workspace, System Creator).

- Storage: `public.user_tour_progress` (user_id, page_key, completed_at, skipped). One row per (user_id, page_key); UNIQUE constraint.
- Auto-fires only when no progress row exists. Replay via `?tour=replay` or the "Product Tours" card in Account Settings.
- Tour content is defined in `src/components/tour/tourContent.ts` (PAGE_TOURS array) and is role-scoped — Crew sees Crew Workspace only, Biller sees billing-side pages, Dispatcher sees dispatch-side, Owner/Creator sees all.
- Tour steps include `lookFor` strings that name on-screen elements; no DOM coupling so tours stay stable as UI evolves.
- Each tour frames its page around the "getting claims accepted and paid" outcome (goal field + final "Why this matters" step).
- `PageTour` component is mounted once inside both `AdminLayout` and `CrewLayout`, watches route changes via `useLocation`.
- Skipped tours are marked `skipped=true` and do NOT re-fire (user must replay manually).
# Pass B — Archive an employee instead of half-deleting them

Plan only. Nothing built yet.

## What's actually there now

- An employee is one `profiles` row (holds name, cert level, contact, `active` boolean, `invitation_status`, `company_id`, `user_id`), plus a `company_memberships` row (their role in the company), plus `user_roles` rows (what the access rules check), plus their login account.
- Today "Delete" on the Employees page removes only the `profiles` row. The login, the membership and the role stay behind.
- Good news: a status column already exists — `profiles.active` (boolean) and `invitation_status` (which already has an `inactive` value). No new table is needed; only a few small columns.
- Signed charts, trips, certifications and audit entries point at the profile row, so keeping that row is exactly what preserves attribution.

## The mechanism: soft-archive on the profile, hard-revoke the grants

Archiving does four things, all server-side:

1. `profiles.active = false`, `invitation_status = 'inactive'` — the person stays in the system with their name and history.
2. Their `company_memberships` row and `user_roles` rows are removed. These are permissions, not history — nothing in the clinical record points at them.
3. Their login account is disabled (banned), not deleted. They can't sign in; the account still exists so every signed chart keeps resolving to a real person.
4. An audit entry is written (who archived whom, when, why).

To make it reversible, three small columns are added to `profiles`: `archived_at`, `archived_by`, `archived_role` (the role they held, so reactivating restores exactly what they had).

Row removal alone was rejected: deleting the membership hides them from lists but leaves them able to sign in, and deleting the profile is what caused this bug. The flag plus grant-revocation gets both halves right.

## Where the archive happens (new server function)

New `manage-employee` edge function with three actions — `archive`, `unarchive`, `archive_bulk` — following the exact pattern of the existing `delete-pending-crew-member` function: caller must be owner/creator/manager of the same company, target must belong to that company, owners and creators can't be archived, you can't archive yourself. Bulk runs the same single-employee path per person and reports per-person results, so one failure doesn't silently skip the rest.

## Active-list read sites that must exclude archived people

Already filter correctly (they check `active`):
- Trucks & Crews crew picker (`src/pages/TrucksCrews.tsx:404`)
- Crew Schedule admin (`src/pages/CrewScheduleAdmin.tsx:93-105`)
- Employees list (has a "show inactive" toggle — archived people appear only when it's on, with an "Archived" badge)

To be checked and filtered as part of this pass:
- Run reassignment crew picker (`src/components/scheduling/RunReassignmentDialog.tsx:206`)
- Scheduling / dispatch crew selectors that read crew profiles
- Attending-medic picker (`src/components/pcr/MedicSelector.tsx`) — it's fed by the crew assigned to the run, so it's correct once assignments are handled, but an archived person already on a past run must still be selectable in that historical chart
- Crew invite / certification review queues

Anywhere a name is *displayed* for a historical record (chart signatures, trip timeline, audit log, override monitor) keeps showing the archived person — those are lookups by id, not active lists, and are deliberately left alone.

## Future assignments

Recommended: **auto-unassign future only, with an up-front warning.**

Before archiving, the server counts the person's crew assignments dated today or later. The confirmation dialog says plainly, e.g. "Jane is assigned to 4 upcoming shifts. Archiving removes her from those; past shifts and completed trips are unchanged." On confirm, future crew seats are cleared; anything dated before today is untouched.

Blocking until manually unassigned was rejected — it makes a same-day termination impossible. Warning without acting was rejected — it leaves a person who can't log in still on tomorrow's board.

If clearing a future seat would leave a truck below minimum crew, that shift is left flagged on the board as incomplete rather than silently deleted, so a dispatcher sees the hole.

## Unarchive

Creator/owner-only "Reactivate" action on an archived employee row: lifts the login ban, restores the membership and role from `archived_role`, sets `active = true` and `invitation_status = 'active'`, clears the archive columns, writes an audit entry. Future shifts are not restored — they're re-assigned deliberately.

## Historical attribution — confirmed

Signed PCRs, trip records, certification history, incident reports, inspections and audit entries all reference the profile (or user) id, which is never removed. Archiving changes no clinical or billing data; every historical record keeps the correct name.

## Technical notes

- Migration: add `archived_at timestamptz`, `archived_by uuid`, `archived_role text` to `public.profiles`. No table creation, no policy rewrites, no change to `get_my_company_id`, `is_admin`, `is_dispatcher` or any tenant-isolation rule.
- Access revocation relies on the existing model: `user_roles` drives `is_admin/is_dispatcher/is_billing`, `company_memberships` drives company access, and the login ban is the hard stop.
- Client changes limited to `src/pages/Employees.tsx` (Archive / Archive selected / Reactivate, new confirmation copy using the existing `ConfirmActionDialog` gate) plus the read-site filters listed above.
- Untouched: claims/837, denial recovery, trial timers, Stripe, Pass C, and all tenant-isolation policies. No auth user or profile is ever hard-deleted.

## What you'd click to verify

1. Create a throwaway employee, assign them to a shift tomorrow, archive them — expect the upcoming-shift warning, then: gone from the employee list (unless "show inactive" is on), gone from crew pickers and the medic picker, gone from tomorrow's board, still named on anything they previously touched.
2. Try signing in as them — expect a refusal.
3. Reactivate them — expect them back in the lists with their old role, and still able to sign in.
4. Archive two throwaway employees at once and confirm both behave the same.

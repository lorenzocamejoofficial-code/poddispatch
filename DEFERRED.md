# Deferred follow-ups

## Pass 4A Checkpoint 1 — complete

- ✅ Added `manager` role to `membership_role` enum.
- ✅ Added `profiles.active_company_id` (FK, indexed) + backfill for single-membership users.
- ✅ Rewrote `get_my_company_id()` to honor active company first, fall back to single membership, return NULL for unresolved multi-membership.
- ✅ Rewrote `is_admin()` / `is_billing()` / `is_dispatcher()` to scope by active company and include `manager`.
- ✅ Added `is_owner_or_creator()` (narrow — manager does NOT pass).
- ✅ Switched 5 narrow RLS callsites to `is_owner_or_creator()`: `companies` UPDATE, `clearinghouse_settings` SEL/INS/UPD, `subscription_records` SEL, `support_tickets` SEL, `user_roles` ALL.
- ✅ `useAuth.tsx` exposes new `isOwnerOrCreator` and `isManager` derived flags; `MembershipRole` extended with `manager`.
- ✅ `TrialBanner.tsx` switched from `isAdmin` to `isOwnerOrCreator`.

### New follow-ups discovered

- **POLISH — `profiles` RLS lets managers edit owner profile rows.** Not a privilege escalation (managers already pass `is_admin()` for broad surfaces), but a customer-data-integrity issue: a manager could edit an owner's name/phone/cert. Real fix: add a narrow guard inside the existing broad `profiles` UPDATE policy preventing non-owners from editing rows whose `user_id` belongs to an owner of the active company. Requires looking up the *target row's* owner status, not just the caller's. Defer to a later polish pass.

## Pass 4A Checkpoint 2 — pending approval

- Full `useAuth.tsx` rewrite to consume `profiles.active_company_id` from the hook (currently still uses single-membership `LIMIT 1` lookup in `loadUserData`).
- Company switcher UI surface.
- Cache reset (TanStack Query + Zustand) on company switch.
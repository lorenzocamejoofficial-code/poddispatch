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

## Pass 4A Checkpoint 2 — complete

- ✅ `useAuth.tsx` consumes `profiles.active_company_id`; single JOIN query loads `memberships[]` with company names; auto-backfills active for single-membership users; gates multi-membership users via `needsCompanySelection`.
- ✅ `switchCompany(companyId)` persists to `profiles.active_company_id` and hard-reloads to wipe tenant-scoped state (TanStack Query cache, realtime channels, SchedulingProvider).
- ✅ `SelectCompany.tsx` page + `CompanySwitcher.tsx` sidebar component (renders only for 2+ memberships).
- ✅ `SchedulingProvider` exposed `reset()` action (belt-and-braces; hard reload covers it today).
- ✅ `App.tsx` route guard sends multi-membership users with no active company to `/select-company`.

## Pass 4A Checkpoint 3 — complete

- ✅ Realtime subscription on `profiles WHERE user_id = auth.uid()`; on `active_company_id` change in another tab, force `window.location.reload()`.
- ✅ 2-second suppression window via `lastSwitchAtRef` so the originating tab doesn't double-reload.
- ✅ Channel cleanup on signout (effect deps include `user`/`profileId`) and AuthProvider unmount (`removeChannel`).
- ✅ Migration: `profiles` set `REPLICA IDENTITY FULL` and added to `supabase_realtime` publication so the `payload.old` carries `active_company_id` for diff comparison.

### New follow-ups discovered

- **POLISH — `useCompanyName.ts` module-level cache.** The hook caches the company name in a module-scope variable outside React state. After a tenant switch within the same JS context, it would serve the prior company's name. The hard reload in `switchCompany()` masks this today, but if we ever move to SPA-style switching this cache must be invalidated (or replaced with a per-user/per-company keyed cache, or just removed in favor of TanStack Query). Defer until we drop hard reloads.
- **POLISH — TanStack Query cache is wiped via reload, not `queryClient.clear()`.** Same as above: when SPA switching is introduced, wire `queryClient.clear()` + `SchedulingProvider.reset()` into `switchCompany()` instead of the reload.
- **POLISH — broadcast `INSERT`/`DELETE` on `company_memberships`.** A revoked membership (e.g. owner kicks a manager out of company B) would not force the kicked user's other tab to reload. Out of scope today; track for the membership-management pass.
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

## Pass 4A Checkpoint 4 — complete

End-to-end verification of all 7 scenarios. No code changes; verification-only.

- ✅ **Scenario 1 — Single membership.** `loadUserData` resolves via the `liveMemberships.length === 1` branch and backfills `profiles.active_company_id`. `App.tsx` line 228 only redirects to `/create-company` when `!activeCompanyId && !needsCompanySelection`; `needsCompanySelection` stays false (gated on `> 1` memberships). `CompanySwitcher` returns `null` when `memberships.length <= 1`. ✓
- ✅ **Scenario 2 — Multi-membership, no active.** `loadUserData` sets `needsCompanySelection = true` (line 203: `liveMemberships.length > 1 && !scData`). `App.tsx` line 239 mounts only the `/select-company` route and redirects everything else there. `SelectCompany` calls `switchCompany()` → DB write → `window.location.assign("/")`. After reload, `profiles.active_company_id` is set and the user lands on the role-based dashboard via `Index.tsx`. ✓
- ✅ **Scenario 3 — Multi-membership, active set.** `loadUserData` line 169 picks `profileActive` because it matches a live membership. `needsCompanySelection` stays false; no `/select-company` redirect. ✓
- ✅ **Scenario 4 — Switcher dropdown switch.** `CompanySwitcher` calls `switchCompany(m.company_id)`. `switchCompany` (lines 372–394): stamps `lastSwitchAtRef = Date.now()`, writes `profiles.active_company_id`, then `window.location.assign("/")`. Full reload re-runs `loadUserData` against the new active company. ✓
- ✅ **Scenario 5 — Cross-tab sync (code trace).**
  - Tab A: `switchCompany` stamps `lastSwitchAtRef.current = T0`, DB UPDATE commits, `window.location.assign("/")` fires immediately (Tab A is gone before any echo can matter).
  - Tab B: realtime channel `profile-active-company-${user.id}` (line 408) receives `postgres_changes` UPDATE on `public.profiles` filtered by `user_id=eq.${user.id}`. Payload: `new.active_company_id = newCo`, `old.active_company_id = oldCo` (REPLICA IDENTITY FULL on `profiles` was set in the Checkpoint 3 migration, so `old` is populated).
  - Suppression checks (lines 421–425): `newActive !== oldActive` → continue. `newActive !== activeCompanyId` (Tab B still holds the prior tenant) → continue. `Date.now() - lastSwitchAtRef.current` in Tab B = `Date.now() - 0` → far greater than 2000ms → no suppression.
  - Tab B calls `window.location.reload()` and re-resolves under the new active company. ✓
- ✅ **Scenario 6 — System creator, no membership.** `loadUserData` sets `isSystemCreator = true` (line 152) and skips the `needsCompanySelection` branch (line 203 `&& !scData`). All `App.tsx` gates that touch tenant state are wrapped in `!isSystemCreator`. `Index.tsx` short-circuits to `/system`. ✓
- ✅ **Scenario 7 — Soft-deleted active company.**
  - Server: `get_my_company_id()` `active` CTE requires `EXISTS (… JOIN companies c ON c.id = m.company_id WHERE … AND c.deleted_at IS NULL)`. If the active company is soft-deleted, the CTE returns no row; the `fallback` CTE only fires when `member_count = 1` (also `c.deleted_at IS NULL`). Otherwise NULL — RLS treats user as having no tenant.
  - Client: `loadUserData` JOIN (`companies:company_id(id, name)`) returns `companies = null` for soft-deleted rows under the default visible-row join semantics, **but** the existing `companies` SELECT RLS may still expose the row via the membership owner policy. The client filter `m.companies` on line 155 drops any membership whose joined company resolved to null. Behaviour parity with server is therefore conditional on RLS hiding soft-deleted rows from the JOIN — this is **not strictly verified** here. See follow-up below.
  - Net effect: if the *only* membership's company is deleted, user enters the `/create-company` branch (no `liveMemberships`, `needsCompanySelection = false`). If a multi-membership user's *active* company is deleted, server will return NULL for `get_my_company_id()` while client may still let them in if it picked a different live membership via the `profileActive` match → see follow-up.

### Synthetic DB tests run

- `pg_get_functiondef('public.get_my_company_id')` — confirmed `c.deleted_at IS NULL` filter on both `active` and `fallback` CTEs (Scenario 7 server-side guard verified).
- No row inserts performed in this checkpoint (Checkpoint 1 already covered the role-resolution matrix synthetically). Cleanup N/A.

### Follow-ups discovered (not fixed in Pass 4A)

- **POLISH — `loadUserData` does not explicitly filter `companies.deleted_at`.** The JOIN `companies:company_id(id, name)` relies on RLS to hide soft-deleted companies. If `companies` SELECT RLS exposes soft-deleted rows to their members, a multi-membership user whose `profileActive` points at a soft-deleted company would resolve `resolvedCompanyId` client-side, set `activeCompanyId` in React, and render the sidebar — while every server query rejects under RLS because `get_my_company_id()` returns NULL. Net symptom: spinner-of-confusion, all data appearing empty/forbidden. Mitigation in Pass 4B or sooner: explicitly select `companies.deleted_at` and filter in JS, or change the SELECT RLS on `companies` to hide soft-deleted rows from non-creators.
- **POLISH — `getRoleLanding` in `Login.tsx` does not include `manager` or `creator` cases.** Falls through to the default `"/"` for both, which then hits `Index.tsx` and routes correctly — so functionally fine today. Worth tightening when we touch login.

### Out-of-scope confirmation

No files were modified in Checkpoint 4 other than this `DEFERRED.md` update.

---

**Pass 4A complete.** Next: Pass 4B — apply `NOT NULL company_id` to the 22 nullable tables, in a fresh session.
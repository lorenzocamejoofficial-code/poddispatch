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

## Pass 4B + 4C — complete

- ✅ **Pass 4B (NOT NULL):** Applied `NOT NULL company_id` to 21 tenant-scoped tables: `alerts`, `charge_master`, `claim_records`, `company_settings`, `crew_share_tokens`, `crews`, `email_send_log`, `facilities`, `operational_alerts`, `patients`, `payer_billing_rules`, `qa_reviews`, `runs`, `safety_overrides`, `schedule_previews`, `scheduling_legs`, `trip_records`, `trip_status_history`, `truck_availability`, `truck_run_slots`, `trucks`. (Live audit found 21 candidates, not the 22 in the audit doc — `profiles` is intentionally excluded; see below.)
- ✅ **Pass 4C (FK to companies):** Added `*_company_id_fkey` foreign key to `companies(id)` on **all 62 tables** with a `company_id` column. Behaviour:
  - **`ON DELETE RESTRICT`** for the 59 `NOT NULL` tables (deletes blocked unless tenant data is cleaned first).
  - **`ON DELETE SET NULL`** for the 3 by-design nullable tables: `admin_actions`, `audit_logs`, `profiles`.
- ✅ **Cleanup performed before migration:**
  - Deleted 4 orphan rows in `company_settings` (companies no longer existed).
  - Nulled `company_id` on 1 orphan `archive_company` row in `admin_actions` (id `cbbc1cd4-49ba-4a66-81f0-e6d30293c8e6`, target company hard-deleted 2026-04-23).
  - Hard-deleted 43 orphan rows in `trip_status_history` (history for trips that were already deleted alongside their parent company on 2026-04-23).
- ✅ **Documentation:** Added column comment to `admin_actions.company_id` noting NULL is valid only for destructive admin actions (`hard_delete_company`, `archive_company`) where the target company no longer exists.
- ✅ **Final post-flight matrix:** 62 `company_id` columns total → 59 `NOT NULL` + 3 nullable by design. 62 FKs to `companies(id)` → 59 RESTRICT + 3 SET NULL. Zero orphans across all 62 tables.

### Why these 3 stay nullable (by design)

- **`admin_actions.company_id`** — destructive admin actions (e.g. `hard_delete_company`) intentionally outlive the company they target; the column is documented as conditional.
- **`audit_logs.company_id`** — historical pre-tenancy audit rows + system-level audit events that have no company scope. `SET NULL` preserves history if a company is later deleted.
- **`profiles.company_id`** — system creators have no company; soft-deletion edge cases. (`profiles.active_company_id` is the source of truth post-Pass 4A; `company_id` is the legacy single-membership pointer still read by 8 callsites — see Pass 4A Checkpoint 4 / Pass 4B audit notes.)

### New follow-ups discovered

- **POLISH — `archive_company` / `hard_delete_company` flow does not cascade properly to all tenant-scoped tables.** Discovered during Pass 4C: 44 orphan rows existed across `admin_actions` (1) and `trip_status_history` (43) from a 2026-04-23 hard-delete. The new RESTRICT FKs now prevent future hard-deletes from succeeding without explicit cleanup, which is the right defense — but the *archive flow itself* should be audited and updated to either (a) cascade-delete or null out all tenant-scoped child rows in a single transaction, or (b) refuse to delete companies that still have referenced rows. Currently `hard_delete_company` is only used in test/development; it must be made production-safe before any production hard-delete is allowed.
- **POLISH — Audit doc (Section 1A) listed 22 NOT NULL candidates; live DB had 21.** The discrepancy is `profiles` (rightly excluded). Update the audit doc next time it's regenerated to reflect the live state.

## Pass 4D — RLS policy fixes (5 applied, 1 deferred)

- ✅ **#2 `legal_acceptances`** — INSERT WITH CHECK now requires `auth.uid() = user_id AND (company_id IS NULL OR company_id = get_my_company_id())`.
- ✅ **#3 `claim_payments`** — dropped UPDATE + DELETE policies entirely. Table is insert-only by design (only callsite: `RemittanceImport.tsx`).
- ✅ **#4 `plb_adjustments`** — dropped UPDATE + DELETE policies entirely. Same rationale as #3.
- ✅ **#5 `companies`** — dropped misnamed "System creator update company name only" policy (RLS cannot enforce column-level allowlists). `verified_by` writes moved to a new service-role edge function: **`mark-company-verified`** (validates JWT → checks `system_creators` membership → service-role UPDATE). `CompanyVerificationPanel.tsx` updated to invoke the function and surface failures via `sonner` toast.
- ✅ **#6 `profiles`** — replaced broad `Admins manage profiles` ALL policy with three per-cmd policies:
  - INSERT: `is_admin() AND company_id = get_my_company_id()`
  - UPDATE: `is_admin() AND company_id = get_my_company_id() AND (is_owner_or_creator() OR NOT is_user_owner_of_company(user_id, get_my_company_id()))` — managers can no longer edit owner profile rows.
  - DELETE: `is_owner_or_creator() AND company_id = get_my_company_id()` — managers can no longer delete profiles.
- ✅ **New helper:** `public.is_user_owner_of_company(_user_id uuid, _company_id uuid)` — `STABLE SECURITY DEFINER`, reusable for any future "is the target row's user an owner of this company?" check.
- ✅ **New edge function:** `supabase/functions/mark-company-verified/index.ts` — JWT validation via `getClaims`, system-creator gate via `system_creators` lookup with service role, uuid-format validation on `company_id`, returns `{ ok: true }` or `{ error }` with appropriate HTTP status.

### Resolved by Pass 4D

- ✅ The Pass 4A "POLISH — `profiles` RLS lets managers edit owner profile rows" follow-up (line 16) is now resolved by the per-cmd profiles policies above.

### Deferred from Pass 4D

- **POLISH — `notifications` RLS does not scope by tenant (BLOCKS_MULTI_MEMBERSHIP_UX_POLISH).** Current SELECT/UPDATE policies are `auth.uid() = user_id` only. The table has no `company_id` column, so a user with memberships in multiple companies sees notifications from all of them in any active context. Not a security issue (each notification is targeted at a specific user), but a minor UX leak across tenant contexts. Fix requires either adding `company_id` to `notifications` and backfilling, or filtering at the query layer using the active company. Defer until multi-membership UX polish pass.

## Pass 4E — onboarding seed (complete)

- ✅ **`create-company` edge function** now eagerly seeds 3 additional row types alongside the existing 4 (`companies`, `company_memberships`, `profiles`, `company_settings`):
  - **`migration_settings`** — 1 row, all defaults (`wizard_completed=false`, `wizard_step=0`).
  - **`clearinghouse_settings`** — 1 row, schema defaults (Office Ally host/port/folders, blank credentials, `is_configured=false`, `is_active=false`).
  - **`payer_billing_rules`** — 5 rows: `medicare`, `medicaid`, `private`, `va`, `default` (fallback rule for any unmatched payer_type, not a payer literally named "default").
- ✅ **Georgia Medicaid assumption documented inline:** `medicaid.requires_auth=true` reflects Georgia Medicaid (Modivcare/Verida brokers). Customers in other states should edit per their broker requirements. Comment in `create-company/index.ts` flags this.
- ✅ **All 3 seeds wrapped in best-effort `try/catch`** — failures log verbatim but do not block company creation. Missing rows lazy-create on first use or surface as wizard gaps.
- ✅ **Pre-flight schema verification:** confirmed `payer_billing_rules` columns (`requires_pcs`, `requires_signature`, `requires_necessity_note`, `requires_timestamps`, `requires_miles`, `requires_auth`) exist exactly; `payer_type` is text (not enum), so string literals are safe.
- ✅ **Seed test verified end-to-end:** inserted a synthetic test company, confirmed all 7 expected row types with correct counts and `payer_billing_rules` values matching the proposed defaults, then cleaned up via explicit child-then-parent deletion order with zero FK violations and zero orphans.

### Deliberately NOT seeded

- **`payer_directory`** — deferred. Drives timely-filing math via `generate_biller_tasks`; falls back to 365d default when absent. State Medicaid name is unknown at signup. Customers add payers as needed; revisit if onboarding telemetry shows users blocked here.
- **`charge_master`** — left empty by design. Wizard step 2 forces user to enter rates; pre-seeding zeroes is pointless and pre-seeding fake values would hide the gate.
- **`vehicle_inspection_templates`, `truck_builder_templates`** — per-truck/per-day_type, no obvious company-level default. Created during truck/template setup flows.

### Follow-ups discovered (not fixed in Pass 4E)

- **POLISH — Production hard-delete (`archive_company` flow) needs an explicit child-row cleanup helper.** Pass 4C set FKs to `ON DELETE RESTRICT` for safety, which means hard-delete cannot use a single `DELETE FROM companies` statement. The cleanup order proven by the Pass 4E test script is:
  1. `payer_billing_rules`
  2. `clearinghouse_settings`
  3. `migration_settings`
  4. `company_settings`
  5. `company_memberships`
  6. `UPDATE profiles SET active_company_id=NULL, company_id=NULL` for matching rows
  7. `profiles` (where applicable)
  8. `companies`
  9. `auth.users` (test user only)

  Recommend extracting this into a reusable `supabase/functions/archive-company/` cleanup helper that handles **all 59 RESTRICT-FK tenant-scoped tables** (the 8 above are only the seed/identity set — full hard-delete must also clear `trip_records`, `claim_records`, `scheduling_legs`, `qa_reviews`, `crews`, `trucks`, `patients`, `facilities`, etc., in dependency order). Until then, hard-deletes must follow the documented order manually. **The current `archive_company` implementation predates Pass 4C and almost certainly fails on the new RESTRICT FKs — needs verification before any production hard-delete is attempted.** This supersedes the Pass 4C POLISH note about cascade behavior.
## Pass 4F — per-customer payer enrollment tracking (complete)

- ✅ **New table: `customer_payer_enrollments`** — tracks per-(company, payer) enrollment state for ERA, EFT, EDI as three independent boolean flags with corresponding `*_enrolled_at` timestamps and a free-text `notes` field. `UNIQUE (company_id, payer_id)`. FK to `companies(id)` ON DELETE RESTRICT (matches Pass 4C posture); FK to `payer_directory(id)` ON DELETE CASCADE (enrollment row is meaningless without its payer).
- ✅ **RLS:** select/insert/update/delete all scoped to `company_id = get_my_company_id() OR is_system_creator()`. Indexed on `(company_id)` for list queries.
- ✅ **Backfill:** every existing `payer_directory` row got a corresponding enrollment row with all three flags `false`. (Live system had 0 directory rows at apply time, so this was a no-op — confirmed.)
- ✅ **App insert path updated:** `PayerDirectoryTab.tsx` is the only call site that inserts into `payer_directory`. It now also inserts an enrollment row immediately after creating a new payer (defaults all false), so newly-added payers don't depend on backfill. Other call sites (`BillingWorkQueue.tsx`, `DenialRecoveryEngine.tsx`, `ARCommandCenter.tsx`, `PreSubmitChecklist.tsx`) are read-only — no changes needed.
- ✅ **UI lives in-place inside the existing Payer Directory tab** (no separate tab):
  - 3 compact ERA/EFT/EDI badges per directory row, green when enrolled / muted when not.
  - Edit dialog gains an "Enrollment Status" section: 3 toggles + 3 date pickers (auto-set to `now()` on toggle-on, editable) + enrollment notes textarea.
- ✅ **PreSubmitChecklist warning (Q1):** soft yellow advisory, never blocks. Fuzzy-matches the claim's `payer_type` + `payer_name` to a `payer_directory` row scoped to the company, then checks `customer_payer_enrollments.edi_enrolled`. If false/missing, an `isWarning` checklist item appears with the agreed copy and a pointer to Billing → Payer Directory. Submission proceeds normally.
- ✅ **Defaults (Q4):** all three enrollment flags default to `false` for newly added payers — explicit opt-in.
- ✅ **No auto-flipping (Q3):** enrollment flags are manual-only; observed 835 traffic does not auto-promote any flag.
- ✅ **Synthetic test verified end-to-end:** inserted Medicare/Medicaid/Aetna test payers + matching enrollment rows on a real company, marked Medicare `edi_enrolled=true`, confirmed badge state matches expected (Medicare = green EDI; Medicaid + Aetna = all muted), then cleaned up via child-then-parent deletion (`customer_payer_enrollments` → `payer_directory`) with zero orphans.

### Follow-ups discovered (not fixed in Pass 4F)

- **POLISH — Normalize claim records to FK `payer_directory(id)` instead of free-text payer_name match.** Today claims carry `payer_type` + `payer_name`/`payer_id` strings and the enrollment lookup uses `payer_type = X AND payer_name ILIKE Y` against `payer_directory`. This is fragile if the customer renames a directory entry, and also defeats RI guarantees. Touches every claim creation path (`auto_create_claim_on_pcr_submit` trigger, all manual claim insert sites, `create-company` if it ever seeds the directory, the EDI generator's payer lookups). Defer until billing volume justifies the refactor or until a name-mismatch incident forces the issue.

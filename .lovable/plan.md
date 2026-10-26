# Company archive / hard-delete — findings and production-safe plan

## Findings (verified this turn)

### 1. Every implementation
- `supabase/functions/manage-company/index.ts` lines 597–771: the only archive/hard-delete path. A single `delete` (or `archive`) action that decides for itself, using `is_protected_record(company_id)`:
  - **Protected** (has `approved_at` and a verification row with NPI, Medicare or OIG true): **soft-archive**. Sets `deleted_at`, `deleted_by`, `onboarding_status='suspended'` and `suspended_reason='ARCHIVED: …'`, cancels Stripe (best effort), and writes an `admin_actions` `archive_company` row with a before-snapshot.
  - **Unprotected**: **hard-delete**. Runs about 65 separate `.delete()` calls in a fixed order, then `companies.delete()`, then deletes only the owner's login (`auth.admin.deleteUser(owner_user_id)`), then writes `admin_actions` `hard_delete_company` with `company_id = NULL`.
  - `restore_archived` (line 773) clears `deleted_at`.
- `supabase/functions/loadtest-harness/index.ts:326`: soft-archives synthetic load-test tenants. It never hard-deletes.
- No `archive_company` or `hard_delete_company` SQL function exists. No client code deletes rows from `companies` directly.

### 2. Wiring and gates
- UI: `src/pages/CreatorConsole.tsx`. A single-company Delete modal requires typing the exact company name, and the reason is optional (lines 949–960). **Bulk delete** (line 381) sends `"Bulk delete by system creator"` with no reason typed per company.
- The server checks `system_creators` (line 204). It is creator-only.
- Archive vs hard-delete is decided on the server. The creator cannot choose, and **hard-delete is reachable from production UI** for any company that is unverified or not yet approved, including real prospects mid-onboarding. It is not dev-only.
- An audit entry is written for both paths. The reason is optional for delete, which breaks the project's CONFIRM/OVERRIDE + reason convention.

### 3. Would hard-delete succeed? It fails, and leaves data half-deleted
Live FK graph: 70 FKs point at `companies`. There are **59 RESTRICT** links (all NOT NULL `company_id`), plus SET NULL on `admin_actions`, `audit_logs`, `profiles` (×2) and `remittance_quarantine` (×2), and CASCADE on `billing_overrides`, `nemsis_submissions`, `simulation_runs` and `system_announcements`.
- **Table coverage:** all 59 RESTRICT tables do appear in the delete list. The DEFERRED guess that tables are missing is wrong.
- **Order is wrong.** Child→parent NO ACTION links in the live graph that the current order violates:
  - `qa_reviews → claim_records`: claim_records is deleted at line 683, but qa_reviews only at line 688. **This blocks the claim_records delete.**
  - `claim_creation_failures → profiles`: profiles is deleted at line 718, but claim_creation_failures only at line 726. **This blocks the profiles delete.**
  - These are also in order and fine: trip_records→crews/trucks/profiles, schedule_change_log→legs/trucks/profiles, hold_timers→truck_run_slots, comms_events→facilities/trucks, incident_reports/eligibility_checks→patients, trip_events/operational_alerts→trucks.
- **No error checking.** None of the roughly 65 deletes checks its `error`. A blocked delete is silently skipped, the remaining tables are wiped, and the final `companies.delete()` then fails on the leftover claim_records/profiles rows. The result is a **partial purge with no rollback**: trips, patients, audit_logs and legal_acceptances are gone, the company row survives, and a 500 is returned. This matches the 2026-04-23 orphans DEFERRED recorded.
- **Not transactional.** Each call is a separate HTTP request.
- **Other defects:**
  - `profiles.delete().eq("company_id", cid)` deletes the profile of any user whose legacy `company_id` points here, even if they belong to other companies.
  - Only the owner's login is removed. Other staff logins are left behind.
  - Deleting `audit_logs` and `legal_acceptances` destroys compliance evidence.
  - Storage files (document attachments) are not removed.
- **DEFERRED Pass 4E order** (payer_billing_rules → clearinghouse_settings → migration_settings → company_settings → company_memberships → null profiles.active_company_id/company_id → profiles → companies → test auth user): this is valid for the 7 seed tables only. It does not cover the other 52 RESTRICT tables or the two inter-table links above.

### 4. Soft-archive gaps
- Good: `get_my_company_id()` excludes `deleted_at IS NOT NULL` in all three branches, so company-scoped RLS stops returning data. `useAuth` filters out archived memberships, and signup/invite functions skip archived companies.
- Gaps:
  - Policies keyed only on `auth.uid() = user_id` (for example `notifications`, `push_subscriptions` and own `profiles`) stay readable. These are low-PHI.
  - Active sessions are not revoked. Users keep a valid token until the 30-min idle logout. Data access is already denied by RLS, and the UI lands on an empty or no-company state rather than a clear "company archived" screen.
  - Service-role edge functions and cron jobs (sweeps, Office Ally polling, claim queue) do not all check `deleted_at`, so background work can keep running for an archived tenant. This needs a per-function check during the build.
  - Bulk delete can archive or hard-delete many tenants with one generic reason.

## Recommendation: Option B now, a narrow Option A only for test tenants

For a solo-founder SaaS about to onboard real customers, the production path should be **archive only**. Physically deleting healthcare tenant data conflicts with the 7-year retention rule, and a 59-table purge is high-risk to maintain as tables get added.

1. **Production (Option B):** `manage-company` `delete`/`archive` always soft-archives. Hard-delete is refused unless the target has `creator_test_tenant = true` or `is_sandbox = true`. Reason becomes required, plus the existing type-the-name confirmation. Bulk delete becomes bulk archive and requires a typed reason.
2. **Test-tenant purge (narrow Option A):** a new creator-only action `purge_test_company` backed by a single SECURITY DEFINER SQL function, `public.purge_test_company(_company_id uuid, _dry_run boolean)`:
   - It runs as one transaction, so any failure rolls everything back.
   - It refuses unless the company is a test/sandbox tenant and the caller is a system creator.
   - It deletes in an explicit dependency order (leaf tables first, with qa_reviews before claim_records and claim_creation_failures before profiles).
   - It nulls `profiles.company_id/active_company_id` instead of deleting profiles of users with other memberships.
   - It keeps `audit_logs` and `admin_actions`, relying on SET NULL.
   - Dry-run returns per-table counts and deletes nothing.
   - The edge function then deletes the login of any user left with zero memberships, and writes `admin_actions` `purge_test_company` with counts.
   - A guard test asserts that every FK to `companies` with RESTRICT/NO ACTION is listed in the function, so new tables can't silently break it.
3. **Soft-archive hardening:**
   - On archive, revoke sessions for all members (`auth.admin.signOut` per user, best effort and logged).
   - Show a plain "This company has been archived" screen when the user's only memberships are archived.
   - Add `deleted_at IS NULL` skips to the background sweeps and polling functions that iterate companies.

## Files and changes (for the build)
- `supabase/functions/manage-company/index.ts`: replace the hard-delete block with the refusal, make the reason required, add `purge_test_company` (with dry-run), and revoke sessions on archive.
- Migration: create `purge_test_company(uuid, boolean)` (SECURITY DEFINER, `search_path=public`, EXECUTE granted to `service_role` only). No table or schema changes.
- `src/pages/CreatorConsole.tsx`: delete modal becomes "Archive" with a required reason. Add a "Purge test tenant" action shown only for test/sandbox companies, with a dry-run count preview and a typed name confirmation. Bulk action becomes archive with a required reason.
- An archived-company screen in the existing no-company/auth gate.
- Background functions iterating companies: add the `deleted_at` filter where it is missing.
- Tests: a FK-coverage guard (query the FK list and compare it to the function's table list) and a refusal test (real company → refused).
- `DEFERRED.md` / `AGENTS.md`: record the rule "production removes tenants by archive only; physical purge is test-tenant-only via `purge_test_company`."

## Verification (no real data touched)
1. Create a throwaway company flagged `creator_test_tenant = true`. Seed one row in each major table, including a claim with a qa_review and a claim_creation_failure.
2. Dry-run: confirm the counts match the seeded rows, and that a real company id is refused.
3. Purge: confirm zero rows remain for that id in all 70 FK tables, the company row is gone, `admin_actions` and `audit_logs` rows remain with NULL company, and no orphans are left.
4. Force a failure mid-purge in a rolled-back test and confirm nothing was deleted, which proves atomicity.
5. Archive a second throwaway company. Confirm a member gets a NULL `get_my_company_id()`, sees the archived screen and has their session revoked. Then restore it.

No NEMSIS/CTA, billing or RLS policy changes.

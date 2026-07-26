
# AUDIT — company-signup non-2xx failure

## Root cause (high confidence)

**The `companies` insert violated the `companies_npi_number_unique_active` unique index.** NPI `1234567893` is already in use by an existing, non-deleted company.

Evidence from the database:

```
id: f53311c3-a40e-4b2b-b4c2-5aec852f7789
name: Lorenzo Test Company
npi_number: 1234567893
owner_email: lorenzocamejooficial@gmail.com
onboarding_status: active
deleted_at: NULL
created_at: 2026-04-22
```

Index definition (from `\d public.companies`):
```
"companies_npi_number_unique_active" UNIQUE, btree (npi_number)
  WHERE npi_number IS NOT NULL AND length(btrim(npi_number)) > 0 AND deleted_at IS NULL
```

The submitted signup used NPI `1234567893`, which fails this partial-unique check.

Corroborating evidence from the auth logs (attached to the turn):
- `03:58:30Z  user_signedup    lorenzojcamejo+test1@gmail.com  user_id c36c7f0e…`
- `03:58:30Z  user_deleted     lorenzojcamejo+test1@gmail.com  user_id c36c7f0e…`

That exact "create user, then immediately delete user" pair is the fingerprint of the compensating rollback in `supabase/functions/company-signup/index.ts` lines 162–168:

```ts
if (companyError) {
  await supabaseAdmin.auth.admin.deleteUser(userId);
  return new Response(
    JSON.stringify({ error: "Failed to create company: " + companyError.message }),
    { status: 500, ... }
  );
}
```

So the flow got past `auth.admin.createUser` (succeeded), then failed at the `companies` insert (line 134), rolled back the auth user, and returned HTTP 500 — which is what the client sees as "Edge Function returned a non-2xx status code."

## Non-2xx exit points in `supabase/functions/company-signup/index.ts`

| Line | Condition | Status | Notes |
|---|---|---|---|
| 33–38 | Missing email/password/fullName/companyName | 400 | Payload had all four |
| 40–45 | Missing npi/state/serviceAreaType | 400 | Payload had all three |
| 49–54 | Missing address street/city or ZIP != 5 digits | 400 | ZIP 30076 is valid |
| 59–64 | EIN not 9 digits | 400 | 123456789 is 9 digits |
| 66–71 | Any of the 3 agreements not accepted | 400 | Assumed accepted (Step 4 gate) |
| 88–108 | Pending crew invite exists for that email at a live company | 409 | Unlikely — `+test1` alias, no prior placeholder profile expected. Not the observed pattern. |
| 117–129 | `auth.admin.createUser` error (dedup or otherwise) | 400 | Did NOT fire — auth log shows successful `user_signedup` |
| **162–168** | **`companies` insert error** | **500** | **This is the observed failure — NPI unique-index violation** |
| 329–334 | Any uncaught throw in outer try | 500 | Would say "Internal server error"; less likely given the auth create/delete pair |

## Other constraints on `companies` — none would have fired for this payload

- `name`, `id`, `created_at`, `onboarding_status`, `is_sandbox`, `creator_test_tenant` are the only NOT NULL columns; all are supplied or defaulted.
- `onboarding_status` enum includes `'pending_approval'` — the value the code passes. Not a mismatch.
- `ein_number` has **no** unique constraint; the duplicate EIN in the DB (`123456789` also belongs to `Lorenzo Test Company`) does not block insert.
- No FK on `owner_user_id` to `auth.users` (per the "do not FK to auth.users" convention), so the freshly-minted user id would not be rejected.
- Only the partial-unique NPI index (`WHERE deleted_at IS NULL`) is a realistic blocker, and it matches the submitted NPI exactly.

## Ruled out

- **Duplicate auth email:** `auth.admin.createUser` succeeded — the auth log entry `user_signedup` at 03:58:30 with `user_id c36c7f0e…` proves it. The 403 `bad_jwt`/`missing sub claim` entries repeating in the log are an unrelated background poll of `/user` with a stale/empty JWT; they are not from this signup call.
- **Charge-master seed failure:** the seed runs at step 8b (`seedChargeMasterForNewCompany`, lines 213–219). It is fully wrapped in `try/catch` and only `console.error`s on failure; it cannot cause a non-2xx. It also runs AFTER `companies.insert`, so the company insert failure precedes it. (For reference: `seed-charge-master.ts` gracefully degrades when `cms_zip_locality` has no row — it just marks Medicare `needs_review=true`; ZIP 30076 would not cause a throw either way.)
- **Notifications / email / legal_acceptances / subscription_records / migration_settings / onboarding_events inserts:** all execute after the `companies` insert and either only `console.error` on failure or (for the Resend send) are wrapped in try/catch. None can produce the observed 500 before rollback of the auth user.
- **Transactionality:** there is NO database transaction. The function does a sequence of independent inserts and uses `auth.admin.deleteUser` as a manual compensating action **only** for the `companies` insert failure. Any later insert failure would leave partial rows behind — but that's not what happened here.

## Single most probable cause

The `companies` row insert failed with a Postgres unique-violation on `companies_npi_number_unique_active` because NPI `1234567893` is already held by the live company `Lorenzo Test Company` (id `f53311c3-…`). The edge function caught the DB error, deleted the just-created auth user, and returned HTTP 500 with body `"Failed to create company: duplicate key value violates unique constraint \"companies_npi_number_unique_active\""` — which surfaces to the client as the generic "Edge Function returned a non-2xx status code."

## What would need to change (NOT changing anything)

Any one of the following would unblock this test submission — pick per your intent, no code changes made now:

1. **Use a different NPI** for the test signup (fastest — the unique index is doing its job).
2. **Soft-delete the old `Lorenzo Test Company`** (`update companies set deleted_at = now() where id = 'f53311c3-…'`). The partial-unique index excludes rows with `deleted_at IS NOT NULL`, so the NPI would be free to reuse.
3. **Improve the edge function's error surfacing** so the client sees a human message (`"An active company already uses this NPI"`) with HTTP 409 instead of a generic 500 — separate from the fix above; this is a UX gap, not the root cause.

Report complete. No code changed.

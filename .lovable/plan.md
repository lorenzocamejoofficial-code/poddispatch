
# Early duplicate detection for email + NPI during signup

Two bugs, one root cause: duplicate email and duplicate NPI are only caught at final submit, after the user has filled the whole wizard. Fix by adding a lightweight server-side existence check callable from Step 1 and Step 2. Server-side final submit remains the source of truth.

## 1. New edge function: `check-signup-availability`

Path: `supabase/functions/check-signup-availability/index.ts`
Config: add to `supabase/config.toml` with `verify_jwt = false` (public, pre-auth call).
Uses service role — never exposes any data beyond two booleans.

**Input** (JSON body): `{ email?: string, npi?: string }` — either or both.

**Output** (200): `{ emailExists: boolean, npiExists: boolean }`. Fields the caller didn't ask about return `false`.

**Logic:**

- Normalize `email = email.trim().toLowerCase()`; normalize `npi = npi.replace(/\D/g,"")` and require length 10 to check (otherwise skip).
- `emailExists` — true if EITHER:
  1. `auth.admin.listUsers({ page:1, perPage:1, filter: ...})` returns a user with that email. (Fallback: page through with a small per-page and filter client-side if `filter` isn't supported by the installed SDK version — same technique used in the current signup guard.)
  2. The pending-invite guard from `supabase/functions/company-signup/index.ts` lines ~82-109 fires: a row in `profiles` with `email = <normalized>` AND `user_id IS NULL` AND `company_id` points at a `companies` row with `deleted_at IS NULL`. This matches final-submit behavior exactly so Step 1 doesn't say "available" and then final submit says "pending invite".
- `npiExists` — true if `companies` has a row with `npi_number = <digits>` AND `deleted_at IS NULL` (active only, matching the DB partial unique index the final submit relies on).
- No writes, no user creation, no auth mutation. CORS headers on every response including OPTIONS.
- On internal error, return HTTP 200 with `{ emailExists: false, npiExists: false }` so a check-service outage never hard-blocks a legitimate signup (the final submit still enforces uniqueness).

## 2. Wire into `src/pages/CompanySignup.tsx`

Convert two currently-synchronous validators to async and gate advancement on the availability check.

**Step 1 → Step 2 (`validateInfo`, currently lines 107-117):**
- Run all existing local validations first (unchanged).
- Then `await supabase.functions.invoke("check-signup-availability", { body: { email: email.trim() } })`.
- If response `emailExists === true`: `setEmailExists(true)` and do NOT call `setStep("profile")`. The existing red panel at lines 243-253 (with the clickable "Go to Sign In →" link) already renders — no new UI.
- If the invoke itself throws or returns `error`: swallow it, log to console, and advance to Step 2 anyway (graceful failure — final submit still protects).
- Show a small inline "Checking…" state on the Continue button while the call is in flight (disable button + spinner).

**Step 2 → Step 3 (`validateProfile`, currently lines 119-135):**
- Run all existing local validations first (unchanged).
- Then `await supabase.functions.invoke("check-signup-availability", { body: { npi: npiNumber.trim() } })`.
- If `npiExists === true`: `setError("A company with this NPI is already registered.")` and do NOT call `setStep("agreements")`. Uses the existing `error` panel at lines 237-241 — no new UI element.
- On invoke failure: swallow, log, advance to Step 3 (graceful).
- Same "Checking…" button state while awaiting.

Update the two `onClick={validateInfo}` / `onClick={validateProfile}` buttons to handle the async call (disable while `checking`).

## 3. Backstops (unchanged)

`supabase/functions/company-signup/index.ts` keeps:
- The pending-invite guard (lines ~82-109).
- The `auth.admin.createUser` "already exists" branch that returns `code: "email_exists"` (lines ~117-129).
- The `23505 / npi_number` unique-violation branch that returns `code: "npi_exists"` (lines ~162-183).

The Step-final handler in `CompanySignup.tsx` (lines 141-219) keeps its existing `email_exists` / `npi_exists` handling — untouched. Early checks are UX; server remains the source of truth.

## 4. Graceful failure summary

| Failure                            | Behavior                                             |
| ---------------------------------- | ---------------------------------------------------- |
| Availability edge fn 5xx / timeout | Client advances; final submit still enforces         |
| Availability edge fn returns error body | Client advances; final submit still enforces    |
| Network offline                    | Client advances; final submit will surface the error |
| Availability returns `true`        | Block advancement, show existing panel/inline error  |

## Files touched

- **New:** `supabase/functions/check-signup-availability/index.ts`
- **Edit:** `supabase/config.toml` (add `[functions.check-signup-availability] verify_jwt = false`)
- **Edit:** `src/pages/CompanySignup.tsx` (make `validateInfo` + `validateProfile` async, add availability calls, add "checking" button state)

Not touched: `company-signup/index.ts` logic, employee code, routing, styles.

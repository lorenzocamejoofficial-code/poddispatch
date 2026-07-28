## Audit-only report — no changes to apply

This is a diagnostic report per the AUDIT / DIAGNOSE ONLY request. No files will be modified. If you want fixes, respond with which bug(s) to address and I'll draft an implementation plan.

### 1. Employee duplicate email → raw "non-2xx" toast
- `create-user` returns HTTP 400 with `{error: "...already been registered..."}` (`supabase/functions/create-user/index.ts:165-170`).
- `supabase.functions.invoke` on non-2xx leaves `data = null` and puts a `FunctionsHttpError` in `error`, whose `.message` is the generic string.
- In `src/pages/Employees.tsx:229-237`, the check reads `data?.error || error?.message`. `data?.error` is undefined; `error?.message` is the generic string, so the `/already.*(registered|exist)/i` regex never sees the real body.
- Real "already registered" text is on `error.context` (Response), extractable via `await (error as FunctionsHttpError).context.json()` — the same pattern already used in `CompanySignup.tsx:180-184`.

### 2. NPI test misfires as "email exists" on fresh email
- On duplicate NPI, `company-signup` returns 409 `code:"npi_exists"` (`supabase/functions/company-signup/index.ts:170-177`).
- Client at `src/pages/CompanySignup.tsx:191-193` correctly detects it and throws `Error("A company with this NPI is already registered.")`.
- The outer `catch` at `src/pages/CompanySignup.tsx:215-222` uses a loose heuristic: `msg.includes("already") && (msg.includes("exist") || msg.includes("register"))`. The NPI message contains "already" + "registered", so the catch treats it as an email-exists case and flips `setEmailExists(true)` + `setStep("info")`.
- Root cause: overreaching catch-block heuristic, not the regex or a real pre-check. No client-side email pre-query exists at all.

### 3. Email-exists check runs too late
- Email existence is only enforced server-side by `supabaseAdmin.auth.admin.createUser` inside `company-signup` (`supabase/functions/company-signup/index.ts:112-129`), triggered by `handleSubmit` — after Step 4.
- `validateInfo` (`src/pages/CompanySignup.tsx:107-117`) only checks format/length; it does not query for existence.
- No anonymous existence endpoint exists. Anon key cannot query `auth.users`; `profiles` is RLS-locked. Moving the check to blur/step-advance would require a new service-role edge function (e.g. `check-email-exists`) that returns `{exists:boolean}` after checking `auth.admin.listUsers` (filtered by email) **and** replicating the pending-invite guard at `company-signup/index.ts:82-109`. Then call it from `validateInfo` before advancing.

### 4. Second tab to /login or /signup → 404 or silent auto-enter
- `/login` and `/signup` are only registered in the unauthenticated branch of `AppRoutes` (`src/App.tsx:243-244`).
- Each authenticated branch defines its own `<Routes>` block. None register `/signup`, and only some redirect `/login`:
  - Owner/admin (`src/App.tsx:515-559`): explicit `/login → "/"` (line 554); no `/signup` → falls to `path="*" → <NotFound />` (line 555). This is the 404.
  - System creator (`src/App.tsx:370-418`): `/login → "/system"` (line 413); no `/signup` → catch-all `NotFound` (line 414).
  - Dispatcher/Biller/Crew (`src/App.tsx:471, 505, 438`): `/login → "/"`; no `/signup` → catch-all `Navigate to "/"`. This is the "silently logs into the existing session" behavior.
- There is no "you're already signed in — sign out first / switch account" affordance for authed users hitting auth pages in a second tab.

### End of report
No fixes will be applied without an explicit go-ahead per bug.

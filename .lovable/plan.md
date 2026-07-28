## Goal
Replace raw duplicate-key errors with clear, specific user messages for two cases: (a) NPI already registered on company signup, (b) email already exists on employee create. No other behavior changes.

## Files touched (3)

1. **`supabase/functions/company-signup/index.ts`** — detect NPI unique-violation on the `companies` insert and return a friendly 409.
2. **`src/pages/CompanySignup.tsx`** — read the edge function's JSON error body (not just `fnError.message`, which is the generic "Edge Function returned a non-2xx status code") and surface it.
3. **`src/pages/Employees.tsx`** — in `handleCreate`, detect the "email already exists" case from the `create-user` response and show a clean toast. (The edge function already forwards Supabase's `createUser` error message, so this is a client-side message rewrite only — no edge function change needed for this case.)

## Detection rules (specific, not blanket)

### Signup — NPI duplicate
The `companies` insert currently returns any error as a generic 500. Detect duplicate specifically by checking the PostgREST error object returned from supabase-js:
- `companyError.code === "23505"` **AND**
- (`companyError.message` contains `"npi_number"` OR `companyError.details` contains `"npi_number"`)

Only then return `409` with `{ error: "A company with this NPI is already registered.", code: "npi_exists" }`. Any other error keeps the existing generic 500 path unchanged.

### Employee create — email duplicate
`supabaseAdmin.auth.admin.createUser` returns an error whose message contains phrases like `"already been registered"` / `"already registered"` / `"User already registered"`. The edge function already surfaces that raw message in `data.error`. In the client, before showing the toast, check:
- `typeof data?.error === "string"` AND `/already.*(registered|exist)/i.test(data.error)`

Only then swap the toast text to the clean message. Any other error text falls through to the existing `toast.error(data?.error || error?.message || "Failed to create user")`.

### Client-side signup error extraction
`supabase.functions.invoke` returns a `FunctionsHttpError` on non-2xx whose `.message` is the generic string. To get the JSON body, use `await fnError.context.json()` (available on `FunctionsHttpError`). Wrap in a try/catch; if parsing fails, keep the existing generic behavior. Then branch on `body.code === "npi_exists"` → show the specific message; `body.code === "email_exists"` → existing pending-email flow; else → `body.error || fnError.message`.

## User-facing message strings (exact)

- NPI duplicate (signup): **"A company with this NPI is already registered."**
- Email duplicate (employee create): **"An account with this email already exists."**

## Non-duplicate fall-through (explicit)

- Signup edge function: any non-23505 error, or a 23505 that isn't the NPI constraint, returns the current 500 with the current error text. No masking.
- Employee client: if `data.error` doesn't match the email-exists regex, the existing toast renders `data?.error || error?.message || "Failed to create user"` unchanged.
- No other insert paths are modified.

## Out of scope
No schema changes, no new validation UI, no email/NPI format changes, no other duplicate detection (phone, name, EIN), no styling, no refactor of the invite path or `send-employee-invite`.

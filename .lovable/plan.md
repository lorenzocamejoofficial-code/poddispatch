## Scope
Add red-border error state to 3 duplicate-checked inputs. Preserve existing messages/toasts.

## Styling approach
Reuse `aria-invalid` + `border-destructive`. Applied via a conditional className on each `<Input>`:
`className={cond ? "border-destructive focus-visible:ring-destructive" : ""}` plus `aria-invalid={cond}`.
No new components, no shared helper.

## Changes

### 1. `src/pages/CompanySignup.tsx` — Step 1 Email (line ~314)
- Reuse existing `emailExists` state (no new state needed).
- Add `aria-invalid={emailExists}` and conditional red border className to the email `<Input>`.
- In email `onChange`, call `setEmailExists(false)` alongside `setEmail(...)` so the red clears on edit.

### 2. `src/pages/CompanySignup.tsx` — Step 2 NPI (line ~348)
- Add new state: `const [npiExists, setNpiExists] = useState(false);`
- In `validateProfile` (line ~137), set `setNpiExists(true)` when `data?.npiExists`, and `setNpiExists(false)` on entry/success.
- Also set `setNpiExists(true)` in the final-submit catch when `body?.code === "npi_exists"` (backstop parity).
- Add `aria-invalid={npiExists}` + conditional red border className to the NPI `<Input>`.
- In NPI `onChange`, call `setNpiExists(false)` alongside `setNpiNumber(...)`.
- Keep the existing `error` string message unchanged.

### 3. `src/pages/Employees.tsx` — Add Employee email
- Add new state: `const [createEmailError, setCreateEmailError] = useState(false);`
- In `handleCreate` catch branch (line ~244), when the duplicate-email friendly message fires, set `setCreateEmailError(true)`.
- On successful create, reset to `false` (already resets `form`, add the flag reset).
- On the email `<Input>` in the Add Employee form, add `aria-invalid={createEmailError}` + conditional red border className.
- In that email `onChange`, call `setCreateEmailError(false)` alongside the existing setter.

## Not in scope
No changes to edge functions, invite flow, edit-employee form, other inputs, or shared UI components.

## Verification
- Type-check.
- Confirm: dup email at Step 1 → red border + existing panel; edit → red clears.
- Dup NPI at Step 2 → red border + existing error text; edit → red clears.
- Dup email in Add Employee → red border + existing toast; edit → red clears.
- Non-duplicate errors on all three: no red border (unchanged behavior).

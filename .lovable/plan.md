Minimal plan: extract the real error body from the create-user edge function response in `src/pages/Employees.tsx` so duplicate-email errors show a clean message instead of the generic "non-2xx status code" wrapper.

## Current state

In `src/pages/Employees.tsx` `handleCreate` (lines 229-237), the duplicate-email detection only sees:

```ts
if (error || data?.error) {
  const raw = (data?.error || error?.message || "") as string;
  const isEmailDup =
    typeof raw === "string" && /already.*(registered|exist)/i.test(raw);
  toast.error(
    isEmailDup
      ? "An account with this email already exists."
      : (raw || "Failed to create user"),
  );
}
```

When the create-user edge function returns HTTP 400, `supabase.functions.invoke` puts the response in `error` (a `FunctionsHttpError`) and leaves `data` as `null`. The real message (e.g. `"User with this email has already been registered"`) lives in the response body at `error.context`, not in `error.message`. Therefore `raw` is the generic wrapper text, the regex never matches, and the user sees the raw wrapper.

## What will change

Only the error branch inside `handleCreate` in `src/pages/Employees.tsx`. The same pattern already used in `src/pages/CompanySignup.tsx` (lines 209-215) will be mirrored:

1. Try to read the JSON body from `error.context` first, with a try/catch fallback.
2. Determine the real message from, in order: `body.error`, `data.error`, `error.message`.
3. If the real message matches `/already.*(registered|exist)/i`, show the friendly duplicate-email message.
4. Otherwise show the real underlying message (not the generic wrapper if a real body message exists).

## Before/after of the exact branch

**Before (lines 229-237):**

```ts
if (error || data?.error) {
  const raw = (data?.error || error?.message || "") as string;
  const isEmailDup =
    typeof raw === "string" && /already.*(registered|exist)/i.test(raw);
  toast.error(
    isEmailDup
      ? "An account with this email already exists."
      : (raw || "Failed to create user"),
  );
}
```

**After:**

```ts
if (error || data?.error) {
  let body: any = null;
  try {
    const ctx: any = (error as any)?.context;
    if (ctx && typeof ctx.json === "function") body = await ctx.json();
    else if (ctx && typeof ctx.text === "function") body = JSON.parse(await ctx.text());
  } catch {
    /* body stays null */
  }

  const raw = (body?.error || data?.error || error?.message || "") as string;
  const isEmailDup =
    typeof raw === "string" && /already.*(registered|exist)/i.test(raw);
  toast.error(
    isEmailDup
      ? "An account with this email already exists."
      : (raw || "Failed to create user"),
  );
}
```

## Scope

- Only `src/pages/Employees.tsx`, only the `if (error || data?.error)` block inside `handleCreate`.
- No changes to the `create-user` edge function, `CompanySignup.tsx`, routing, or any other logic.
- The duplicate-email mapping remains the only special case; every other error surfaces the real underlying message.

## Verification

After the change, the duplicate-email case will toast `"An account with this email already exists."` and other create-user failures will toast the actual server error message (e.g. validation errors) rather than the generic wrapper.
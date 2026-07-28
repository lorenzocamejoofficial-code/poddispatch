Change `supabase/functions/manage-company/index.ts` line 305 only.

Current:
```ts
approval_grace_deadline: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
```

New:
```ts
approval_grace_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
```

- Only the duration value changes; no other logic is touched.
- The existing sweep function (`sweep-approval-grace`) and first-login trial start path remain unchanged.
- Behavior stays the same: trial starts on first login, or auto-starts when the grace deadline passes.
- The deadline simply extends from 12 hours to 7 days so a pilot customer's trial doesn't silently start before onboarding.
- No comment explicitly describing "12 hours" exists on this line; the inline comment "Trial begins on first login (or via sweep after grace deadline)" is duration-agnostic and stays as-is.
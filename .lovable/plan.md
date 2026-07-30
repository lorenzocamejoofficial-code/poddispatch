## Atomic fix: crew certification INSERT flow (admin-enters-at-hire)

### (a) Migration SQL — INSERT policy only

```sql
DROP POLICY IF EXISTS "Users insert own certs" ON public.crew_certifications;

CREATE POLICY "Insert own certs or admin for company"
ON public.crew_certifications
FOR INSERT
TO authenticated
WITH CHECK (
  (user_id = auth.uid() AND company_id = public.get_my_company_id())
  OR (company_id = public.get_my_company_id() AND public.is_admin())
  OR public.is_system_creator()
);
```

SELECT / UPDATE / DELETE policies are left exactly as-is. No table, grant, column, or trigger changes.

### (b) `uploaded_by` stamping — `src/components/crew/CrewCertificationsDialog.tsx`, `submit()`

Inside `submit()`, before building the payload (same pattern the approve/reject/override handlers use):

```ts
const { data: { user: actor } } = await supabase.auth.getUser();
const actorId = actor?.id ?? null;
```

Before:
```ts
        uploaded_by: userId,
```
After:
```ts
        uploaded_by: actorId,
```
`user_id: userId` stays unchanged (the target employee).

### (c) Status branch in the same `submit()`

`CertCard` already receives `isSelf: boolean` and `adminMode: boolean` as props (lines 150–160), and `submit()` closes over both — confirmed available. Decision uses the actor id fetched in (b), with the props as the fallback signal:

```ts
const enteringForSelf = actorId ? actorId === userId : isSelf;
```

Before:
```ts
        status: "pending_review",
```
After:
```ts
        status: enteringForSelf ? "pending_review" : "approved",
```

- Self-entry → `pending_review` (unchanged behavior; admin approval still required).
- Admin/owner entering for another employee → `approved` immediately.

Because RLS now permits the admin path, the insert succeeds instead of failing the WITH CHECK. Non-admins acting on another user still can't insert — the database rejects it regardless of what the client sends.

### (d) Nothing else touched

- No changes to SELECT/UPDATE/DELETE policies, grants, or table structure.
- No changes to the certification review queue (`src/pages/CertificationReviewQueue.tsx`).
- No changes to `cert_type` / `cert_level` values or the enum mismatch (separate pass).
- No dedup/latest-row logic changes, no routing or gating changes.
- Only two files: one new migration + `src/components/crew/CrewCertificationsDialog.tsx` (three lines in `submit()` plus the actor lookup).

### Verification after build
Typecheck, then confirm the new policy text via a read query against `pg_policy`.
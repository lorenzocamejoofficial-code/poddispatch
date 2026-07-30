## Cert duplicates: replace-in-place model

Verified: `crew_certifications` has no `deleted_at`/soft-delete column (columns confirmed by query), so a plain unique index is correct. Order is mandatory: cleanup migration first, then the unique index.

### Part 1 — Cleanup migration (runs first)

```sql
DELETE FROM public.crew_certifications c
USING (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, cert_type
           ORDER BY created_at DESC, id DESC
         ) AS rn
  FROM public.crew_certifications
) ranked
WHERE c.id = ranked.id
  AND ranked.rn > 1;
```
Generic — keeps the newest row per (user_id, cert_type), deletes the rest. Today that removes exactly 1 row (user 2549ad4b…, medic_number).

### Part 2 — Unique index (same migration, immediately after the DELETE)

```sql
CREATE UNIQUE INDEX IF NOT EXISTS crew_certifications_user_cert_type_uniq
  ON public.crew_certifications (user_id, cert_type);
```
No table, grant, policy, or column changes.

### Part 3 — `submit()` in `src/components/crew/CrewCertificationsDialog.tsx`

Existing-row resolution (safe against the new constraint even if `row` wasn't passed):

```ts
let existing = row ?? null;
if (!existing) {
  const { data: found } = await supabase
    .from("crew_certifications" as any)
    .select("*")
    .eq("user_id", userId)
    .eq("cert_type", type)
    .maybeSingle();
  existing = (found as any) ?? null;
}
```

Actor lookup stays as-is (`actorId`, `enteringForSelf = actorId ? actorId === userId : isSelf`). `uploaded_by = actorId`, `user_id = userId` unchanged.

Status decision:

| Case | Status written |
|---|---|
| No existing row, self-entry | `pending_review` |
| No existing row, admin for another employee | `approved` |
| Existing row, admin for another employee (`!enteringForSelf`) | `approved` |
| Existing row, self, current status `pending_review` (or `rejected`) | `pending_review` |
| Existing row, self, current status `approved`, and any of `cert_number` / `expiration_date` / `cert_level` (medic_number only) changed | `pending_review` (re-pend) |
| Existing row, self, current status `approved`, only photo/issue_date/notes changed | `approved` (unchanged) |

Change detection compares old-vs-new on exactly those three fields:

```ts
const materialChanged =
  (existing?.cert_number ?? null) !== (number.trim() || null) ||
  (existing?.expiration_date ?? null) !== exp ||
  (type === "medic_number" && (existing?.cert_level ?? null) !== level);
```

Write path:
- `existing` → `.update(payload).eq("id", existing.id)`; when the resulting status is `pending_review`, also clear `reviewed_by`/`reviewed_at` and `rejection_reason`.
- no `existing` → `.insert(payload)` as today.

Toast text follows the outcome: "Submitted for review" when the row lands pending, "Certification saved" when it lands approved.

Re-pend notification: no existing admin-notify hook is wired to this dialog, so the plan only re-pends (the row reappears in the review queue). A push/notification on re-pend is a separate item, not built here.

### Part 4 — Review queue dedupe

`src/pages/CertificationReviewQueue.tsx` `load()` — the query already orders ascending by `created_at`. Change the order to `{ ascending: false }` and, right after `const list = (data ?? []) as any[];`, collapse to the newest row per (user_id, cert_type):

```ts
const seen = new Set<string>();
const deduped = list.filter((r) => {
  const k = `${r.user_id}|${r.cert_type}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});
```
Everything downstream (`withNames`, photo signing, render) uses `deduped`. Display-only safety net; no approve/reject logic touched.

### Not in scope
No enum changes, no routing/gating changes, no new notification system, no changes to approve/reject/override handlers beyond the reviewed_by/reviewed_at clearing that re-pend requires.

### Verification after build
Typecheck; confirm the unique index exists and no (user_id, cert_type) group has more than one row.

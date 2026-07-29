# AUDIT — Crew-end access & Employees cert_level

Read-only. No code changes proposed.

## 1. Crew-end access / owner bounce

### `src/hooks/useCrewViewEligibility.ts`
The check is **cert_level only** — no role, no truck/crew assignment:

```ts
const { data: profile } = await supabase
  .from("profiles")
  .select("cert_level")
  .eq("id", profileId)
  .maybeSingle();
setEligible(!!profile?.cert_level);
```

`eligible = true` iff `profiles.cert_level` is a non-empty value. (The file header comment explicitly says "Truck assignment is NOT required — cert alone grants crew UI access.")

### The gate — `src/App.tsx` lines 106-119
```tsx
function CrewRouteGate({ children }) {
  const { profileId } = useAuth();
  const { eligible, loading } = useCrewViewEligibility(profileId);
  if (loading) return <spinner/>;
  if (!eligible) return <Navigate to="/" replace />;  // ← the bounce
  return <>{children}</>;
}
```

So an unauthorized crew navigation redirects to `/`, and `/` for an owner routes to `/owner-dashboard` via `src/pages/Index.tsx:31` → that's the "sent back to admin side" behavior.

### Why an owner with a cert_level still gets bounced
The gate itself doesn't exclude owner by role — the predicate is purely `!!profiles.cert_level`. Two structural causes:

**A. Owner is missing `/crew-schedule` in the owner route table.**
`src/App.tsx` lines 553-558 (owner branch) wires only:
- `/crew-dashboard`, `/crew-patients`, `/pcr`, `/crew-checklist`, `/crew-certifications`

There is **no** `<Route path="/crew-schedule" ...>` in the owner branch. Compare:
- crew role (line 432): has `/crew-schedule`
- dispatcher branch (lines 469-473): also missing `/crew-schedule`
- biller branch (line 505): has `/crew-schedule` via `CrewRouteGate`
- owner branch (553-558): missing `/crew-schedule`

If the owner clicks a link to `/crew-schedule`, it falls through to `*` → `<Navigate to="/" replace />` (line 561) → Index → `/owner-dashboard`. That is the redirect they're seeing, and it is **not** the cert gate firing — it's a missing route.

**B. If `profiles.cert_level` is actually NULL for that owner**, then `CrewRouteGate` redirects to `/` for every wired crew route as well. Worth a DB check on that specific owner's `profiles.cert_level` value.

### Role check that would exclude owner/manager/dispatcher from crew UI
**There isn't one.** No role predicate anywhere in `CrewRouteGate` or `useCrewViewEligibility`. Access is cert-based only. The owner bounce is either (A) the missing `/crew-schedule` route on the owner branch, or (B) a null `cert_level` on the owner's profile row.

---

## 2. Add-Employee cert_level options

### File: `src/pages/Employees.tsx` lines 649-660
```tsx
<Label>Cert Level</Label>
<Select value={form.cert_level} onValueChange={(v) => setForm({ ...form, cert_level: v })}>
  <SelectTrigger><SelectValue /></SelectTrigger>
  <SelectContent>
    <SelectItem value="EMT-B">EMT-B</SelectItem>
    <SelectItem value="EMT-A">EMT-A</SelectItem>
    <SelectItem value="EMT-P">EMT-P</SelectItem>
    <SelectItem value="AEMT">AEMT</SelectItem>
    <SelectItem value="Other">Other</SelectItem>
  </SelectContent>
</Select>
```

Default value: `"EMT-B"` (Employees.tsx lines 79, 87, 257, 309).
Values written to `profiles.cert_level`: `"EMT-B" | "EMT-A" | "EMT-P" | "AEMT" | "Other"` (dash format).

### EMR presence
**No EMR option** in the Employees add/edit form.

### Enum format mismatch (important)
There are **two different enums** in `src/integrations/supabase/types.ts`:

| Enum | Values | Used by |
|---|---|---|
| `cert_level` (line 6749/6982) | `"EMT-B" \| "EMT-A" \| "EMT-P" \| "AEMT" \| "Other"` | `profiles.cert_level` — what Employees.tsx writes |
| `crew_cert_level` (line 6761/6995) | `"EMR" \| "EMT_B" \| "EMT_A" \| "PARAMEDIC"` | `crew_certifications.cert_level` — what `CrewCertificationsDialog.tsx` writes |

So:
- `profiles.cert_level` uses **dash** format (`EMT-B`) and has **no EMR**.
- `crew_certifications.cert_level` uses **underscore** format (`EMT_B`) and **does** include EMR (see `CrewCertificationsDialog.tsx` line 163 default `"EMT_B"`, and `CertificationReviewQueue.tsx` line 277 renders it as `cert_level.replace("_", "-")`).

These two tables use different value formats and different level sets. `profiles.cert_level` and `crew_certifications.cert_level` are not interchangeable strings, and only the crew_certifications side knows about EMR.

---

## Files referenced
- `src/hooks/useCrewViewEligibility.ts` (whole file)
- `src/App.tsx:106-119` (CrewRouteGate), `:400-561` (per-role route tables), notably owner branch `:553-561` missing `/crew-schedule`
- `src/pages/Index.tsx:25-39` (`/` → role-based redirect; owner → `/owner-dashboard`)
- `src/pages/Employees.tsx:649-660` (cert_level Select), `:79, 87, 257, 309` (default `"EMT-B"`)
- `src/components/crew/CrewCertificationsDialog.tsx:163` (crew_cert_level default `"EMT_B"`)
- `src/integrations/supabase/types.ts:6749, 6761` (both enum definitions)

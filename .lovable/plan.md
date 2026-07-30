## What I confirmed

- `public.crew_assignable(_user_id uuid) returns boolean` — SQL, STABLE, SECURITY DEFINER. Returns true when the user has **3 distinct cert_types** with `status='approved'` and either an unexpired `expiration_date` or `manually_verified` (unexpired manual verification). Callable from the client via `supabase.rpc("crew_assignable", { _user_id })`; the typed signature already exists in `src/integrations/supabase/types.ts:6646`.
- **ID semantics:** `crew_certifications.user_id` is the **auth user id** — `src/pages/crew/CrewCertifications.tsx:20` passes `user.id` into `CrewCertificationsPanel`. So the gate must key off `user.id`, **not** `profileId`. Today `useCrewViewEligibility(profileId)` reads `profiles.cert_level` (free-text string) — `src/hooks/useCrewViewEligibility.ts:23-31`.
- **HIPAA flow:** `HipaaAcknowledgmentGate` (`src/components/compliance/HipaaAcknowledgmentGate.tsx`) is an inline blocker, not a route. On accept it inserts into `legal_acceptances` and sets local `accepted=true`, then renders `children` at the current URL — there is **no post-accept navigation today**. It wraps the crew (App.tsx:428), dispatcher (452) and biller (490) branches; the admin/owner branch (523) is **not** wrapped, and owners/system creators skip the gate anyway (`skipGate`, line 24).
- **CrewRouteGate** (`src/App.tsx:107-119`): spinner while loading, `<Navigate to="/" replace />` when not eligible.
- **Branch drift** (crew routes per branch):
  - creator (383-388): crew routes **ungated**
  - crew role (430-438): crew routes **ungated**
  - dispatcher (472-476) / biller (506-511) / admin (558-562): gated, but `/my-schedule` gated in dispatcher/biller/admin while crew branch has it plain
  - `/crew-certifications` is **already ungated in every branch** (388, 437, 476, 511, 562) — good, keep it that way.

## A. Rewrite `useCrewViewEligibility`

Change signature to take the **auth user id** and call the real rule:

```ts
export function useCrewViewEligibility(userId: string | null) {
  // loading=true until the rpc resolves (prevents flash-redirect)
  // supabase.rpc("crew_assignable", { _user_id: userId })
  // eligible = data === true; on error -> eligible = false
  return { eligible, loading };
}
```

Keeps `{ eligible, loading }` shape. Cancellation guard stays. No more `profiles.cert_level` read.

Call-site updates: `CrewRouteGate` switches from `profileId` to `user?.id` (both come from `useAuth()`). I'll grep for any other consumer and update it the same way.

## B. Post-HIPAA lock → force to My Certifications

Two coordinated pieces, both driven by the same `crew_assignable` value (so it works across sessions — no one-time flag):

1. **CrewRouteGate redirect target changes**: when `!eligible`, redirect to `/crew-certifications` instead of `/`. `/crew-certifications` itself stays outside the gate, so the user always lands somewhere usable and can complete their certs.
2. **Crew-role branch gets the gate too**: in the crew branch (App.tsx:430-438), wrap `/`, `/crew-dashboard`, `/crew-patients`, `/my-schedule`, `/pcr`, `/crew-checklist` in `CrewRouteGate`. Result: right after HIPAA accept, an un-certified crew member is pushed to `/crew-certifications` and can't leave it. Once all 3 certs are approved, `crew_assignable` flips true and every crew route opens on the next load.
3. **CrewLayout nav lock** (`src/components/crew/CrewLayout.tsx:15-22`): call `useCrewViewEligibility(user.id)`; while `!eligible`, render only the **My Certifications** item and show a one-line notice ("Complete and get all three certifications approved to unlock the crew tools."). While loading, render nav as-is (no flicker/lock-out). When eligible, nav is unchanged from today.

## C. De-drift the branches

Every branch that exposes the crew UI wraps the **same** five/six crew routes in the **same** `CrewRouteGate`, with `/crew-certifications` always outside it:

| Branch | Change |
|---|---|
| crew (430-438) | add `CrewRouteGate` to `/`, `/crew-dashboard`, `/crew-patients`, `/my-schedule`, `/pcr`, `/crew-checklist` |
| dispatcher (472-476) | add `/my-schedule` already gated (464) — no change; consistent set confirmed |
| biller (506-511) | already consistent — no change |
| admin/owner (558-562) | already gated; `/my-schedule` (540) already gated — no change |
| system creator (383-388) | leave **ungated** (creator preview/simulation access, matches the rest of that branch) |

Owner-as-crew then works purely on capability: an owner with 3 approved certs sees the crew pages; one without gets bounced to `/crew-certifications`.

## Safety confirmations

- **(i) Existing assignable crew keep full access.** The new rule is exactly `crew_assignable` — the same function `TrucksCrews` already uses to allow truck assignment. Anyone currently cleared to ride returns `true` and sees no change. The only people newly restricted are those who had a `cert_level` string but no 3 approved certs — i.e. people the DB already refuses to put on a truck.
- **(ii) `/crew-certifications` is always reachable.** It stays registered outside `CrewRouteGate` in all five branches, it's the redirect target when ineligible, and it's the one nav item kept visible while locked. It is never gated behind the cert requirement.
- Loading is always a spinner, never a redirect, so a slow RPC can't bounce a valid crew member.

## Not in scope

No `cert_type`/`cert_level` enum changes, no truck schema, no minimum-crew rule, no DB migration (the function already exists).

## Verification after build

Typecheck, then in the preview: (a) a `crew_assignable=true` user reaches `/crew-dashboard` with full nav; (b) a user with 0–2 approved certs hitting any crew route lands on `/crew-certifications` with nav reduced to that single item; (c) owner with certs vs. owner without behave per the same rule.

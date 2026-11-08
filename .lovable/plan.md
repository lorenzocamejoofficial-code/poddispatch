# Address → coordinates cache (US Census geocoder)

Backend half of the coarse-geo travel floor. Nothing is wired into feasibility or the UI in this pass.

## (a) Where addresses live today (checked against the generated schema)

| Table | Address fields | Notes |
|---|---|---|
| `patients` | `pickup_address`, `dropoff_facility` (free text, a facility name or address) | No lat/lng |
| `facilities` | `address` (one free-text line) | No lat/lng |
| `scheduling_legs` | `pickup_location`, `destination_location` (required); `oneoff_pickup_address`, `oneoff_dropoff_address` (nullable) | No lat/lng |
| `trip_records` | `pickup_location`, `destination_location` | Copied from the leg; not a separate source |
| `companies` | `address_street/city/state/zip` | Not run addresses; not used here |

No coordinate column exists on any of these tables. The only geocoding in the app is client-side Google reverse geocoding in `FleetMap.tsx`, with an in-memory cache. That is a different direction and is left alone. All addresses are single free-text strings, so they need to be normalized before they can be used as cache keys.

## (b) Cache design

One new table, `public.geocode_cache`, shared by patient, facility and one-off addresses:

- `id uuid pk`, `company_id uuid not null`, `address_hash text not null`, `lat double precision null`, `lng double precision null`, `status text not null` ('matched' | 'no_match' | 'error'), `source text not null default 'census'`, `match_quality text null` (Census match type, e.g. Exact/Non_Exact), `attempts int default 1`, `geocoded_at timestamptz default now()`, `next_retry_at timestamptz null`.
- `UNIQUE (company_id, address_hash)`, so each address is geocoded once per company.
- **No-match caching:** a `no_match` row is permanent until the address text changes, which produces a new hash. An `error` row (timeout or 5xx) sets `next_retry_at` with backoff (1h, 6h, 24h, capped), so a down Census service isn't hit on every read.
- **The raw address is not stored.** Only the hash and coordinates are kept (see c).

Normalization (`normalizeAddress`, a pure TypeScript function mirrored in the edge function's `_shared`): trim, uppercase, collapse whitespace and punctuation, standardize common suffixes and units (STREET→ST, AVENUE→AVE, SUITE/STE/#→STE, ROAD→RD, …), and drop a trailing "USA". Strings that are empty or too short to be an address (fewer than about 2 tokens, or no digits, e.g. a bare facility name) return null and are never geocoded.

## (c) Privacy: the decision

**Recommendation: rows scoped to each company, plus a salted keyed hash, with no raw address stored.**

- `address_hash = HMAC-SHA256(GEOCODE_HASH_SECRET, company_id || '|' || normalized)`, computed only in the edge function. The secret is a server-only secret that I generate. It is never sent to the client.
- RLS: a SELECT policy for authenticated users only, where `company_id = get_my_company_id()`. The client also scopes with `getActiveCompanyId()`/`NO_COMPANY`. There are no client INSERT/UPDATE/DELETE grants; only `service_role` (the edge function) writes. Following project convention, the creator cross-company policy is not added.
- The table never contains a patient address. A leaked row is a hash plus a point on a map. Coordinates for a home are still sensitive, which is why tenant RLS also applies.

**Tradeoff:**
- Scoping per company means the same hospital address is geocoded once by each company rather than once globally. This costs a few extra free Census calls, which is negligible.
- A global, unsalted cache would save those calls, but it would let anyone with read access test whether some company has a patient at a given address. That is a cross-tenant leak, so it is rejected.
- A keyed hash also prevents dictionary attacks on the hash itself. The cost is that rotating the secret invalidates the cache, which only means re-geocoding.
- Optional, not in this pass: facility addresses could be pooled in a global table, since they are not PHI. I'm deferring this to keep one concern.

## (d) When geocoding runs

- **Lazy only.** Nothing geocodes when a patient, facility or leg is saved.
- Client helper `src/lib/geocode-cache.ts`:
  - `primeGeocodes(addresses: string[]): Promise<void>` calls the edge function once with up to 50 addresses. It deduplicates, skips empty or unusable inputs, and fills an in-memory map keyed by normalized address.
  - `getCachedCoords(address): {lat,lng} | null` is synchronous and reads only the in-memory map. On a miss it schedules a debounced background `primeGeocodes` and returns null immediately.
  - Errors are swallowed and logged without the address. The helper never throws.
- **Optional batch backfill:** the same edge function accepts `{ mode: "backfill" }` from an owner or creator. It reads the company's distinct facility, patient and one-off addresses server-side and geocodes up to N per call, rate-limited to about 5 per second. It is triggered manually later; there is no cron in this pass.

## (e) Edge function `geocode-addresses`

- Auth: JWT validated in code. `company_id` comes from the caller's profile and never from the request body. Zod body `{ addresses: string[] (max 50, each ≤ 300 chars) }`.
- Flow per address: normalize → HMAC → look up the cache row → if it is fresh (matched, no_match, or an error not yet due for retry), return it → otherwise call Census.
- Census call: `GET https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=…&benchmark=Public_AR_Current&format=json`, with a 5s AbortController timeout and concurrency of 4.
  - Best candidate: the first `addressMatches[]` entry, preferring `Exact` over `Non_Exact`, using `coordinates.x` as lng and `coordinates.y` as lat.
  - Coordinates are checked for range. An empty list is `no_match`. A timeout, network error or non-200 response is `error` with backoff.
- Response: `[{ key: normalized, lat, lng, status }]`, where the key is the normalized address the client already sent. No raw address is logged anywhere, because addresses are PHI.
- Uses the existing `edge_function_rate_limits` table per user.

## (f) Failure path end-to-end

```text
caller → getCachedCoords(addr)
   hit (matched)          → {lat,lng} → travelFloorMinutes(...)
   hit (no_match/error)   → null      → time-only feasibility
   miss                   → null now  + background prime → next render may hit
edge fn down / timeout / 5xx / Census down → error row + backoff → null
```

Scheduling is never blocked and never waits on Census.

### Tests (synthetic, no PHI; Census `fetch` is mocked)
- `src/lib/address-normalize.test.ts`: suffix and unit folding, whitespace and case, idempotence, and null for empty, too-short or name-only input.
- `src/lib/geocode-cache.test.ts`, with the edge call mocked:
  - a miss returns null synchronously and calls the function once
  - repeated misses for the same address are deduplicated
  - a prime fills the map so a later read returns coordinates
  - `no_match` is cached as null
  - an edge error resolves to null and does not throw
  - addresses are batched in chunks of 50
- `supabase/functions/geocode-addresses/census.test.ts` (Deno, pure parser plus mocked fetch):
  - an Exact match is preferred over Non_Exact
  - x/y map to lng/lat
  - an empty match list gives no_match
  - a timeout or 500 gives error
  - out-of-range coordinates are rejected
  - the HMAC differs per company for the same address
- Full suite run.

## Files (about 420 lines)

| File | Change |
|---|---|
| migration `create_geocode_cache` | New table, grants (SELECT to authenticated, ALL to service_role), RLS, unique index. Additive only. |
| `src/lib/address-normalize.ts` (+ test) | Pure normalizer |
| `supabase/functions/_shared/address-normalize.ts` | Mirror of the same normalizer (kept in sync, as with the transport vocabulary) |
| `supabase/functions/geocode-addresses/index.ts` | Edge function |
| `supabase/functions/geocode-addresses/census.ts` (+ test) | Census fetch and parse |
| `src/lib/geocode-cache.ts` (+ test) | Client read-through helper |
| Secret `GEOCODE_HASH_SECRET` | Generated server-side |
| `AGENTS.md` | One rule: run-address coordinates come only from the company-scoped hashed `geocode_cache` through `geocode-addresses`; never store raw addresses or pool them across tenants |

Not touched: `geo-distance.ts`, feasibility, the UI, NEMSIS, billing, `FleetMap.tsx`.

## Blockers and open items
- No hard blockers.
- `patients.dropoff_facility` and leg `destination_location` often hold a facility name, not an address. This pass only geocodes strings that look like addresses. Resolving a name to a facility address is the wiring pass's job.
- Census coverage is US-only, and rural Georgia route-only addresses often fail to match. Those get a cached `no_match` and fall back to time-only feasibility.
- Sending patient addresses to a federal public service is a third-party disclosure without a BAA. Census keeps no account linkage and returns only coordinates, but please confirm this is acceptable under your HIPAA posture. The alternative is to geocode only facility addresses until a BAA-covered provider is chosen.

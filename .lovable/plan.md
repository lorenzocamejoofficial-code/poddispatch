## Scope
Two surgical fixes inside `src/pages/BillingAndClaims.tsx`, charge-master section only. No changes to seeding, billing math, claim generation, or onboarding.

## (a) Auto-confirm on valid Save — `saveRate` (line 1200)

Update the payload built in `saveRate` to also set `needs_review` and `auto_seeded`:

```ts
const base = parseFloat(rateForm.base_rate) || 0;
const mileage = parseFloat(rateForm.mileage_rate) || 0;
const valid = base > 0 && mileage > 0;

const payload = {
  payer_type: rateForm.payer_type,
  base_rate: base,
  mileage_rate: mileage,
  wait_rate_per_min: parseFloat(rateForm.wait_rate_per_min) || 0,
  oxygen_fee: parseFloat(rateForm.oxygen_fee) || 0,
  extra_attendant_fee: parseFloat(rateForm.extra_attendant_fee) || 0,
  bariatric_fee: parseFloat(rateForm.bariatric_fee) || 0,
  company_id: companyId,
  needs_review: !valid,     // valid Save auto-confirms; zero/blank stays needing verification
  auto_seeded: false,       // manual edit/entry — no longer a CMS auto-seed
};
```

Toast becomes `"Rate saved and confirmed"` when `valid`, else `"Rate saved — still needs verification"`.

The separate Confirm button (line 1834) is untouched — it still confirms pre-seeded rows without editing, and because it only sets `needs_review=false` (leaves `auto_seeded=true`), those rows remain labeled AUTO-SEEDED, which is correct.

## (b) Badge rule — distinguishing auto-seeded vs manually confirmed

Existing column reused: **`auto_seeded`** (already on `charge_master`, already selected). No new column needed. New rule:

- Manual Save via Edit modal → sets `auto_seeded=false` (change above).
- CMS seed and pre-seed Confirm-button flow → keep `auto_seeded=true`.

Badge JSX at lines 1814–1823 becomes three mutually exclusive states:

```tsx
{rate.needs_review ? (
  <span className="… amber …">Needs verification</span>
) : rate.auto_seeded ? (
  <span className="… emerald …">Auto-seeded</span>
) : (
  <span className="… emerald …">Confirmed</span>
)}
```

Same emerald styling for Auto-seeded and Confirmed (both are "good"); amber only for Needs verification.

## (c) Zero/blank Save behavior
If `base_rate<=0` or `mileage_rate<=0`, `valid=false` → `needs_review:true` persists, row keeps the amber "Needs verification" badge and the Confirm button. Verified by re-reading the badge branch above.

## (d) Verification
Run `tsgo -p tsconfig.app.json` (typecheck only). No test changes.

## Out of scope
Seeding logic, billing math, claim generation, onboarding rates detection, Confirm button behavior, DB schema.
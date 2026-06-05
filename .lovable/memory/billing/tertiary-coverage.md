---
name: Tertiary Coverage Pipeline
description: Patient/trip/claim carry primary, secondary, and tertiary insurance symmetrically. Tertiary claim is spawned by the same engine that spawns secondary, just chained off the secondary instead of the primary. Verify and Discover share eligibility_checks via inquiry_mode; multi-coverage Discover results land in coverage_discoveries.
type: feature
---

## Symmetry rule

Whatever exists for `secondary_*` on `patients`, `claim_records`, and the
billing UI must also exist for `tertiary_*`. When you add a secondary field,
add the tertiary sibling in the same change.

Current pairs:
- `patients.{secondary,tertiary}_payer / _member_id / _group_number / _payer_id / _payer_phone`
- `claim_records.{secondary,tertiary}_claim_generated` (bool) + `_claim_id` (FK back to claim_records)

## Claim chain

```
primary  --paid+CLP--> secondary  --paid+CLP--> tertiary
```

- `createSecondaryClaim(primaryId)` and `createTertiaryClaim(secondaryId)`
  both delegate to `createDownstreamClaim(upstreamId, level)` in
  `src/lib/create-secondary-claim.ts`. Do not fork the implementation —
  add new levels via the `targetLevel` param.
- Office Ally submits whichever payer is in 837P loop 2010BB, so the same
  generator + same SFTP path produces secondary AND tertiary claims. No
  separate integration needed; just a third 837P with the tertiary payer.
- The unique index `claim_records_primary_trip_uidx` only forbids more than
  one row per trip with `original_claim_id IS NULL`. Multiple downstream
  rows per trip are allowed.

## 835 import — opportunity flagging

`src/pages/RemittanceImport.tsx` flags the next-level opportunity after a
CLP posts:
- Matched claim is a **primary** (`original_claim_id IS NULL`) + patient
  has `secondary_payer` → set `secondary_claim_generated = false` on it.
- Matched claim is a **secondary** (`original_claim_id IS NOT NULL`) +
  patient has `tertiary_payer` → set `tertiary_claim_generated = false`
  on it.

Both surface in the "downstream opportunity" queue.

## Eligibility modes

- `eligibility_checks.inquiry_mode` is `'verify'` (default) or `'discover'`.
- Verify hits a known payer+member ID. Discover hits OA with name+DOB only
  and stores per-policy rows in `coverage_discoveries` (one row per
  discovered policy with `rank` = `primary/secondary/tertiary/unknown`).
- Discovered rows are inert until promoted into the patient via
  `coverage_discoveries.promoted_to = 'primary' | 'secondary' | 'tertiary'`.

## UI defaults

- Patient form opens on the Verify tab. Discover tab is a sibling, not a
  separate page.
- Verify "Check Eligibility" and Discover "Discover Coverage" buttons stay
  disabled until the OA REST URLs are pasted into
  `vendor_clearinghouse_settings.eligibility_rest_url_*`. Tooltip on both
  reads "Activate with Office Ally to enable" — same pattern as the existing
  eligibility button.

## What NOT to do

- Do not store tertiary state in JSON blobs or arrays. It must live in
  flat `tertiary_*` columns mirroring secondary so existing SQL/RLS keeps
  working.
- Do not bypass `createDownstreamClaim` to write a tertiary insert by hand —
  the proration logic + CAS replay is non-trivial and shared.
- Do not add a separate "tertiary 837P generator". One generator, three
  payer slots.
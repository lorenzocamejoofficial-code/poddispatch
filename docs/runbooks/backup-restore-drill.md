# Quarterly Backup-Restore Drill

Goal: prove (not assume) that the data is recoverable before a real
incident forces you to find out the hard way.

## Cadence

- Once per calendar quarter, on a Sunday outside business hours.
- Block 2 hours.

## Drill steps

1. **Snapshot inventory.** Run `scripts/backup-tables.sh` (see below). It
   exports every PHI/billing-critical table to `/mnt/documents/backup-<date>/`
   as CSV.
2. **Spin a Cloud branch** (Lovable Cloud → Database → Branches → Create
   from snapshot).
3. **Run integrity checks** against the branch:
    ```sql
    SELECT count(*) FROM trip_records;
    SELECT count(*) FROM pcr_forms WHERE completed_at IS NOT NULL;
    SELECT count(*) FROM claims WHERE status IN ('submitted','accepted','paid');
    SELECT sum(amount_cents) FROM remittance_payments;
    ```
   Counts should match production within tolerance for in-flight writes.
4. **Pick one random row** from each critical table and verify it
   round-trips:
   read from branch → confirm shape matches `src/integrations/supabase/types.ts`.
5. **Tear down the branch.** Cost adds up if you forget.
6. **Log the drill** in `audit_logs` with action=`backup_drill_passed`
   (or `_failed`).

## Failure response

If the drill fails — counts off, schema drift, missing tables — that's a
P0 incident even though no customer is affected yet. Open a ticket, do
not onboard new tenants until resolved.

## Script

`scripts/backup-tables.sh` lives in this repo and produces a CSV dump
suitable for spot-checking. It is not a substitute for Cloud snapshots,
which remain the authoritative recovery mechanism.
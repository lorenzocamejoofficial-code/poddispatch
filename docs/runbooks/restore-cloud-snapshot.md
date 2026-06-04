# Restore from Lovable Cloud Snapshot

**When:** Catastrophic data loss, accidental mass deletion that bypassed
the soft-delete trigger, or compromised tenant.

## Pre-flight (do FIRST)

1. **Stop the bleeding.** Suspend the affected tenant from Creator Console
   so no further writes corrupt the timeline.
2. **Pick the restore point.** Lovable Cloud → Database → Backups. PITR
   covers the last 7 days at second-level granularity. Daily snapshots
   cover the last 30 days.
3. **Decide scope.** Three options:
    - **Full project restore** — fastest, loses every write since the
      snapshot. Only acceptable for total-disaster recovery.
    - **Branch restore** — restore into a new Lovable Cloud branch, then
      cherry-pick rows back via SQL. Preferred for tenant-scoped loss.
    - **Manual SQL recovery** — if the data was logged in `audit_logs`,
      reconstruct from `before_snapshot` / `after_snapshot` columns
      without a restore at all.

## Steps (branch restore)

1. Lovable Cloud → Database → Backups → click the timestamp → **Restore
   into new branch**.
2. Wait ~10 minutes for the branch to come up.
3. Connect via psql with the branch connection string.
4. Verify the lost rows are present:
    ```sql
    SELECT count(*) FROM trip_records WHERE company_id = '<uuid>' AND deleted_at IS NULL;
    ```
5. Export the rows you need to a CSV (use `\copy` in psql).
6. Reconnect to the production project and `INSERT ... ON CONFLICT` the
   recovered rows back in. Watch for FK violations — restore patients
   before trips, trips before legs, legs before PCRs.
7. Insert an `audit_logs` row documenting the restore: who/when/why/scope.

## After

- Unsuspend the tenant.
- Email the customer with a one-paragraph incident report (required under
  BAA if PHI was affected — see §164.410 breach notification).
- File a memory note under `mem://operational/` so the next person sees
  what changed.
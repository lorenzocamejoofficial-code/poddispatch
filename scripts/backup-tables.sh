#!/usr/bin/env bash
# Quarterly backup-drill helper. Exports every PHI/billing-critical
# table to CSV under /mnt/documents/backup-<date>/.
#
# Requires: psql in PATH and PG* env vars pointing at the project DB
# (Lovable Cloud sets these when "Read database" is allowed in Settings).
#
# This is a *spot-check* tool. The authoritative recovery mechanism is
# Lovable Cloud snapshots. See docs/runbooks/backup-restore-drill.md.
set -euo pipefail

if [[ -z "${PGHOST:-}" ]]; then
  echo "PG* env vars not set. Enable 'Read database' in Lovable Cloud settings." >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M)"
OUT="/mnt/documents/backup-${STAMP}"
mkdir -p "$OUT"

TABLES=(
  companies
  company_memberships
  profiles
  patients
  facilities
  trip_records
  legs
  truck_runs
  truck_run_slots
  pcr_forms
  pcr_signatures
  pcr_vitals
  pcr_assessments
  trip_events
  hold_timers
  claims
  claim_line_items
  remittance_files
  remittance_payments
  denials
  office_ally_submissions
  audit_logs
  operational_alerts
  comms_events
)

for t in "${TABLES[@]}"; do
  echo "==> exporting public.${t}"
  psql -X -A -F"," -P pager=off -c "\copy (SELECT * FROM public.${t}) TO STDOUT WITH CSV HEADER" \
    > "${OUT}/${t}.csv" || echo "   (skipped: table missing or unreadable)" >&2
done

echo
echo "Backup written to: ${OUT}"
du -sh "${OUT}"
echo
echo "Spot-check: row counts"
for f in "${OUT}"/*.csv; do
  printf '  %-40s %s\n' "$(basename "$f")" "$(($(wc -l < "$f") - 1)) rows"
done
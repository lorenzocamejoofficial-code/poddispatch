-- Targeted hot-path index for the dispatch/trips list query:
--   WHERE company_id = $1 ORDER BY run_date DESC LIMIT 50
-- The existing (company_id, run_date) index can be backward-scanned, but an
-- explicit DESC composite gives the planner a perfectly ordered match under
-- concurrent insert load and removes the backward-scan tiebreak cost.
CREATE INDEX IF NOT EXISTS idx_trip_records_company_rundate_desc
  ON public.trip_records (company_id, run_date DESC, id DESC);

ANALYZE public.trip_records;
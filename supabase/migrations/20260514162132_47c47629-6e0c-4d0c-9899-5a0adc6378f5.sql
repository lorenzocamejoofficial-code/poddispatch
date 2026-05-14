UPDATE public.loadtest_reports
SET status = 'failed',
    finished_at = COALESCE(finished_at, now()),
    summary = COALESCE(summary, '{}'::jsonb) || jsonb_build_object('failure_reason', 'Run timed out or worker died before completion (auto-failed by janitor).')
WHERE status = 'running'
  AND started_at < now() - interval '10 minutes';
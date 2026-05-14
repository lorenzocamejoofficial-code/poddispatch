
-- 1. Fail any currently stuck "running" report
UPDATE public.loadtest_reports
SET status = 'failed',
    finished_at = now(),
    summary = COALESCE(summary, '{}'::jsonb) || jsonb_build_object(
      'reaped', true,
      'reason', 'Worker did not complete within 5 minutes (edge function wall-clock is ~150s).'
    )
WHERE status = 'running'
  AND started_at < now() - interval '5 minutes';

-- 2. Janitor RPC — system-creator-only sweep of stale runs
CREATE OR REPLACE FUNCTION public.reap_stale_loadtest_reports()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.is_system_creator() THEN
    RAISE EXCEPTION 'Forbidden: system creators only';
  END IF;

  WITH reaped AS (
    UPDATE public.loadtest_reports
    SET status = 'failed',
        finished_at = now(),
        summary = COALESCE(summary, '{}'::jsonb) || jsonb_build_object(
          'reaped', true,
          'reason', 'Worker did not complete within 5 minutes (edge function wall-clock is ~150s).'
        )
    WHERE status = 'running'
      AND started_at < now() - interval '5 minutes'
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM reaped;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.reap_stale_loadtest_reports() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reap_stale_loadtest_reports() TO authenticated;

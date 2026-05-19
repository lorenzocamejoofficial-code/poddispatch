
-- Schedule the daily proactive alerts job (replaces any previous schedule with same name)
DO $$
BEGIN
  PERFORM cron.unschedule('daily-proactive-alerts');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'daily-proactive-alerts',
  '0 6 * * *',
  $cron$ SELECT public.run_daily_proactive_alerts(); $cron$
);

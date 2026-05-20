DELETE FROM public.claim_submission_queue WHERE filename = 'STUCK_TEST.837';
DELETE FROM public.biller_tasks WHERE id = '22118a11-b9b3-433d-b4fb-352c502d4ccf';
DELETE FROM public.notifications WHERE notification_type = 'queue_stuck_pending' AND created_at > now() - interval '10 minutes';
-- Drop overly permissive policy and replace with company-scoped one
DROP POLICY "Crew insert notifications" ON public.notifications;

CREATE POLICY "Crew insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_memberships cm
    WHERE cm.user_id = notifications.user_id
      AND cm.company_id = get_my_company_id()
  )
);
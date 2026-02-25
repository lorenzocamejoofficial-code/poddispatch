-- Allow billers to UPDATE trip_records for billing override purposes
CREATE POLICY "Billing update trip_records for overrides"
ON public.trip_records
FOR UPDATE
USING (is_billing() AND company_id = get_my_company_id())
WITH CHECK (is_billing() AND company_id = get_my_company_id());
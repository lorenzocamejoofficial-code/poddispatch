ALTER TABLE public.patients
  ADD COLUMN prior_auth_trips_authorized integer DEFAULT 40;
COMMENT ON COLUMN public.patients.prior_auth_trips_authorized IS 'RSNAT: round trips authorized by the MAC for this UTN period (CMS allows up to 40 per 60-day period; MAC may authorize fewer).';
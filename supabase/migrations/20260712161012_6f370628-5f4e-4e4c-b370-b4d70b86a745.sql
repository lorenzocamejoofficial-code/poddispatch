ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS state_ems_agency_number TEXT,
  ADD COLUMN IF NOT EXISTS state_ems_license_state TEXT;

COMMENT ON COLUMN public.companies.state_ems_agency_number IS 'State-issued EMS agency/license number (e.g. Georgia DPH EMS agency #). Required for NEMSIS/GEMSIS XML submission — populates dAgency.01.';
COMMENT ON COLUMN public.companies.state_ems_license_state IS 'Two-letter state code that issued the EMS agency license (e.g. GA). Used by future NEMSIS exporter to select the correct state submission endpoint.';
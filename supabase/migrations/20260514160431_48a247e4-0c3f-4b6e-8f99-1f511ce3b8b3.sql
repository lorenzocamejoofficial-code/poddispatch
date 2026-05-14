
-- One-off cleanup of leftover LOADTEST tenants from earlier harness runs.
-- Hard-deletes auth users (cascades profile/membership) and soft-archives companies.

DELETE FROM auth.users WHERE email LIKE '%@loadtest.invalid';

UPDATE public.companies
SET deleted_at = COALESCE(deleted_at, now()),
    onboarding_status = 'suspended',
    suspended_at = COALESCE(suspended_at, now()),
    suspended_reason = COALESCE(suspended_reason, 'LOADTEST cleanup (orphaned)')
WHERE name LIKE 'LOADTEST-%' AND deleted_at IS NULL;

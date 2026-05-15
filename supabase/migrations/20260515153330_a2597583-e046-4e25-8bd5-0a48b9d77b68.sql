-- Cleanup pass for Lorenzo Test Company (f53311c3-a40e-4b2b-b4c2-5aec852f7789)

-- 1. Delete simulated trucks
DELETE FROM public.trucks
WHERE company_id = 'f53311c3-a40e-4b2b-b4c2-5aec852f7789'
  AND is_simulated = true;

-- 2. Delete all facilities for this tenant
DELETE FROM public.facilities
WHERE company_id = 'f53311c3-a40e-4b2b-b4c2-5aec852f7789';

-- 3. Delete empty crews (no members assigned)
DELETE FROM public.crews
WHERE company_id = 'f53311c3-a40e-4b2b-b4c2-5aec852f7789'
  AND member1_id IS NULL
  AND member2_id IS NULL
  AND member3_id IS NULL;

-- 4. Backfill profile emails from auth.users for tenant members
UPDATE public.profiles p
SET email = lower(btrim(u.email))
FROM auth.users u
WHERE p.user_id = u.id
  AND p.email IS NULL
  AND u.email IS NOT NULL
  AND p.user_id IN (
    SELECT user_id FROM public.company_memberships
    WHERE company_id = 'f53311c3-a40e-4b2b-b4c2-5aec852f7789'
  );
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;
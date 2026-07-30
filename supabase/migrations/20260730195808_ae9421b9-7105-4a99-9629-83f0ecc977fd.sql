ALTER TABLE public.system_announcements
  ADD COLUMN IF NOT EXISTS audience_workspaces text[] NOT NULL DEFAULT ARRAY['admin','crew'];
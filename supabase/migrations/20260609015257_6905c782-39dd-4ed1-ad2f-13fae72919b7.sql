
-- 1) system_announcements
CREATE TABLE public.system_announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL,
  tier text NOT NULL DEFAULT 'system' CHECK (tier IN ('action','fyi','system')),
  audience_roles text[] NOT NULL DEFAULT ARRAY['owner','manager','dispatcher','biller','crew']::text[],
  audience_company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  link text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.system_announcements TO authenticated;
GRANT ALL ON public.system_announcements TO service_role;
ALTER TABLE public.system_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone reads relevant announcements"
ON public.system_announcements FOR SELECT
TO authenticated
USING (
  published_at <= now()
  AND (expires_at IS NULL OR expires_at > now())
  AND (audience_company_id IS NULL OR audience_company_id = public.get_my_company_id())
);

CREATE POLICY "Creators manage announcements"
ON public.system_announcements FOR ALL
TO authenticated
USING (public.is_system_creator())
WITH CHECK (public.is_system_creator());

CREATE TRIGGER trg_system_announcements_updated
BEFORE UPDATE ON public.system_announcements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) notification_reads (per-user read & snooze state)
CREATE TABLE public.notification_reads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_table text NOT NULL,
  source_id text NOT NULL,
  read_at timestamptz,
  snoozed_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_table, source_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_reads TO authenticated;
GRANT ALL ON public.notification_reads TO service_role;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own reads"
ON public.notification_reads FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_notification_reads_user ON public.notification_reads(user_id, source_table);

CREATE TRIGGER trg_notification_reads_updated
BEFORE UPDATE ON public.notification_reads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) notification_preferences (per-user)
CREATE TABLE public.notification_preferences (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  digest_mode boolean NOT NULL DEFAULT false,
  muted_categories text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own prefs"
ON public.notification_preferences FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_notification_preferences_updated
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime on the announcements + reads tables so the bell updates live
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_reads;

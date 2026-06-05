CREATE TABLE IF NOT EXISTS public.user_tour_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  page_key text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  skipped boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, page_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_tour_progress TO authenticated;
GRANT ALL ON public.user_tour_progress TO service_role;

ALTER TABLE public.user_tour_progress ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_tour_progress'
      AND policyname='Users read own tour progress'
  ) THEN
    CREATE POLICY "Users read own tour progress"
      ON public.user_tour_progress FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_tour_progress'
      AND policyname='Users insert own tour progress'
  ) THEN
    CREATE POLICY "Users insert own tour progress"
      ON public.user_tour_progress FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_tour_progress'
      AND policyname='Users update own tour progress'
  ) THEN
    CREATE POLICY "Users update own tour progress"
      ON public.user_tour_progress FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_tour_progress'
      AND policyname='Users delete own tour progress'
  ) THEN
    CREATE POLICY "Users delete own tour progress"
      ON public.user_tour_progress FOR DELETE TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_tour_progress'
      AND policyname='System creator read all tour progress'
  ) THEN
    CREATE POLICY "System creator read all tour progress"
      ON public.user_tour_progress FOR SELECT TO authenticated
      USING (is_system_creator());
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS user_tour_progress_user_idx
  ON public.user_tour_progress(user_id);

COMMENT ON TABLE public.user_tour_progress IS
  'Per-user record of which page tours each teammate has seen. One row per (user_id, page_key). Auto-fires first-visit tour when no row exists.';
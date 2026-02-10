
-- 1. Patient status enum
CREATE TYPE public.patient_status AS ENUM ('active', 'in_hospital', 'out_of_hospital', 'vacation', 'paused');

-- Add patient_status to patients table
ALTER TABLE public.patients ADD COLUMN status public.patient_status NOT NULL DEFAULT 'active';

-- 2. Add run_type values
ALTER TYPE public.trip_type ADD VALUE IF NOT EXISTS 'hospital';
ALTER TYPE public.trip_type ADD VALUE IF NOT EXISTS 'private_pay';

-- 3. Leg type enum
CREATE TYPE public.leg_type AS ENUM ('A', 'B');

-- 4. Scheduling legs table
CREATE TABLE public.scheduling_legs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  leg_type public.leg_type NOT NULL,
  pickup_time TIME WITHOUT TIME ZONE,
  chair_time TIME WITHOUT TIME ZONE,
  pickup_location TEXT NOT NULL,
  destination_location TEXT NOT NULL,
  trip_type public.trip_type NOT NULL DEFAULT 'dialysis',
  estimated_duration_minutes INTEGER,
  notes TEXT,
  run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduling_legs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage scheduling_legs" ON public.scheduling_legs FOR ALL USING (is_admin());

-- 5. Truck run slots table (must exist before scheduling_legs crew policy references it)
CREATE TABLE public.truck_run_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  truck_id UUID NOT NULL REFERENCES public.trucks(id),
  leg_id UUID NOT NULL REFERENCES public.scheduling_legs(id) ON DELETE CASCADE,
  slot_order INTEGER NOT NULL DEFAULT 0,
  run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status public.run_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(leg_id, run_date)
);

ALTER TABLE public.truck_run_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage truck_run_slots" ON public.truck_run_slots FOR ALL USING (is_admin());
CREATE POLICY "Crew read own slots" ON public.truck_run_slots FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM crews c
    WHERE c.truck_id = truck_run_slots.truck_id
    AND c.active_date = truck_run_slots.run_date
    AND (c.member1_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
      OR c.member2_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
  )
);
CREATE POLICY "Crew update own slots" ON public.truck_run_slots FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM crews c
    WHERE c.truck_id = truck_run_slots.truck_id
    AND c.active_date = truck_run_slots.run_date
    AND (c.member1_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
      OR c.member2_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
  )
);

-- Now add crew read policy for scheduling_legs (truck_run_slots exists now)
CREATE POLICY "Crew read assigned legs" ON public.scheduling_legs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM truck_run_slots trs
    JOIN crews c ON c.truck_id = trs.truck_id AND c.active_date = scheduling_legs.run_date
    WHERE trs.leg_id = scheduling_legs.id
    AND (c.member1_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
      OR c.member2_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
  )
);

-- 6. Service time settings
ALTER TABLE public.company_settings
  ADD COLUMN grace_window_minutes INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN load_time_minutes INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN unload_time_minutes INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN facility_delay_minutes INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN dialysis_b_leg_buffer_minutes INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN discharge_buffer_minutes INTEGER NOT NULL DEFAULT 20;

-- 7. Push notification subscriptions
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own subscriptions" ON public.push_subscriptions FOR ALL USING (auth.uid() = user_id);

-- 8. Schedule preview log
CREATE TABLE public.schedule_previews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sent_by UUID NOT NULL,
  target_user_id UUID NOT NULL,
  preview_date DATE NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_previews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage previews" ON public.schedule_previews FOR ALL USING (is_admin());
CREATE POLICY "Users read own previews" ON public.schedule_previews FOR SELECT USING (auth.uid() = target_user_id);

-- 9. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduling_legs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.truck_run_slots;

-- 10. Trigger
CREATE TRIGGER update_scheduling_legs_updated_at
  BEFORE UPDATE ON public.scheduling_legs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

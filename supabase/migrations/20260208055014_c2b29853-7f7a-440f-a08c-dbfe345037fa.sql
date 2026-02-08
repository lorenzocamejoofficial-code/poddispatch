
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'crew');

-- Create certification level enum
CREATE TYPE public.cert_level AS ENUM ('EMT-B', 'EMT-A', 'EMT-P', 'AEMT', 'Other');

-- Create sex enum
CREATE TYPE public.sex_type AS ENUM ('M', 'F');

-- Create run status enum
CREATE TYPE public.run_status AS ENUM ('pending', 'en_route', 'arrived', 'with_patient', 'transporting', 'completed');

-- Create trip type enum
CREATE TYPE public.trip_type AS ENUM ('dialysis', 'discharge', 'outpatient');

-- Create schedule days enum
CREATE TYPE public.schedule_days AS ENUM ('MWF', 'TTS');

-- User roles table (security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  sex sex_type NOT NULL DEFAULT 'M',
  cert_level cert_level NOT NULL DEFAULT 'EMT-B',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Company settings
CREATE TABLE public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'PodDispatch',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.company_settings (company_name) VALUES ('PodDispatch');

-- Trucks table
CREATE TABLE public.trucks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.trucks ENABLE ROW LEVEL SECURITY;

-- Crews table (links 2 EMTs to a truck)
CREATE TABLE public.crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id UUID REFERENCES public.trucks(id) ON DELETE CASCADE NOT NULL,
  member1_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  member2_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  active_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;

-- Patients table
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  dob DATE,
  phone TEXT,
  pickup_address TEXT,
  dropoff_facility TEXT,
  chair_time TIME,
  run_duration_minutes INTEGER,
  schedule_days schedule_days,
  weight_lbs INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Runs table
CREATE TABLE public.runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  crew_id UUID REFERENCES public.crews(id) ON DELETE SET NULL,
  truck_id UUID REFERENCES public.trucks(id) ON DELETE SET NULL,
  run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  pickup_time TIME,
  trip_type trip_type NOT NULL DEFAULT 'dialysis',
  status run_status NOT NULL DEFAULT 'pending',
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;

-- Status updates (log of each status change)
CREATE TABLE public.status_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.runs(id) ON DELETE CASCADE NOT NULL,
  status run_status NOT NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.status_updates ENABLE ROW LEVEL SECURITY;

-- Alerts table
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.runs(id) ON DELETE CASCADE,
  truck_id UUID REFERENCES public.trucks(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'yellow',
  dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- RLS Policies

-- user_roles: admins can manage, users can read own
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Users read own role" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- profiles: admins full access, users read own
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- company_settings: admins manage, all authenticated read
CREATE POLICY "All read company settings" ON public.company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins update settings" ON public.company_settings FOR UPDATE TO authenticated USING (public.is_admin());

-- trucks: admins manage, crew read
CREATE POLICY "Admins manage trucks" ON public.trucks FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Crew read trucks" ON public.trucks FOR SELECT TO authenticated USING (true);

-- crews: admins manage, crew read
CREATE POLICY "Admins manage crews" ON public.crews FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Crew read crews" ON public.crews FOR SELECT TO authenticated USING (true);

-- patients: admins full access, crew read patients in their runs
CREATE POLICY "Admins manage patients" ON public.patients FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Crew read assigned patients" ON public.patients FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.runs r
    JOIN public.crews c ON r.crew_id = c.id
    WHERE r.patient_id = patients.id
      AND (c.member1_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
           OR c.member2_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  )
);

-- runs: admins full, crew read/update own
CREATE POLICY "Admins manage runs" ON public.runs FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Crew read own runs" ON public.runs FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.crews c
    WHERE c.id = runs.crew_id
      AND (c.member1_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
           OR c.member2_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  )
);
CREATE POLICY "Crew update own runs" ON public.runs FOR UPDATE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.crews c
    WHERE c.id = runs.crew_id
      AND (c.member1_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
           OR c.member2_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  )
);

-- status_updates: admins read all, crew insert/read own
CREATE POLICY "Admins read status updates" ON public.status_updates FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Crew insert status" ON public.status_updates FOR INSERT TO authenticated WITH CHECK (auth.uid() = updated_by);
CREATE POLICY "Crew read own status" ON public.status_updates FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.runs r
    JOIN public.crews c ON r.crew_id = c.id
    WHERE r.id = status_updates.run_id
      AND (c.member1_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
           OR c.member2_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  )
);

-- alerts: admins full, crew read own truck alerts
CREATE POLICY "Admins manage alerts" ON public.alerts FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Crew read own alerts" ON public.alerts FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.crews c
    WHERE c.truck_id = alerts.truck_id
      AND (c.member1_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
           OR c.member2_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  )
);

-- notifications: users read/update own
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users ack own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins create notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- Enable realtime for runs and status_updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.runs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.status_updates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_runs_updated_at BEFORE UPDATE ON public.runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_company_settings_updated_at BEFORE UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

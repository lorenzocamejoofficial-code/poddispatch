CREATE TYPE public.cert_level_new AS ENUM ('EMR','EMT-B','EMT-A','EMT-P');

ALTER TABLE public.profiles ALTER COLUMN cert_level DROP DEFAULT;

ALTER TABLE public.profiles
  ALTER COLUMN cert_level TYPE public.cert_level_new
  USING (CASE cert_level::text
           WHEN 'AEMT'  THEN 'EMT-A'
           WHEN 'Other' THEN 'EMT-B'
           ELSE cert_level::text
         END)::public.cert_level_new;

DROP TYPE public.cert_level;
ALTER TYPE public.cert_level_new RENAME TO cert_level;

ALTER TABLE public.profiles
  ALTER COLUMN cert_level SET DEFAULT 'EMT-B'::public.cert_level;

CREATE TYPE public.crew_cert_level_new AS ENUM ('EMR','EMT-B','EMT-A','EMT-P');

ALTER TABLE public.crew_certifications
  ALTER COLUMN cert_level TYPE public.crew_cert_level_new
  USING (CASE cert_level::text
           WHEN 'EMT_B'     THEN 'EMT-B'
           WHEN 'EMT_A'     THEN 'EMT-A'
           WHEN 'PARAMEDIC' THEN 'EMT-P'
           WHEN 'EMR'       THEN 'EMR'
           ELSE NULL
         END)::public.crew_cert_level_new;

DROP TYPE public.crew_cert_level;
ALTER TYPE public.crew_cert_level_new RENAME TO crew_cert_level;
DELETE FROM public.crew_certifications c
USING (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, cert_type
           ORDER BY created_at DESC, id DESC
         ) AS rn
  FROM public.crew_certifications
) ranked
WHERE c.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS crew_certifications_user_cert_type_uniq
  ON public.crew_certifications (user_id, cert_type);
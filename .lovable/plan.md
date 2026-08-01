# Unify cert levels to one vocabulary

Final value set everywhere: `EMR`, `EMT-B`, `EMT-A`, `EMT-P`.

## Confirmations (re-verified against the live database)

- `profiles.cert_level` — type `public.cert_level`, NOT NULL, default `'EMT-B'::cert_level`. The default must be dropped before the type swap and restored after.
- `crew_certifications.cert_level` — type `public.crew_cert_level`, nullable, **no default** (confirmed — nothing to drop).
- No functions, policies, views, constraints, or indexes reference either enum or its values. Only these two columns use the types, so nothing blocks either ALTER.
- Data: profiles has only EMT-B / EMT-P; crew_certifications has only EMT_B and NULLs. Zero AEMT, zero Other.

## Migration SQL (one migration)

```sql
-- Part 1: public.cert_level (profiles)
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

-- Part 2: public.crew_cert_level (crew_certifications)
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
```

NULL rows pass through untouched (the CASE yields NULL for NULL input). The AEMT/Other remap matches 0 rows today but is kept so the migration is safe and re-runnable.

## Code edits (after types.ts regenerates)

1. **src/lib/cert-levels.ts (new)** — yes, I'll add the shared constant; it's trivial and stops future drift:
   `export const CERT_LEVELS = ["EMR","EMT-B","EMT-A","EMT-P"] as const;`
   `export type CertLevel = typeof CERT_LEVELS[number];`
2. **src/pages/Employees.tsx** — add form (~650-657) and edit form (~879-886): replace the hardcoded `EMT-B / EMT-A / EMT-P / AEMT / Other` items with a map over `CERT_LEVELS`. Removes AEMT and Other, adds EMR.
3. **src/components/crew/CrewCertificationsDialog.tsx**
   - line 16: `type CertLevel = "EMR" | "EMT_B" | "EMT_A" | "PARAMEDIC"` → import `CertLevel` from the shared constant.
   - lines 194 / 206: default `"EMT_B"` → `"EMT-B"`.
   - select items 407-410: values `EMR / EMT_B / EMT_A / PARAMEDIC` → `EMR / EMT-B / EMT-A / EMT-P`; label "Paramedic" → "EMT-P".
4. **src/pages/CertificationReviewQueue.tsx:285** — drop `.replace("_","-")`, render `r.cert_level` directly. It's the only underscore-display hack in the codebase; nothing else depends on it.
5. **supabase/functions/simulation-lab/index.ts:62** — `VALID_CERT_LEVELS = ["EMR","EMT-B","EMT-A","EMT-P"]`. `normalizeCertLevel` (line 109) keeps its `"paramedic"` → `EMT-P` inbound alias, and `STRICT_CERT_LEVELS = ["EMT-B","EMT-P"]` stays as-is (both values still valid).
6. **src/lib/sandbox-data.ts:185** — `certLevel: "AEMT"` → `"EMT-A"`.
7. **src/components/tour/tourContent.ts:155** — copy "EMT-B, AEMT, EMT-P, CPR, etc." → "EMR, EMT-B, EMT-A, EMT-P, CPR, etc."
8. **Left unchanged (re-confirmed still-valid values)** — the `'EMT-B'` defaults at Employees.tsx 79/87/257/309, create-user:194, setup-system-creator:92, creator-recovery:77, loadtest-harness:133.

## Not in scope

No truck `unit_level`, no minimum-crew rule, no EMR driver-only logic. EMR simply becomes selectable; its restrictions are a later pass.
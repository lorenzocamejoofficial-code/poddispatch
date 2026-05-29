-- Realign public.derive_ambulance_modifier_letter() with the canonical
-- locationTypeCode() in src/lib/edi-837p-generator.ts.
--
-- CANONICAL SOURCE: src/lib/edi-837p-generator.ts locationTypeCode().
-- This is a byte-for-byte mirror (translated to PL/pgSQL). If this function
-- changes, ALL FOUR copies must change:
--   1. src/lib/edi-837p-generator.ts          (canonical)
--   2. src/lib/claim-review-pdf.ts            (mirror)
--   3. src/lib/billing-utils.ts               (mirror)
--   4. public.derive_ambulance_modifier_letter (this function)

CREATE OR REPLACE FUNCTION public.derive_ambulance_modifier_letter(_loc_type text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  t text;
BEGIN
  IF _loc_type IS NULL OR btrim(_loc_type) = '' THEN
    RAISE EXCEPTION 'derive_ambulance_modifier_letter: unmappable origin/destination type: %, upstream did not populate location type', _loc_type;
  END IF;

  t := lower(btrim(_loc_type));

  -- Single-letter passthroughs (already CMS codes).
  IF t ~ '^[degghijnprsx]$' THEN
    RETURN upper(t);
  END IF;

  -- E — Hospital emergency room (check BEFORE generic "hospital").
  IF t LIKE '%emergency room%' OR t LIKE '%hospital er%' OR t = 'er' THEN
    RETURN 'E';
  END IF;

  -- G / J — explicit dialysis subtype strings.
  IF t LIKE '%hospital-based dialysis%' OR t LIKE '%hospital based dialysis%' THEN
    RETURN 'G';
  END IF;
  IF t LIKE '%freestanding dialysis%' THEN
    RETURN 'J';
  END IF;

  -- D — Diagnostic/therapeutic site, incl. generic dialysis when subtype unknown.
  IF t LIKE '%dialysis%' OR t LIKE '%diagnostic%' OR t LIKE '%therapeutic%' THEN
    RETURN 'D';
  END IF;

  -- H — Hospital (general, inpatient, outpatient). Must come AFTER ER check.
  IF t LIKE '%hospital%' THEN
    RETURN 'H';
  END IF;

  -- N — Skilled nursing facility.
  IF t LIKE '%nursing%' OR t LIKE '%snf%' OR t LIKE '%skilled nursing%' THEN
    RETURN 'N';
  END IF;

  -- S — Scene of accident / acute event.
  IF t LIKE '%scene%' THEN
    RETURN 'S';
  END IF;

  -- P — Physician's office.
  IF t LIKE '%physician%' OR t LIKE '%doctor%' OR t LIKE '%clinic%' THEN
    RETURN 'P';
  END IF;

  -- X — Intermediate stop at a physician's office en route to hospital.
  IF t LIKE '%intermediate%' AND t LIKE '%physician%' THEN
    RETURN 'X';
  END IF;

  -- I — Site of transfer (intermediate stop, generic).
  IF t LIKE '%site of transfer%' OR t LIKE '%ift%' OR t LIKE '%intermediate%' THEN
    RETURN 'I';
  END IF;

  -- R — Residence and residence-equivalents.
  IF t LIKE '%residence%' OR t LIKE '%home%' OR t LIKE '%assisted living%'
     OR t LIKE '%rehab%' OR t LIKE '%apartment%' OR t LIKE '%private%' THEN
    RETURN 'R';
  END IF;

  -- No silent fallback. Loud failure mirrors generator behavior.
  RAISE EXCEPTION 'derive_ambulance_modifier_letter: unmappable origin/destination type: %, add an explicit mapping to one of D/E/G/H/I/J/N/P/R/S/X', _loc_type;
END;
$$;
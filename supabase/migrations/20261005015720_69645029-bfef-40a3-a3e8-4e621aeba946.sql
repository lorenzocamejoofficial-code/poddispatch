-- Stage 1 (two-axis classification): additive only. Nothing reads these yet.
-- Reversible: DROP COLUMN transport_kind/payer_class; DROP TYPE transport_kind/payer_class.
CREATE TYPE public.transport_kind AS ENUM ('dialysis','ift','discharge','outpatient','wound_care','psych');
CREATE TYPE public.payer_class AS ENUM ('medicare','medicaid','commercial','facility','self_pay');

ALTER TABLE public.patients        ADD COLUMN IF NOT EXISTS transport_kind public.transport_kind;
ALTER TABLE public.patients        ADD COLUMN IF NOT EXISTS payer_class    public.payer_class;
ALTER TABLE public.scheduling_legs ADD COLUMN IF NOT EXISTS transport_kind public.transport_kind;
ALTER TABLE public.scheduling_legs ADD COLUMN IF NOT EXISTS payer_class    public.payer_class;
ALTER TABLE public.trip_records    ADD COLUMN IF NOT EXISTS transport_kind public.transport_kind;
ALTER TABLE public.trip_records    ADD COLUMN IF NOT EXISTS payer_class    public.payer_class;

COMMENT ON COLUMN public.trip_records.transport_kind IS 'Axis 1 (clinical). Canonical; legacy trip_type/pcr_type retained until contract stage.';
COMMENT ON COLUMN public.trip_records.payer_class IS 'Axis 2 (who pays). Canonical; legacy primary_payer retained until billing stage.';
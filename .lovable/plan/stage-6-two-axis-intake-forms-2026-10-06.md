# Stage 6 — two-axis intake forms

## What changes
- Update **Add Patient (recurring)** and **Create One-Off Run**, including their existing edit/copy initialization.
- Put **Transport kind** (six clinical kinds) and **Payer class** (five payer classes) before patient details. Remove private pay and emergency from the transport choices; emergency remains the existing upgrade path.
- Keep shared demographics, locations, mobility, oxygen and operational controls available for every kind.

## Field visibility
| Transport kind | Specific fields shown |
|---|---|
| Dialysis | Dialysis schedule, chair time/duration and dialysis overrides; one-time chair time |
| Wound care | Wound type, location and stage |
| Psych | Behavioral authorization (including 1013), authorizing facility/physician; existing one-time 1013 and law-enforcement controls |
| IFT / discharge | Sending/receiving facility endpoints; existing one-time physician/discharge details |
| Outpatient | Appointment time and existing appointment duration |

Recurring weekday/date and pickup-time controls remain available for all recurring kinds; dialysis-only labels and overrides will not appear for other kinds.

| Payer class | Insurance billing fields |
|---|---|
| Medicare / Medicaid / commercial | Existing member/payer IDs, insurance coverage, PCS and authorization controls; existing conditional payer requirements |
| Self-pay / facility | Hide insurance fields, insurance readiness warnings and insurance requirements |

Psych clinical authorization stays visible for psych regardless of payer; it is not insurance authorization.

## Validation and persistence
- Use one intake-only axis policy for visibility and required-field evaluation, without changing downstream billing/ePCR rules.
- Adapt existing clinical and payer requirements to the selected axes; hidden fields contribute neither blocking errors nor missing-field warnings. Recompute feedback when either selector changes and use the established inline error treatment.
- Preserve existing data when fields are temporarily hidden; do not erase saved clinical or insurance history merely by switching a selector.
- Save selections through **transport_type / trip_type** and **primary_payer / oneoff_primary_payer** only. Map psych to the legacy `psych_transport` spelling and use payer spellings supported by the existing normalizers.
- Reuse existing storage: recurring sending/receiving facilities use the existing pickup/facility and dropoff fields, and recurring 1013 uses its existing behavioral-authorization choice. No schema additions.

## Verification
- Test all **30 transport × payer combinations** for both forms, including hidden-field validation and switching away from previously filled fields.
- Test selector-to-legacy mappings and ensure form saves do not write the new axes directly.
- Check both screens signed in on desktop and mobile; exercise saves and read back legacy selections and automatically synced axes using disposable test records when a suitable test company is available.
- Report changed forms/helpers, the final visibility matrix, tests and any verification blockers, then stop for review.

## Technical scope
Primary forms: `src/pages/Patients.tsx` and `src/pages/Scheduling.tsx`; a shared intake-only policy/selector and focused tests as needed. No changes to dual-write triggers, billing readers, claim routing, claim trigger, NEMSIS/CTA or XML export. No self-pay price/subtype/payment-terms capture or private-pay queue.
---
name: Auto Rate Seeding
description: Company signup captures business ZIP and auto-seeds charge_master with real CMS 2026 Medicare rates for that locality. The other 4 payer types (medicaid, private, self_pay, default) are inserted as placeholders flagged needs_review=true, and the wizard "Verify Your Rates" gate now requires all 5 payers present with needs_review=false before completing.
type: feature
---
Signup flow:
- CompanySignup.tsx requires Street/City/5-digit ZIP. Edge function company-signup validates and writes address_street/city/state/zip onto companies row.
- After company insert, supabase/functions/_shared/seed-charge-master.ts looks up ZIP → cms_zip_locality (carrier, locality, rural_flag U/R/B) → cms_ambulance_fee_schedule for HCPCS A0428 (base) and A0425 (mileage), picking urban/rural/super-rural column from the flag. Inserts 5 charge_master rows: medicare (real $, needs_review=false), medicaid/private/self_pay/default (zeros, needs_review=true).
- create-company (no-ZIP path) seeds all 5 as needs_review=true placeholders.

Reference tables (system-creator writable, authenticated read):
- cms_zip_locality (~43k rows, 2026Q3 source)
- cms_ambulance_fee_schedule (~1.3k rows, CY2026 PUF)

Wizard gate: useOnboardingProgress / OnboardingWizard.refreshAutoDetect requires all 5 standard payers + base_rate>0 + mileage_rate>0 + needs_review=false. UI shows "Needs verification" / "Auto-seeded" badges and a Confirm button on /billing?tab=charge-master.

Existing companies were backfilled to needs_review=false to avoid retroactively blocking them.

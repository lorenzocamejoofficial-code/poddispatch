---
name: Payer Vocabulary
description: One canonical payer class vocabulary (medicare/medicaid/private/self_pay/default) shared by charts, charge master, compliance rules and claims; self_pay is never submitted to insurance.
type: feature
---
Canonical keys live in src/lib/payer-vocabulary.ts: medicare | medicaid | private | self_pay | default.
- Legacy "cash" -> self_pay, "facility"/"commercial"/"insurance" -> private. Normalized in DB (patients, charge_master, payer_billing_rules) and via normalizePayerKey() at every read/write.
- Patient charts offer 4 (no "default" — that's a rate-table fallback only).
- charge_master has a UNIQUE index on (company_id, lower(payer_type)).
- Self-pay / private-pay is billed directly to the patient: queueClaimsForSubmission hard-blocks it, so it never reaches Office Ally / Medicare / Medicaid.
- Vocabulary is payer-class only; it never touches HCPCS, modifiers, 837P content or NEMSIS/GEMSIS element values (claim-parity tests still pass).

---
name: Payer Compliance Cap
description: Auto-caps patient_responsibility to $0 on 835 posting when primary is Medicaid (42 CFR §447.15) or dual-eligible Medicare+Medicaid secondary. Medicare-coinsurance write-offs in AR Command Center require attestation + 20-char hardship reason (OIG anti-kickback safeguard).
type: feature
---
Helpers: src/lib/payer-compliance.ts → capPatientResponsibility(rawPR, primary, secondary) and isMedicareCoinsuranceWriteOffRisk(claim).

Applied at posting time in two places:
1. src/pages/RemittanceImport.tsx (manual 835 upload) — loads payer_type/payer_name from matched claim_records + secondary_payer from patient. Cap audit-logged with action=edit, notes "PR auto-capped on 835 import: <reason>".
2. supabase/functions/retrieve-remittance-officeally/index.ts (automated Office Ally pull) — same logic, inline to avoid bundling helper.

Pure parser src/lib/edi-835-parser.ts is left alone (it should faithfully report raw CAS PR). Capping is a posting/policy concern.

AR Command Center write-off dialog (src/pages/ARCommandCenter.tsx) shows an amber compliance warning + attestation checkbox + requires a 20+ char reason when isMedicareCoinsuranceWriteOffRisk returns true (payer=medicare && Medicare paid something && balance > 0). Cancel resets attestation + reason. Audit log gains medicare_coinsurance_attested=true flag and a "Medicare coinsurance — hardship attested" note.

What is NOT capped: Medicare-only (legitimate 20% coinsurance + deductible), commercial, self-pay. Those PR amounts remain accurate.

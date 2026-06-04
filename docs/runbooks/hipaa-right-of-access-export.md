# HIPAA Right of Access — Patient/Customer Data Export

Under 45 CFR §164.524 a patient (or their designee) can request a copy of
their PHI within 30 days. Customers can also request a full operational
export when offboarding.

## What you must produce

- All `trip_records` and `legs` for the patient/company
- All ePCR data (`pcr_*` tables)
- All claims, remittances, payments, denials
- Patient demographics, signatures, attached documents
- Audit log entries for the patient/company

## Procedure

1. **Verify identity.** A request from a patient must include name, DOB,
   and proof of identity (driver's license scan). Match against
   `patients` table before exporting anything.
2. **Open the Creator Console → Generate Audit Export.** This calls the
   `generate-audit-export` edge function which produces a zipped JSON
   bundle of every PHI table scoped to the company_id (and patient_id if
   provided). The job records itself in `audit_exports`.
3. **Deliver via secure channel.** Either:
    - Customer's existing SFTP (their problem to provide), or
    - Encrypted ZIP (AES-256) + password sent via a separate channel
      (phone call, not email). Use `openssl enc -aes-256-cbc -pbkdf2`.
4. **Document.** Insert an `audit_logs` row with action=`right_of_access`,
   actor_email = you, before_snapshot = the request details. Required by
   §164.528 (accounting of disclosures).
5. **Acknowledge in writing** within 30 days of the original request.

## What NOT to send

- Other patients' PHI.
- Other tenants' data.
- Internal system creator notes (`creator_notes`, `admin_actions` for
  tenants other than the requesting one).
- Office Ally / clearinghouse credentials.

## Fee

You may charge a reasonable, cost-based fee (paper/copy/labor), but
electronic PDF export is typically free.
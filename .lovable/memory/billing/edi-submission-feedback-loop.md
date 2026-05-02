---
name: EDI Submission Feedback Loop
description: Persisted EDI artifacts and structured rejection capture for diagnosing 837P clearinghouse failures
type: feature
---

Every 837P generated via Billing → EDI Export is persisted to claim_submission_artifacts (full edi_content + filename + claim_ids + byte_size + is_test_submission + generated_by). claim_records.last_submission_artifact_id points to the artifact that was last sent for that claim.

When a clearinghouse rejection comes back, biller uses the AlertTriangle button on each exported claim row to open RecordRejectionDialog. Pasting the raw OA response auto-extracts Loop / Segment / Byte (regex on "LastLoop:", "RecordType:", "Byte N"). Saving writes structured fields onto claim_records: last_rejection_raw, last_rejection_loop, last_rejection_segment, last_rejection_byte, last_rejection_recorded_at, last_rejection_recorded_by — and flips status to 'denied'.

This gives ground truth for diagnosing future rejections: we have both the exact bytes sent AND the exact failure location, instead of guessing from screenshots.

Generator note: DTP*472 (Service Date) is emitted ONLY at Loop 2400 (service line). It is intentionally NOT emitted at Loop 2300 (claim level) — Office Ally rejected our first live submission with "Unknown Segment" pointing at the duplicate claim-level DTP*472. See comment block at line ~482 in src/lib/edi-837p-generator.ts.

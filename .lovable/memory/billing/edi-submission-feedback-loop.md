---
name: EDI Submission Feedback Loop
description: Persisted EDI artifacts and structured rejection capture for diagnosing 837P clearinghouse failures
type: feature
---

Every 837P generated via Billing → EDI Export is persisted to claim_submission_artifacts (full edi_content + filename + claim_ids + byte_size + is_test_submission + generated_by). claim_records.last_submission_artifact_id points to the artifact that was last sent for that claim.

When a clearinghouse rejection comes back, biller uses the AlertTriangle button on each exported claim row to open RecordRejectionDialog. Pasting the raw OA response auto-extracts Loop / Segment / Byte (regex on "LastLoop:", "RecordType:", "Byte N"). Saving writes structured fields onto claim_records: last_rejection_raw, last_rejection_loop, last_rejection_segment, last_rejection_byte, last_rejection_recorded_at, last_rejection_recorded_by — and flips status to 'denied'.

This gives ground truth for diagnosing future rejections: we have both the exact bytes sent AND the exact failure location, instead of guessing from screenshots.

Generator note — Loop 2300 DTP segments confirmed rejected by Office Ally (ambulance 837P, all payer types):
  • DTP*472 (Service Date) — first rejection. Belongs only at Loop 2400.
  • DTP*431 (Onset of Current Illness) — second rejection (999: IK3*DTP*19*2300*2 on OATEST_837P_20260501_1959). Fully suppressed.
Pattern: assume any "situational" DTP at Loop 2300 is "Not Used" by OA. If a payer requires onset, emit at Loop 2400 only.

Reading 999s: IK3*<seg>*<pos>*<loop>*<err> = segment failed; err 2 = Unexpected Segment. IK5*R = txn rejected, AK9*R = functional group rejected.

Clean-accept reference (OATEST_837P_20260501_2306_999): IK5*A + AK9*A*1*1*1 with NO IK3 segments = transaction & group both accepted, no structural defects. After both DTP fixes landed, the generator produced its first spec-compliant 5010 837P. Next layer of feedback comes from 277CA (claim-routing ack), not the 999.

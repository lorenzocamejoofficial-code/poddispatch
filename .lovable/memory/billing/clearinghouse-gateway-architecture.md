---
name: Clearinghouse Gateway Architecture
description: Single Office Ally account routing all tenant claims via NPI; SFTP for 837P submission, HTTP for 835 retrieval
type: feature
---

## Architecture
- All PodDispatch customers submit claims through Lorenzo's single Office Ally account (username: podlorenzo96)
- Claims are routed back to the correct company via their NPI number
- 837P submission: SFTP only (ftp10.officeally.com:22, /inbound folder)
- 835 remittance retrieval: HTTP API, polled every 4 hours, distributed to companies via NPI gateway
- 999 rejections and 277CA acknowledgments: retrieved from /outbound via SFTP

## SFTP Bridge (Railway Worker)
- Supabase Edge Functions cannot do raw TCP (port 22), so a small Node.js worker on Railway handles SFTP
- Worker polls `claim_submission_queue` table every 30 seconds
- Picks up status=pending items, uploads to Office Ally /inbound, updates status to submitted
- Failed uploads retry up to 3 times
- On success, updates related claim_records to status=submitted
- Uses SUPABASE_SERVICE_ROLE_KEY for database access (bypasses RLS)

## Queue Table: claim_submission_queue
- company_id, claim_ids[], filename, edi_content, status, is_test, error_message, attempts
- RLS: company-scoped read, biller/admin insert only

## Downloadable worker package
- Generated at /mnt/documents/poddispatch-sftp-worker/
- Deploy to Railway with env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SFTP_PASSWORD

## Tenant-side surface (locked down)
- Tenants NEVER see per-company Office Ally credential setup. The
  Clearinghouse tab in `/admin-settings` was removed — all SFTP/credential
  configuration is creator-only because every tenant routes through
  Lorenzo's single OA account (NPI-gated).
- Tenants NEVER see OATEST / test-mode envelope toggles. `EDIExport`
  forces `usage_indicator = "P"` and hides the "Submit Single OATEST
  Claim" button unless `isSystemCreator`. Real customers always submit
  live to Office Ally.
- Tenants CAN export their own claims (CSV via Billing & Claims, 837P
  via EDI Export) for their records — that's encouraged. They just can't
  flip envelope/test-mode or touch credentials.

## Single submission funnel (UI)
- There is exactly ONE way for a tenant to submit claims to Office Ally:
  the "Submit to Office Ally" buttons on `/billing-claims` (group submit
  + per-claim drawer submit). Both call `queueClaimsForSubmission`.
- `/edi-export` is download/inspection only for tenants. "Submit to
  Office Ally" on that page is gated behind `isSystemCreator` for
  diagnostic OATEST runs. Tenants see an alert directing them back to
  Billing & Claims for actual submission.
- `SubmissionPipelineStrip` on Billing & Claims renders explainer copy
  ("single or batch, same queue, worker polls ~30s") plus live counts
  (pending in queue, claims sent today, failed). This prevents the
  "did it actually go?" support question and reinforces the one-pipeline
  mental model.

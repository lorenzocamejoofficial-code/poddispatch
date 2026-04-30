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

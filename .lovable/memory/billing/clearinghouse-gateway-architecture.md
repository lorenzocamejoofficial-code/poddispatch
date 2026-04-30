---
name: Clearinghouse Gateway Architecture
description: Single OA account gateway model — all tenants submit/receive through PodDispatch's Office Ally credentials, routed by NPI
type: feature
---
## Architecture
- PodDispatch operates ONE Office Ally account (username: podlorenzo96)
- ALL tenant companies submit 837P claims through this single account via SFTP
- SFTP host: ftp10.officeally.com:22
- Inbound folder (PUT 837s): /Claim/In
- Outbound folders: /Report/Out (999/277CA), /Remittance/Out (835s)
- Claims are NOT submitted per-company — they all flow through PodDispatch's gateway account

## 835 Retrieval Flow
- PodDispatch polls Office Ally every ~4 hours (HTTP API, not SFTP)
- Pulls ALL 835 remittance files from the single account
- Routes each CLP (claim payment) to the correct tenant company by matching Billing Provider NPI (NM1*85)
- NPI mismatches are quarantined for creator review (remittance_quarantine table)
- Already implemented in retrieve-remittance-officeally edge function

## 837P Submission Flow (building)
- Edge function cannot do SFTP (Deno Deploy blocks raw TCP on port 22)
- Need external worker (Cloud Run / Railway) or HTTP-to-SFTP bridge
- Each 837P file contains the tenant company's NPI as Billing Provider
- Office Ally routes to the correct payer based on EDI content

## Key Distinction
- Per-company credentials in clearinghouse_credentials are NOT for separate OA accounts
- There is ONE OA account; the credentials table stores the single shared password
- Company isolation happens via NPI in the EDI content, not via separate accounts
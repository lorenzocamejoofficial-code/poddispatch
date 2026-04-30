---
name: Clearinghouse Gateway Architecture
description: Single OA account gateway model — all tenants submit/receive through PodDispatch's Office Ally credentials, routed by NPI
type: feature
---
## Architecture
- PodDispatch operates ONE Office Ally account (username: podlorenzo96)
- ALL tenant companies submit 837P claims through this single account via SFTP
- SFTP host: ftp10.officeally.com:22
- Inbound folder (PUT 837s): /inbound
- Outbound folder (GET reports): /outbound (999, 277CA, 835, File Summaries)
- Claims are NOT submitted per-company — they all flow through PodDispatch's gateway account

## SFTP Credentials (confirmed Apr 25 OA email)
- Host: ftp10.officeally.com
- Port: 22 (SSH/SFTP only, NOT FTP)
- Username: podlorenzo96
- Password: stored in clearinghouse_credentials.sftp_password
- 999 and 277CA reports: enabled by OA support request

## File Naming (per Companion Guide §4 + OA email)
- Production: must include "837P" in filename, e.g. podlorenzo96_837P_batch_20260430.837
- Test mode: include "OATEST" in filename — OA parses but does NOT forward to payers
- Example test: podlorenzo96_OATEST_837P_batch_20260430.837
- Accepted extensions: .837, .txt, .dat, .edi, .x12 and others (see guide §3.2)

## Response Files (Appendix A naming conventions)
- File Summary: [filename]_FS_[fileID].txt (accepted/rejected/pended/duplicate claims)
- 999: [filename]_999_[fileID].txt (ANSI — confirms OA receipt, NOT payer receipt)
- 277CA: [filename]_277CA_[fileID].txt (ANSI — OA's initial response, NOT payer response)
- 835/ERA: zip containing ANSI 835 + human-readable TXT version

## 835 Retrieval Flow
- PodDispatch polls Office Ally every ~4 hours (currently HTTP API)
- 835s also available via SFTP /outbound folder (could switch to SFTP pickup)
- Pulls ALL 835 remittance files from the single account
- Routes each CLP (claim payment) to the correct tenant company by matching Billing Provider NPI (NM1*85)
- NPI mismatches are quarantined for creator review (remittance_quarantine table)
- Already implemented in retrieve-remittance-officeally edge function

## 837P Submission Flow (building)
- Edge function cannot do SFTP (Deno Deploy blocks raw TCP on port 22)
- Need external worker (Cloud Run / Railway) or HTTP-to-SFTP bridge
- Each 837P file contains the tenant company's NPI as Billing Provider
- Office Ally routes to the correct payer based on EDI content

## ISA Segment Requirements (Companion Guide §7.1)
- ISA05: ZZ (Mutually Defined)
- ISA06: Sender ID (OA account username, padded to 15 chars)
- ISA07: ZZ
- ISA08: 330897513 (OA Tax ID, padded to 15 chars) — NOT "OFFICEALLY"
- GS02: Sender Code (NPI or Tax ID of submitter)
- GS03: 330897513
- GS08: 005010X222A1 (Professional)
---
name: Eligibility REST JSON
description: Office Ally real-time eligibility uses the REST JSON 270/271 API (not raw X12 over HTTP). Endpoint URLs are stored on vendor_clearinghouse_settings.eligibility_rest_url_test/_prod and pasted in by the system creator once OA provisions the eligibility product.
type: feature
---

## Transport
- Real-time eligibility (`check-eligibility` edge function) calls Office Ally's REST JSON 270/271 API.
- Request: JSON body, `Content-Type: application/json`, HTTP Basic auth using the per-tenant OA username + the password stored in `clearinghouse_credentials.sftp_password`.
- Response: JSON 271, parsed for `eligible / isEligible / status`, `coverage_start / coverageStartDate / planBegin`, `coverage_end / coverageEndDate / planEnd`, `message / summary`.

## Endpoint configuration
- URLs are NOT hardcoded. They live on the singleton `vendor_clearinghouse_settings` row:
  - `eligibility_rest_url_test` — used when `test_mode = true`
  - `eligibility_rest_url_prod` — used when `test_mode = false`
- If the relevant URL is null/empty, the edge function fails fast with a clear "endpoint not configured" message instead of hitting a placeholder URL. This is intentional — the eligibility product is paid and not yet active.

## What NOT to do
- Do not rebuild raw X12 270 envelopes here. The submission side (837P claims) still uses X12 over SFTP; eligibility is JSON-only.
- Do not add per-tenant OA eligibility endpoint settings — every tenant routes through PodDispatch's single OA vendor account, same as claims.
- Do not surface OA test-mode toggles to tenants. `test_mode` lives only on `vendor_clearinghouse_settings` and is creator-managed.
# Office Ally Credential Rotation

**Symptom:** Claim submissions start failing with `authentication failed`
or `invalid credentials`. The biller sees errors in
`/billing-claims` after pressing Submit.

## When

- Office Ally forces a password change every ~90 days.
- A new SFTP user was issued for the tenant.
- A customer is migrating off another clearinghouse and gave you their OA
  username for the first time.

## Fix (per-tenant credentials)

Per-tenant OA credentials live in `clearinghouse_settings` and are
encrypted via the `save-clearinghouse-credentials` edge function. They are
NOT in Lovable Cloud secrets.

1. Sign in as the owner of the affected tenant (or use the Creator
   "View as" switcher).
2. Go to **Admin Settings → Clearinghouse**.
3. Paste the new username/password/SFTP password.
4. Press **Test Connection** — must return green before saving.
5. Save. Future submissions will use the new credentials.

## Fix (platform SFTP secret used by the Railway worker)

If the **Railway SFTP worker** uses a shared service account, update its
`SFTP_PASSWORD` env var in Railway (Project → Variables) and redeploy.
The worker reads the value on startup; rolling restart is required.

## Verify

- Submit one low-risk test claim from the biller console.
- Watch `office_ally_submissions` for a row with `status='submitted'`
  within 30 seconds.
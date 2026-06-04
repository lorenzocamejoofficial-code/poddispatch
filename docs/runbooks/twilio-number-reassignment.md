# Twilio Inbound Number Reassignment

**When:** Moving an existing tenant to a new phone number, or onboarding
a new tenant that wants their own dedicated DID.

## Steps

1. **Buy/transfer the number** in Twilio Console → Phone Numbers → Buy a
   Number. Pick one that supports Voice + SMS in the customer's state.
2. **Point voice webhook** at the inbound function:
    - "A Call Comes In" → **Webhook** → POST →
      `https://slyxmgoonugqsnubdrqi.supabase.co/functions/v1/twilio-inbound-voice`
    - "Call Status Changes" →
      `https://slyxmgoonugqsnubdrqi.supabase.co/functions/v1/twilio-call-status-webhook`
3. **Map the number to a tenant** by updating the company's
   `twilio_phone_number` column (Admin Settings → Communications), or via
   SQL:
    ```sql
    UPDATE companies SET twilio_phone_number = '+15555550123' WHERE id = '<company_uuid>';
    ```
4. **If shared platform creds:** confirm `TWILIO_ACCOUNT_SID` /
   `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` secrets are still valid;
   the **System Health** panel reports this in real time.
5. **If per-tenant Twilio subaccounts** are used in the future, store the
   subaccount SID + token per company and use them in
   `make-outbound-call` instead of the platform vars.

## Verify

- Call the new number from a personal phone. Should ring through to
  whatever IVR/forwarding rule the tenant has configured.
- Place an outbound test call from the dispatch board. The
  `comms_events` row should show `from_number` = the new DID.
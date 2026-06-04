# PodDispatch Operational Runbooks

Short playbooks for the things that go wrong in production. Each runbook
answers: *symptom → quick check → fix → verify*. Keep them under one page.

- [stripe-webhook-stuck.md](./stripe-webhook-stuck.md) — Subscriptions don't flip to `active` after checkout.
- [office-ally-credential-rotation.md](./office-ally-credential-rotation.md) — OA password expired or rotated.
- [twilio-number-reassignment.md](./twilio-number-reassignment.md) — Change or move the inbound voice number.
- [hipaa-right-of-access-export.md](./hipaa-right-of-access-export.md) — Customer requests a full data export.
- [restore-cloud-snapshot.md](./restore-cloud-snapshot.md) — Restore the database from a Lovable Cloud snapshot.
- [backup-restore-drill.md](./backup-restore-drill.md) — Quarterly drill: prove the data is recoverable.
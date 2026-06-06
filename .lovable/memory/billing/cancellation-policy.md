---
name: Cancellation Policy
description: Self-serve cancel/reactivate with 90-day read-only export window
type: feature
---
Owners cancel from Admin Settings → Subscription. Trial cancel = immediate read-only, no charge. Paid cancel = `cancel_at_period_end` via Stripe, status `pending_cancellation` until period end (no prorated refund), then `cancelled` (90-day read-only export window, then archived through year 10). One-click reactivation: paid pending → uncancel Stripe sub; fully cancelled → reroute to /choose-plan. Reason captured (too_expensive, switched_competitor, going_out_of_business, missing_feature, too_complex, other). PHI retained 10 years regardless of status. Edge functions: cancel-subscription, reactivate-subscription. Webhook mirrors cancel_at_period_end into subscription_records. Full policy at /legal?tab=cancellation.
---
name: Onboarding Wizard v2
description: 6-step wizard restructured as a navigation layer that routes owners to production pages, with auto-detected step completion. Only Step 1 (company info) keeps an inline form.
type: feature
---
The onboarding wizard at /onboarding is a navigation/guidance layer, not a parallel forms implementation. It enforces the correct setup ORDER and surfaces "Go to [Production Page]" CTAs.

Step layout:
1. Verify Company Info — inline form (no production page edits company info beyond signup). Validates NPI 10 digits, EIN 9 digits, ZIP 5/9.
2. Verify Your Rates → /billing?tab=charge-master. Auto-completes when ≥1 charge_master row has base_rate>0 AND mileage_rate>0.
3. Connect Your Clearinghouse → /settings?tab=clearinghouse. Auto-completes when clearinghouse_settings.is_configured=true.
4. Add Your Trucks → /trucks. Auto-completes when ≥1 truck row exists with is_simulated=false.
5. Add Your Crew → /employees. Auto-completes when ≥1 profile row exists with user_id != owner.user_id.
6. Add Your First Patient → /patients. Auto-completes when ≥1 patient row exists with is_simulated=false.

Each navigation step shows: blurb, status panel (complete/incomplete), "Go to..." CTA, "Re-check status" button, and "Mark Complete" fallback. The wizard re-checks status on window focus so when the owner returns from a production page, completion is detected automatically. Steps stay hard-locked: step N+1 is only opened when N is done. Progress is persisted in migration_settings via useOnboardingProgress.

Tier-3 follow-ups (not yet shipped):
- /trucks Add dialog should capture equipment booleans (has_power_stretcher, has_stair_chair, has_oxygen_mount, has_bariatric_kit, has_bariatric_stretcher) at creation, matching the old wizard's coverage.
- /employees Edit flow should call the update-crew-member edge function so email/role can be changed (currently only the wizard's removed edit flow could).
- ClearinghouseSettings folder defaults of /upload and /download appear wrong; Office Ally onboarding emails use outbound and inbound. Verify and align.

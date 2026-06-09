---
name: Notification Center
description: Unified bell in all layouts unioning operational/billing/clinical/system events with per-user read state and Owner digest mode
type: feature
---
Single notification bell in AdminLayout, CrewLayout, and CreatorLayout headers replaces all sidebar number badges.

Source tables unioned by useNotificationFeed(mode):
- system_announcements (everyone)
- notifications, operational_alerts, claim_creation_failures, claim_records (denied), biller_tasks, qa_reviews, safety_overrides, billing_overrides, subscription_status_history (admin)
- support_tickets, companies (pending_approval/payment_issue), email_send_log (creator)

Three tiers drive sorting and styling:
- action: PCR kickbacks, denials, overrides, emergencies, claim failures — red, pulsing dot
- fyi: tasks, schedule changes, QA yellow flags — grey dot, hidden in digest mode
- system: announcements, email logs — pinned section

Per-user read/snooze state in notification_reads. Per-user digest_mode preference in notification_preferences (default off). Digest mode hides FYI from live bell; daily morning digest cron deferred.

Only system_creators can publish system_announcements via AnnouncementComposer on /creator-console (Announcements tab). Audience targeted by role[] and optional company_id.

Click any row marks-read + navigates to its link. Sidebar number badges removed; bell is single source of truth.

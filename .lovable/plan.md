# Notification Center

A single bell icon in every layout (Admin, Crew, Creator) that unifies every operational/billing/clinical/system event into one role-scoped, click-to-jump feed. Replaces the sidebar number badges.

## What goes in the bell (by source)

| Source table | Feeds | Who sees it |
|---|---|---|
| `system_announcements` (new) | Creator → all tenants ("v2.4 released — what's new") | Everyone |
| `notifications` | PCR kickbacks, schedule changes already in DB | Crew (assigned), Dispatcher, Owner |
| `operational_alerts` + `alerts` | Hold timers, failed calls, dispatch ops | Dispatcher, Owner |
| `claim_creation_failures` + denied `claim_records` | Claim failures, denials, 835 posted | Biller, Owner |
| `biller_tasks` | AR tasks, follow-ups | Biller, Owner |
| `qa_reviews` (pending) | QA queue | Biller, Owner |
| `incident_reports` (new) | Clinical/safety incidents | Dispatcher, Owner |
| `safety_overrides` + `billing_overrides` | Audit-worthy overrides logged | Owner only |
| `support_tickets` (replies) | Ticket creator notified | Ticket creator |
| `subscription_status_history` | Trial ending, payment issue | Owner only |
| `comms_events` (outbound emails) | "Email sent to X — confirmation" | Creator (system-wide), Owner (own tenant) |
| `company_verifications` | NPI/OIG queue | Creator |

## Three tiers (drive sort order + auto-expire)

1. **Action Required** — PCR kickback, denial, override needs review, emergency upgrade. Red dot. Stays until clicked.
2. **FYI** — Crew submitted PCRs, 835 posted, schedule changed. Grey dot. Auto-marks read after 7 days.
3. **System** — Creator announcements, email-sent logs. Pinned top section.

## Anti-flood (Owner-specific)

- **Grouping** — `"12 PCRs submitted today"` collapses; expand for the list. Keyed by `(type, day)`.
- **Digest mode toggle** — Owner setting in Account Settings. When ON, FYI items are suppressed from the bell live and bundled into a daily 8am summary notification. Default = OFF (see everything, grouped).
- **Snooze** — right-click any row → 4h / tomorrow / next week.
- **Smart routing** — billing FYIs go to Biller's bell directly; on the Owner bell they appear under a collapsible "Team Activity" subsection.

## Sidebar badges

Remove the existing `useSidebarBadges` red number dots from sidebar nav items. Bell is the single source of truth.

## Click-to-jump

Every row carries a `link`. Clicking marks read + navigates:
- PCR kickback → `/pcr/{trip_id}`
- Claim denial → `/billing-and-claims?claim={id}&tab=denials`
- Schedule change → `/scheduling?date={date}&truck={id}`
- Override → `/override-monitor?row={id}`
- Incident → `/compliance-and-qa?tab=incidents&id={id}`

## Creator-side bell

Dedicated feed in CreatorLayout:
- New signups, suspensions, NPI/OIG queue
- Support tickets opened
- Failed payments across tenants
- Email-sent log (every outbound system email — auth confirm, password reset, invite, billing receipt) so you know to chase one if it didn't land
- Edge function errors (from existing `audit_logs` where `severity = 'error'`)
- Tenant `provisioning_failed` / `payment_issue`

Plus an **Announcement Composer** on `/creator-console`:
- Title, body (markdown), tier (Action / FYI / System), audience (all tenants / specific roles / specific company)
- "Publish" inserts into `system_announcements` → fans out to every targeted user's bell

## Tech sketch

**New tables (migration):**
- `system_announcements` (id, title, body, tier, audience_role[], audience_company_id, created_by, published_at, expires_at)
- `notification_reads` (id, user_id, source_table, source_id, read_at, snoozed_until)
- `notification_preferences` (user_id PK, digest_mode bool, muted_categories text[])
- `incident_reports` already exists ✓ (verified earlier)

**Hooks:**
- `useNotificationFeed()` — runs in parallel: 11 queries scoped by role + activeCompanyId, dedupes against `notification_reads`, returns `{ actionRequired[], fyi[], system[], unreadCount }` with grouping applied client-side. 60s polling + realtime subscription on `notifications`/`operational_alerts`/`claim_creation_failures`.
- `useNotificationPreferences()` — read/write digest toggle.

**Components:**
- `<NotificationBell />` — header icon + unread dot
- `<NotificationPanel />` — slide-over (Sheet), 3 sections, grouped rows, mark-all-read, snooze menu
- `<NotificationPreferencesCard />` — in AccountSettings
- `<AnnouncementComposer />` — in CreatorConsole

**Wiring:**
- AdminLayout header → `<NotificationBell />`
- CrewLayout header → `<NotificationBell mode="crew" />`
- CreatorLayout header → `<NotificationBell mode="creator" />`
- Delete `useSidebarBadges` consumers in admin sidebar

**Digest cron (deferred):** daily 8am job to bundle FYI for digest-mode users. Skipped in this first cut — toggle just suppresses FYI from the live bell for now; we wire the cron later. Owner notes this in the preference card.

## Out of scope (this PR)

- Email/SMS push of notifications (in-app only for now)
- Mobile push (separate PWA push pipeline already exists for crew schedule changes — we don't duplicate)
- The 8am digest cron itself (toggle works; cron lands in follow-up)

## Acceptance

- Bell appears in all 3 layouts with live unread count
- Owner bell shows everything grouped, with "Team Activity" collapsible section
- Biller bell shows only billing/QA + creator announcements
- Crew bell shows only their truck's schedule changes, PCR kickbacks, emergencies on their run
- Dispatcher bell shows dispatch + schedule + emergency
- Creator bell shows system-wide ops + email log + announcement composer link
- Sidebar number badges removed
- Per-user read state — Owner reading doesn't clear for Biller
- Digest toggle exists in Account Settings (cron noted as coming soon)
- Click any row → marks read + jumps to the right page

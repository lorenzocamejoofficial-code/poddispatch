# Project Memory

## Core
Strict limits: max 4 admins, 30 crews, 30 trucks, 10 runs/truck.
High-risk actions (deletions, overrides) require CONFIRM/OVERRIDE gates.
Multi-tenant isolation: strict RLS & company_id filters on all realtime subscriptions and edge functions.
5 roles: Creator, Owner, Dispatcher, Biller, Crew. Certified admins bypass Crew gates.
HIPAA compliant: 30-min auto-logout, 7-year trip data retention default.
Safety matrix: Bariatric runs without power stretcher and MF/FF crews are BLOCKED.
ePCR timestamps are strictly chronological. 0 is a valid odometer reading.
45-min minimum scheduling gap enforced on truck assignments.
Stripe for subscriptions, Office Ally HTTP API for claims/eligibility.
Run record (scheduling_legs) is single source of truth for transport context cascading.

## Memories
- [Scope and Identity](mem://project/scope-and-identity) — Comprehensive NEMT OS from dispatch to billing
- [System Limits](mem://constraints/system-limits) — Strict operational caps for system creation
- [Notification System](mem://features/notification-system) — PWA notifications for real-time crew alerts
- [Deletion Policy](mem://domain/deletion-policy) — Single/bulk deletion with confirmation dialogs
- [Confirmation Gates](mem://security/confirmation-gates) — High-risk actions require CONFIRM or OVERRIDE strings
- [System Level Settings](mem://features/system-level-settings) — Global configuration and company data reset tool
- [Simulation Lab Harness](mem://features/simulation-lab-harness) — Sandbox for seeding scenarios and dispatch pressure model
- [Tenant Management](mem://admin/tenant-management) — Tenant lifecycle, suspension, and 30-day soft delete
- [Facility Management](mem://domain/facility-management-and-lifecycle) — Six standard facility types with clinical/financial metadata
- [Override Monitor](mem://features/override-monitor) — Central audit dashboard for safety/billing overrides
- [Dispatch Intelligence Engine](mem://features/dispatch-intelligence-engine) — Escalating hold timers tracking active trip delays
- [Subscription Infrastructure](mem://billing/subscription-infrastructure) — Stripe integration with safe build mode and 45-day trials
- [Auto Leg Generation](mem://logic/auto-leg-generation) — B-leg creation duration settings per transport type
- [Safety Matrix v2](mem://logic/safety-matrix-v2) — Assignment evaluation blocking specific bariatric run scenarios
- [Login and Landing v2](mem://auth/login-and-landing-v2) — Dual-entry login with biometric support
- [Employee Management Rules](mem://constraints/employee-management-rules) — Blocks duplicate contacts and duplicate daily truck assignments
- [HIPAA Compliance](mem://security/hipaa-compliance) — 30-minute inactivity auto-logout policy
- [Loaded Miles Calculation](mem://logic/loaded-miles-calculation) — Auto-calculated loaded miles (Destination - Scene odometer)
- [Schedule Change Notifications](mem://features/schedule-change-notification-system) — Real-time banners for changes/cancellations
- [PCR Correction Workflow](mem://billing/pcr-correction-workflow) — Targeted field corrections with mandatory reasons
- [PCR Timestamp Integrity](mem://logic/pcr-timestamp-integrity) — Chronological sequence requirement for transport timestamps
- [Hold Timer Automation](mem://logic/hold-timer-automation) — Auto-stopping active hold timers via timestamp entries
- [Scheduling Gap Standards](mem://constraints/scheduling-gap-standards) — 45-minute minimum time gap between runs per truck
- [Truck Assets and Maintenance](mem://domain/truck-assets-and-maintenance) — OOS status blocking operational assignments
- [Role Based Access Control](mem://auth/role-based-access-control) — 5-role matrix, with direct Crew UI access for certified admins
- [Scheduling Reassignment Workflow](mem://features/scheduling-reassignment-workflow) — 45-minute conflict checks and PCR continuity during reassignment
- [Compliance and Audit Readiness](mem://billing/compliance-and-audit-readiness) — 30-min duplicate detection, 7-year retention policy
- [Georgia DPH Inspection Master](mem://domain/georgia-dph-inspection-master) — 10-category master list for vehicle inspections
- [Dispatch Communications Hub](mem://features/dispatch-communications-hub) — Queued automated calls with duplicate prevention
- [ePCR Vitals Documentation v2](mem://features/epcr-vitals-documentation-v2) — Mandatory vitals validation before recording At Destination
- [Triple Crew Support](mem://features/triple-crew-support) — 3-member crew schema and operational assignments
- [Secondary Insurance Workflow](mem://billing/secondary-insurance-workflow) — Auto-detection of secondary coverage opportunities post-primary payment
- [ePCR Rules and Transport Types](mem://features/epcr-rules-and-transport-types) — Mandatory assessment gates based on transport and payer type
- [Multi Company Hardening](mem://security/multi-company-hardening) — Strict RLS scoping isolating multi-tenant data
- [Public Compliance Documents](mem://legal/public-compliance-documents) — TOS, Privacy, BAA access directly inside signup flow
- [Support Ticketing](mem://features/support-ticketing) — In-app issue reporting tool with 24-hour guarantee
- [System Standards](mem://architecture/system-standards) — Modular structure, Zupabase selected date context, max 1k rows
- [Patient and Trip Logic](mem://domain/patient-and-trip-logic) — Patient metadata structure mapping to future legs
- [Crew Management and Workspace](mem://features/crew-management-and-workspace) — PWA workspace with pulsing notification badges
- [Emergency Upgrade Finalized](mem://features/emergency-upgrade-finalized) — 120s accidental trigger window before escalating to emergency
- [Automated Verification and Metrics](mem://creator/automated-verification-and-metrics) — Edge functions for automated NPI/OIG compliance checks
- [Charge Master Navigation](mem://billing/charge-master-navigation) — Configurable base/mileage rates across 5 standard payer types
- [EDI Export Access](mem://billing/edi-export-access) — Hidden route /edi-export for 837P file generation
- [Onboarding Wizard v2](mem://features/onboarding-wizard-v2) — 6-step setup saving progress via migration_settings
- [PCR Persistence and Visibility](mem://features/pcr-persistence-and-visibility) — Historical read access for assigned crews' incomplete PCRs
- [Trip Record Management](mem://features/trip-record-management) — Admin updates syncing immediately to claim records
- [PCR System Behavior and QA](mem://logic/pcr-system-behavior-and-qa) — Per-field debounce and 10-point checklist before claim submission
- [Clearinghouse Integration Standards](mem://billing/clearinghouse-integration-standards) — Office Ally HTTP integration and eligibility syncs
- [PCR Cancellation Workflow](mem://features/pcr-cancellation-and-refusal-workflow) — Patient Refusal forms and cancellation documentation loop
- [ePCR Signature Workflow](mem://features/epcr-signature-and-attestation-workflow) — Multi-type signatures and Partner Sign Here modals
- [Onboarding Context Capture](mem://creator/onboarding-context-capture) — Capturing extended info for system creator review
- [Clinical Incident Reporting](mem://features/clinical-incident-reporting) — Capturing field events and alerting Dispatch Board
- [Medicare Ambulance Standards](mem://billing/medicare-ambulance-standards) — 837P HCPCS standard mappings and logic for generators
- [Scheduling Data Integrity](mem://features/scheduling-data-integrity) — Blocking assignment to inactive trucks and enforcing copy-forward rules
- [Operational and Financial Metrics](mem://features/operational-and-financial-metrics) — Formulas distinguishing active windows for accurate dashboard metrics
- [Optimistic Concurrency Controls](mem://billing/optimistic-concurrency-controls) — Rejecting saves based on outdated 'updated_at' claim timestamps
- [Pre Submit Checklist Logic](mem://billing/pre-submit-checklist-logic) — Dynamic gates skipping PCS checks on emergency transports
- [Claim Deduplication](mem://billing/claim-deduplication-and-integrity) — Database-level constraints on leg_id blocking sync duplicates
- [Data Sync and Backfill](mem://billing/data-sync-and-backfill) — Ensuring metadata parity between trip logs and final claims
- [Alert Maintenance Policy](mem://features/alert-maintenance-policy) — Deleting 30-day old dismissed alerts on dispatch load
- [Dispatch Surveillance Hub](mem://architecture/dispatch-surveillance-hub) — Read-only field monitoring configuration with AbortControllers
- [Technical Debt and Limitations](mem://architecture/technical-debt-and-limitations) — Unresolved missing 2FA and manual text locations
- [HIPAA Workforce Gate](mem://security/hipaa-workforce-gate) — First-login modal requiring legal HIPAA acceptance
- [Creator Access Control](mem://security/creator-access-control) — Restricting system creator data visibility and modifying powers
- [835 Remittance Import Logic](mem://billing/835-remittance-import-logic) — CLP01 parsing to match electronic payments to claim records
- [AR Command Center](mem://billing/ar-command-center) — 5-stage taxonomy for billing risk and follow up workflows
- [Denial Recovery Engine](mem://billing/denial-recovery-engine) — Guided checklists tracking resubmission history per trip record
- [Missing Money Detection](mem://billing/missing-money-detection) — 5-category scanner identifying lost or at-risk revenue
- [Payer Contact Directory](mem://billing/payer-contact-directory) — Payer database driving timely filing calculation limits
- [Automated Task Escalation](mem://billing/automated-task-escalation) — Push-based generated tasks replacing manual AR queues
- [Unified Work Queue](mem://billing/unified-work-queue) — Unified prioritized task queue integrating trips and incomplete PCRs
- [Claim Probability Scoring](mem://billing/claim-probability-scoring) — Advisory 0-100 metric for first-pass claim acceptance
- [Timely Filing Logic](mem://billing/timely-filing-logic) — Payer-specific day limits highlighting expiring claims
- [System Audit Document](mem://billing/system-audit-document) — Reference to PodDispatch_Billing_System_Audit.md documentation
- [Hold Timer Wait Time Integration](mem://billing/hold-timer-wait-time-integration) — Accumulating resolved hold timers into billable wait minutes
- [Identified System Gaps](mem://billing/identified-system-gaps) — Outstanding batch operations and API gating limitations
- [Crew Schedule Delivery](mem://logic/crew-schedule-delivery) — Leg exceptions applied dynamically to daily run sheets
- [Board Health Logic](mem://dispatch/board-health-logic) — Evaluating fleet pre-progress vs active operational statuses
- [Transport Context Cascading](mem://features/transport-context-cascading) — Run record drives service level, HCPCS, PCS, PCR sections, QA rules downstream

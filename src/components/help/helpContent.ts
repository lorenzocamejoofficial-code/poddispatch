/** Per-route help content config. Edit this file to update help text without touching page UI. */

export interface HelpSection {
  does: string[];
  doesNot: string[];
  tips?: string[];
}

export const PAGE_HELP: Record<string, { title: string; content: HelpSection }> = {
  "/": {
    title: "Dispatch Board",
    content: {
      does: [
        "Shows all active trucks and their assigned crew for the selected date.",
        "Displays every run assigned to each truck, in order, with current status.",
        "Highlights the current active run on each truck.",
        "Patient Not Ready Alerts section: shows open alerts sent by crew when a patient is unavailable. Each alert includes truck name, patient, run number, pickup time, next run time, and the crew's note.",
        "Truck cards show a red alert badge when that truck has an open Patient Not Ready alert.",
        "Resolve button dismisses a Patient Not Ready alert once the situation is handled.",
        "Updates in real time — status changes and Not Ready alerts from crew links appear here automatically.",
        "Shows billing readiness status and revenue strength badges per truck.",
        "Shows safety badges when crew/patient safety rules are flagged.",
        "Shows timing risk badges for runs at risk of being late.",
        "Displays HCPCS codes, loaded miles, and estimated charge per completed run.",
      ],
      doesNot: [
        "Does not let you create or edit runs from this screen — use Scheduling for that.",
        "Does not show historical runs from past dates (change date in the sidebar date picker).",
        "Does not calculate drive-time conflicts or route optimization.",
        "Does not send notifications to crew — use Crew Schedule Delivery for that.",
        "Resolving a Patient Not Ready alert does not automatically move any runs — use Scheduling to reassign.",
      ],
      tips: [
        "When a Patient Not Ready alert appears, check the next run time to judge urgency — if the next run is 30+ min away, there may be time to wait.",
        "If a delay is severe, open Scheduling to drag that run to a later position in the truck's sequence.",
        "If a truck shows no crew, it means no crew was assigned for that date in Trucks & Crews.",
        "If runs are missing, check that they were assigned to the truck in Scheduling.",
      ],
    },
  },

  "/dispatch": {
    title: "Dispatch Board",
    content: {
      does: [
        "Shows all active trucks and their assigned crew for the selected date.",
        "Displays every run assigned to each truck, in order, with current status.",
        "Highlights the current active run on each truck.",
        "Patient Not Ready Alerts section: shows open alerts sent by crew when a patient is unavailable.",
        "Truck cards show a red alert badge when that truck has an open Patient Not Ready alert.",
        "Updates in real time — status changes and Not Ready alerts from crew links appear here automatically.",
        "Shows billing readiness, revenue strength, safety, and timing risk badges per truck.",
      ],
      doesNot: [
        "Does not let you create or edit runs from this screen — use Scheduling for that.",
        "Does not show historical runs from past dates.",
        "Does not calculate drive-time conflicts or route optimization.",
        "Does not send notifications to crew — use Crew Schedule Delivery for that.",
      ],
      tips: [
        "If a truck shows no crew, assign crew for that date in Trucks & Crews.",
        "If runs are missing, check that they were assigned to the truck in Scheduling.",
      ],
    },
  },

  "/scheduling": {
    title: "Patient Runs / Scheduling",
    content: {
      does: [
        "Shows a 7-day weekly overview — click any day to open the daily drill-down.",
        "Daily Ops Snapshot bar: shows active trucks, total runs, unassigned count, avg runs/truck, empty trucks, overloaded trucks (>8 runs), DOWN trucks, and trucks with no crew.",
        "Auto-Fill: generates A and B legs from patient recurrence profiles (Dialysis, Outpatient, and custom recurrence days) for the selected date. All generated runs go into the Unassigned Run Pool.",
        "Run Pool: a collapsible panel that lists all unassigned runs for the day. Runs are grouped by transport type and A/B legs with collapsible groups and count badges.",
        "Run Pool filters: search box, A/B toggle, and transport type buttons to narrow the list. Sort by pickup time or destination.",
        "Supports all transport types — Dialysis, Outpatient/Wound Care, Ad-hoc, Discharge, Hospital, and Private Pay runs all appear correctly.",
        "Drag any pool card to a truck to assign it. Drag an assigned run back to the pool to unassign it. Drag within a truck to reorder slots.",
        "Default Setup Template: save which transport types and leg types go to which truck. Apply on future matching days to auto-place runs.",
        "Two apply modes: 'Apply to unassigned only' (safe default) or 'Rebuild all from template' (clears all slots first).",
        "Upcoming Non-Dialysis Transports panel: shows outpatient, discharge, hospital, private pay, and ad-hoc legs for the next 7–30 days.",
        "Manually create A-legs and B-legs for ad-hoc runs (discharge, hospital, private pay).",
        "Exception editing: change pickup location, time, or notes for ONE date only — the recurring series is unchanged.",
        "Each truck card shows a utilization badge and first/last pickup time.",
        "Trucks marked DOWN show a red badge — runs cannot be added.",
        "Copy Week: copies all crew assignments and schedule from a source week to a target week you select.",
        "Operational Alerts panel: shows and lets you resolve late/conflict alerts.",
        "Comms Outbox: view pending communication events for the day.",
      ],
      doesNot: [
        "Does not auto-optimize routes or calculate drive-time conflicts between legs.",
        "Does not send anything to crew — share links are in Crew Schedule Delivery.",
        "Does not delete or edit patient profiles — use the Patients page for that.",
        "Does not prevent assigning the same patient twice on the same day.",
        "Does not automatically move runs off a truck that goes down — dispatcher must reassign manually.",
        "The Non-Dialysis panel does not show dialysis runs, does not auto-assign runs.",
      ],
      tips: [
        "Check the Upcoming Non-Dialysis panel at the start of each week to catch ad-hoc trips.",
        "On a 100-run day: use Auto-Fill first, then open the Run Pool. Work transport group by transport group.",
        "Dialysis A-legs all go to the same facilities — cluster them by destination sort before assigning.",
        "A-legs are pickups (home to facility). B-legs are returns (facility to home).",
        "Exception edits show a branch icon and are reflected on the crew run sheet.",
        "Template stores rules (e.g. Truck 1 = Dialysis A+B), not specific patient IDs — works even when the patient list varies.",
        "Concurrent edit protection: if another user updates the same schedule, you'll be prompted to refresh before overwriting.",
      ],
    },
  },

  "/trucks": {
    title: "Trucks & Crews",
    content: {
      does: [
        "Lets you add trucks to your fleet and rename existing trucks.",
        "Shows a Sunday–Saturday weekly calendar grid — every truck × every day of the week at a glance.",
        "Today's column is visually highlighted so dispatchers can quickly identify the current date.",
        "Lets you assign, edit, or clear crew members on any truck for any day — including days weeks in advance.",
        "Crew member dropdown only shows employees belonging to your company (multi-tenant safe).",
        "Navigate backward or forward by week using the Previous / Next buttons; jump to today anytime.",
        "Copy Week: select a source week and a destination week — all crew assignments are duplicated without overwriting existing ones.",
        "Lets you mark a truck as Down (Maintenance or Out of Service) for a specific date range.",
        "Removing a down record instantly restores that truck to available.",
        "Crew assignments created here appear in Scheduling, Dispatch Board, and Crew Run Sheets automatically.",
        "Uses atomic crew assignment (safe_assign_crew) to prevent duplicate or conflicting crew assignments.",
      ],
      doesNot: [
        "Does not enforce that the same employee is only on one truck per day — avoid double-assigning manually.",
        "Does not auto-generate share links — do that in Crew Schedule Delivery.",
        "Does not affect scheduling legs — legs are assigned to trucks in the Scheduling page.",
        "Does not delete runs already assigned to a down truck — those must be manually reassigned in Scheduling.",
        "Does not track maintenance history beyond the date range you enter.",
      ],
      tips: [
        "Crew members must be created in Employees (marked Active) before they appear here.",
        "Hover any cell to reveal Assign, Edit, and Mark Down actions.",
        "Mark a truck down BEFORE assigning crew for that day.",
        "Crew must be assigned for a date BEFORE generating a share link for that day in Crew Schedule Delivery.",
        "The copy week function clearly shows which source week you are copying from and lets you pick the destination.",
      ],
    },
  },

  "/employees": {
    title: "Employees",
    content: {
      does: [
        "Lists all employees for your company only (multi-tenant isolated — no cross-company visibility).",
        "The company Owner is automatically shown — the Owner account is created when the company is set up.",
        "Lets you create employee accounts with login credentials (email + password) and assign a role: Admin, Dispatcher, or Crew.",
        "Stores employee info: name, phone, certification level, sex, and training flags (bariatric, oxygen, stair chair, lift assist).",
        "Shows max safe team lift weight per employee.",
        "Lets you toggle employees between Active and Inactive.",
        "Lets you search employees by name or phone number.",
        "Shows inactive employees when 'Show inactive' is toggled on.",
        "Lets you select and bulk-delete multiple employees at once.",
        "Lets you delete individual employees with confirmation.",
        "Invite system: send invite links to new employees via email with a specific role.",
        "Shows pending invites with copy-to-clipboard token links.",
        "Lets you cancel pending invites.",
      ],
      doesNot: [
        "Does not reset employee passwords — use Account Settings or contact your administrator.",
        "Does not show employee shift history or run history.",
        "Does not auto-text crew — phone numbers are stored for reference; messages are sent via Crew Schedule Delivery.",
        "Does not manage certifications or expiry dates beyond the cert level label.",
      ],
      tips: [
        "Mark employees Active before assigning them to a crew in Trucks & Crews.",
        "Only Active employees appear in crew assignment dropdowns.",
        "Use Crew role for field staff, Dispatcher for dispatch access, Admin for full access.",
        "Use the invite system to onboard new employees — they'll receive a link to create their account.",
      ],
    },
  },

  "/patients": {
    title: "Patients",
    content: {
      does: [
        "Stores patient records including name, DOB, phone, pickup address, and notes.",
        "Drop-off facility is selected from a dropdown of your company's facilities — or you can quick-add a new facility inline.",
        "Only shows patients belonging to your company (multi-tenant isolated).",
        "Tracks patient status: Active, In Hospital, Out of Hospital, Vacation, or Paused — non-Active patients are skipped by Auto-Fill.",
        "Transport Type: classify each patient as Dialysis (highly repetitive), Outpatient/Wound Care (semi-repetitive), or Other/Ad-hoc (manual only).",
        "Recurrence Profile for Dialysis: set MWF or TTS schedule days, appointment time, duration, and recurrence start/end date.",
        "Custom Recurrence for Outpatient/Wound Care: select specific days of the week (Mon–Sat) for flexible recurring schedules.",
        "Stores weight — patients 300+ lbs automatically toggle bariatric transport on.",
        "Tracks mobility type (ambulatory, wheelchair, stretcher), oxygen requirements, stair chair needs, and special equipment.",
        "Stores payer information: primary payer, secondary payer, member ID, auth required flag, and auth expiration.",
        "Stores standing order flag, trips-per-week limit, must-arrive-by time, and dialysis window (for dialysis patients only).",
        "Lets you search and filter patients by name and status.",
        "Lets you select and bulk-delete multiple patients at once.",
        "Lets you delete individual patients with confirmation.",
      ],
      doesNot: [
        "Does not store full medical records, diagnoses, or medications.",
        "Does not auto-schedule patients — scheduling happens in the Scheduling page.",
        "Does not allow editing a single run occurrence from here — use the pencil (exception) icon in Scheduling.",
        "Does not auto-update patient status based on runs — status must be manually updated here.",
        "Changing recurrence profile here affects ALL future Auto-Fill generations, not past runs.",
      ],
      tips: [
        "Set Transport Type and Recurrence Profile so Auto-Fill can generate runs correctly.",
        "Mark patients as In Hospital or Vacation to stop Auto-Fill from scheduling them during that period.",
        "Notes entered here appear on the crew run sheet patient detail view.",
        "Ad-hoc patients never auto-fill — create their runs manually in Scheduling.",
        "Setting an end date on recurrence stops generation after that date automatically.",
        "Use the facility dropdown to link patients to existing facilities — or create a new one on the spot.",
      ],
    },
  },

  "/crew-schedule": {
    title: "Crew Schedule Delivery",
    content: {
      does: [
        "Generates a secure, token-based share link for a specific truck on a specific date.",
        "One stable link per truck per day — crews can refresh the same link throughout the shift.",
        "Lets you prepare a formatted message (Daily Run Sheet or Schedule Update) to send to crew.",
        "Shows each crew member's name, phone, and assigned truck for easy reference.",
        "Lets you copy messages individually or all at once.",
        "Lists all currently active share links so you can copy or revoke them.",
        "Link automatically expires after the scheduled day.",
      ],
      doesNot: [
        "Does not auto-send SMS or push notifications — messages must be copied and sent manually via text/WhatsApp.",
        "Does not show run status from the crew's view — use the Dispatch Board for live status.",
        "Does not regenerate a new link if one already exists for that truck/date — it reuses the stable link.",
        "Does not expire a link early unless you manually revoke it.",
      ],
      tips: [
        "Generate links for today's trucks before crew starts their shift.",
        "Use the 'Schedule Update' message template when runs have changed after the initial send.",
        "After publishing the app, links will use your permanent domain instead of the preview URL.",
        "Revoking a link immediately blocks crew access — only do this if the link was shared by mistake.",
      ],
    },
  },

  "/settings": {
    title: "Settings",
    content: {
      does: [
        "Lets you set your company display name (appears on crew run sheets and messages).",
        "Configures the late threshold (grace window) used for on-time tracking.",
        "Configures default load/unload times and facility delay buffers for feasibility checks.",
        "Configures the dialysis B-leg buffer and discharge buffer minutes.",
        "Session security: toggle the session timeout warning on/off and set the timeout duration (fixed at 30 minutes).",
        "Shows system hard limits (max admins, trucks, crews, runs per truck).",
        "Includes the Staging Test Readiness Checklist to verify the system before live use.",
        "Settings are scoped to your company — other companies cannot see or change them.",
      ],
      doesNot: [
        "Does not control user passwords or account access — use Account Settings for your own credentials, or Employees for staff accounts.",
        "Does not send any notifications when settings are changed.",
        "Does not allow changing system limits — those are fixed for this version.",
        "Does not store billing or subscription information.",
      ],
      tips: [
        "Update the company name before generating share links — it appears in all crew messages.",
        "Use the Test Readiness Checklist (at the bottom) to verify each setup step before your first live run.",
        "Settings are company-wide and apply to all users in your organization.",
        "Session timeout logs you out after 30 minutes of inactivity — a warning appears 5 minutes before.",
      ],
    },
  },

  "/crew/:token": {
    title: "Crew Run Sheet (Token Link)",
    content: {
      does: [
        "Opens without a login — accessible to anyone with the valid link.",
        "Shows the truck name, date, and crew members assigned for the shift.",
        "Lists assigned runs in order with pickup time, pickup location, destination, and notes.",
        "Reflects any exception edits dispatch made for that specific date.",
        "Lets crew tap a patient name to see contact info, DOB, weight, and transport notes.",
        "Lets crew mark each leg through the status flow: Pending → En Route → On Scene → With Patient → Transporting → Complete.",
        "'Complete Run Documentation' button opens a fast mobile form to capture: loaded miles, pickup/dropoff times, vitals, transport condition, mobility method, medical necessity note, PCS status, and patient signature.",
        "Submitting documentation automatically marks the trip as completed and ready for billing.",
        "'Patient Not Ready' button: if a patient is unavailable, dispatch sees a live alert immediately.",
        "Auto-refreshes every 45 seconds to show dispatcher updates.",
        "Pickup and destination addresses are tappable to open in Google Maps.",
      ],
      doesNot: [
        "Does not allow crew to add, remove, or reorder runs — only dispatch can do that.",
        "Does not allow skipping steps in the status flow — statuses advance one step at a time.",
        "Does not allow editing documentation after submission — contact dispatch if corrections are needed.",
        "Does not give access to any other part of the system.",
        "Does not work after the link expires (midnight following the run date).",
        "Does not show other trucks' runs — each link is scoped to one truck on one date.",
      ],
      tips: [
        "Complete documentation immediately after each run while details are fresh — it takes 30-60 seconds.",
        "Loaded miles is the only required field. Vitals and condition checkboxes are strongly recommended for billing.",
        "Use 'Patient Not Ready' as soon as you know there's a delay — dispatch needs early warning.",
        "Phone numbers shown in the patient detail are tap-to-call on mobile.",
      ],
    },
  },

  "/billing": {
    title: "Billing & Claims",
    content: {
      does: [
        "Shows all claim records for your company with their current status: Ready to Bill, Submitted, Paid, Denied, Needs Correction.",
        "Lets you submit claims, mark them as paid, or flag them for correction.",
        "Displays charge breakdown: base charge, mileage charge, extras, and total.",
        "Shows HCPCS codes and modifiers auto-computed from trip data.",
        "Lets you filter claims by status, date range, and payer type.",
        "Tracks denial reasons and codes for follow-up.",
        "Supports resubmission of denied or corrected claims.",
        "Shows Clean Trip badges indicating billing readiness.",
        "All data is scoped to your company — other companies' claims are never visible.",
      ],
      doesNot: [
        "Does not submit claims electronically to payers — claims must be exported or entered into your clearinghouse.",
        "Does not calculate or verify insurance eligibility.",
        "Does not generate EOBs or remittance advice.",
        "Does not handle patient billing or collections.",
      ],
      tips: [
        "Use the Charge Master in Settings to configure base rates and mileage rates per payer type.",
        "Claims are auto-generated from completed trips that pass documentation gates.",
        "Check the Compliance page for QA flags before submitting claims.",
        "Denied claims show the denial code — use this to correct and resubmit.",
      ],
    },
  },

  "/trips": {
    title: "Trips & Clinical Documentation",
    content: {
      does: [
        "Shows all trip records for your company with full clinical documentation status.",
        "Displays documentation completeness: vitals, signatures, PCS, necessity notes, loaded miles.",
        "Lets you review and complete missing documentation fields.",
        "Shows Clean Trip status — whether a trip meets all billing requirements.",
        "Evaluates documentation gates per payer type (Medicare, Medicaid, etc.).",
        "Lets you set origin and destination location types for HCPCS coding.",
        "Shows blockers preventing a trip from being claim-ready.",
        "Filters by date, status, and documentation completeness.",
      ],
      doesNot: [
        "Does not create new trips — trips are created from scheduled runs.",
        "Does not submit claims — use Billing & Claims for that.",
        "Does not replace clinical charting software or ePCR systems.",
        "Does not validate medical necessity beyond documentation presence.",
      ],
      tips: [
        "Crew can complete most documentation from their run sheet link — review here for anything missed.",
        "A trip needs loaded miles, timestamps, and vitals at minimum to pass documentation gates.",
        "Location types (R, D, H, etc.) drive HCPCS code assignment — verify these are correct.",
        "Trips marked 'Ready for Billing' automatically generate claim records.",
      ],
    },
  },

  "/compliance": {
    title: "Compliance & QA",
    content: {
      does: [
        "Shows QA review flags for trips that need attention before billing.",
        "Lets you review, approve, or reject flagged trips with notes.",
        "Configures payer-specific billing rules: which documentation is required per payer type.",
        "Tracks flag reasons and resolution status.",
        "Shows compliance metrics: total flags, resolved, pending.",
        "All QA data is scoped to your company only.",
      ],
      doesNot: [
        "Does not auto-correct documentation — it only flags issues for manual review.",
        "Does not enforce HIPAA or regulatory compliance beyond documentation gates.",
        "Does not interface with external compliance systems or auditors.",
        "Does not block billing automatically — flagged trips can still be billed if rules allow.",
      ],
      tips: [
        "Configure payer billing rules first — these determine what gets flagged.",
        "Review QA flags weekly to catch documentation issues before claim submission.",
        "Use QA notes to communicate corrections needed back to crew or dispatch.",
      ],
    },
  },

  "/facilities": {
    title: "Facilities",
    content: {
      does: [
        "Stores facility records for your company: dialysis centers, hospitals, SNFs, and other locations.",
        "Tracks facility type, address, phone, contact name, and notes.",
        "Shows how many patients are associated with each facility.",
        "Lets you add, edit, and delete facilities.",
        "For Hospital and SNF facilities: stores contract payer type, rate type, and invoice preference.",
        "Dialysis facilities: contract detail fields are hidden — only basic info and notes are shown.",
        "Search and filter facilities by name and type.",
        "Facilities are company-scoped — other companies cannot see yours.",
      ],
      doesNot: [
        "Does not store facility-specific billing rates — use the Charge Master for that.",
        "Does not auto-detect facility type from address.",
        "Does not manage facility contracts or agreements beyond basic fields.",
        "Does not track facility performance metrics.",
      ],
      tips: [
        "Add all dialysis centers before creating patient profiles — patients reference facilities from a dropdown.",
        "Use the contract payer type field (on Hospital/SNF) to track which payer covers transports to each facility.",
        "Deactivate facilities instead of deleting to preserve historical trip data.",
        "Facilities you create here appear in the patient drop-off facility dropdown automatically.",
      ],
    },
  },

  "/reports": {
    title: "Reports & Metrics",
    content: {
      does: [
        "Shows operational metrics for your company: total trips, completed, cancelled, on-time percentage.",
        "Shows financial metrics: revenue collected, revenue pending, denial count.",
        "Breaks down trip volume by truck to identify utilization patterns.",
        "Shows top denial reasons to target billing improvements.",
        "Displays AR aging buckets: 0–30, 31–60, 61–90, 90+ days.",
        "Calculates average days to payment.",
        "Supports date range filtering: day, week, month, custom.",
      ],
      doesNot: [
        "Does not generate downloadable reports or PDFs.",
        "Does not forecast revenue or project future trends.",
        "Does not compare metrics across companies.",
        "Does not drill down into individual trips — use Trips page for that.",
      ],
      tips: [
        "Check reports weekly to spot denial trends before they compound.",
        "Use the AR aging view to prioritize follow-ups on unpaid claims.",
        "Compare truck utilization to identify underused assets.",
      ],
    },
  },

  "/migration": {
    title: "Migration & Onboarding",
    content: {
      does: [
        "Guides you through importing existing data: patients, facilities, employees.",
        "Supports CSV/Excel file upload with column mapping.",
        "Detects duplicate records before importing.",
        "Shows import results with success/error/warning counts.",
        "Quick Start Wizard walks through setup steps in order.",
        "Parallel Run Mode lets you run the new system alongside your existing one.",
        "Stores mapping templates for repeated imports.",
      ],
      doesNot: [
        "Does not import trip or billing history from other systems.",
        "Does not auto-map columns — you must verify column assignments.",
        "Does not delete existing data during import.",
        "Does not connect to external databases or APIs for data transfer.",
      ],
      tips: [
        "Export patient lists from your current system as CSV before starting.",
        "Map required fields first (first name, last name) — optional fields can be filled later.",
        "Use test mode to preview import results without committing data.",
        "Complete the Quick Start Wizard before your first live dispatch day.",
      ],
    },
  },

  "/runs": {
    title: "Runs",
    content: {
      does: [
        "Shows all runs for your company for a selected date with patient, truck, crew, and status.",
        "Lets you create new runs: assign patient, truck, crew, pickup time, and trip type.",
        "Displays run status progression: Pending → En Route → Arrived → With Patient → Transporting → Completed.",
        "Filters runs by date.",
        "All run data is scoped to your company only.",
      ],
      doesNot: [
        "Does not support drag-and-drop reordering — use Scheduling for that.",
        "Does not auto-assign trucks or crews — those must be selected manually.",
        "Does not generate recurring runs — use patient recurrence profiles for that.",
        "Does not show trip documentation — use Trips page for that.",
      ],
      tips: [
        "Use this page for quick one-off run creation when you don't need the full scheduling workflow.",
        "The Scheduling page provides a more powerful interface for daily run management.",
      ],
    },
  },

  "/account": {
    title: "Account Settings",
    content: {
      does: [
        "Lets you change your own login email address (triggers a confirmation email to the new address).",
        "Lets you change your own password securely.",
        "Shows your current email on file.",
        "Accessible to all roles: Admin, Dispatcher, Biller, and Crew.",
        "These actions apply only to YOUR account — you cannot change other users' credentials from here.",
      ],
      doesNot: [
        "Does not let you change other employees' passwords or emails.",
        "Does not show your current password — passwords are never displayed.",
        "Does not manage company settings, billing, or subscription.",
        "Does not delete your account.",
      ],
      tips: [
        "Use a strong, unique password. Minimum 6 characters.",
        "If you forget your password, use the 'Forgot password?' link on the login page.",
        "After changing your email, you may need to confirm the new address before it takes effect.",
      ],
    },
  },

  "/forgot-password": {
    title: "Forgot Password",
    content: {
      does: [
        "Sends a password reset email to the address you enter.",
        "Always shows a generic success message to protect privacy — it never reveals whether the email exists in the system.",
        "The reset link in the email takes you to a secure page to set a new password.",
      ],
      doesNot: [
        "Does not reveal whether an email is registered — this is intentional for security.",
        "Does not reset your password instantly — you must click the link in the email.",
        "Does not recover forgotten email addresses — use the 'Forgot Email?' link or contact your company owner.",
      ],
      tips: [
        "Check your spam/junk folder if you don't see the reset email within a few minutes.",
        "The reset link expires — use it promptly after receiving it.",
        "If you forgot which email you used, use the 'Forgot Email?' link on the login page for guidance.",
      ],
    },
  },

  "/forgot-email": {
    title: "Forgot Email",
    content: {
      does: [
        "Provides guidance on how to recover your login email address.",
        "Directs you to contact your company owner or administrator for email recovery.",
        "Links back to the login page once you have your email.",
      ],
      doesNot: [
        "Does not look up or reveal email addresses — this is intentional for security.",
        "Does not reset your password — use 'Forgot Password' for that.",
        "Does not contact your administrator automatically — you must reach out manually.",
      ],
      tips: [
        "Your company administrator or owner can tell you which email was used to create your account.",
        "If you're the company owner, contact the system administrator for assistance.",
      ],
    },
  },

  "/reset-password": {
    title: "Reset Password",
    content: {
      does: [
        "Lets you set a new password after clicking the reset link from your email.",
        "Validates that your new password meets minimum requirements.",
        "Redirects you to the login page after successful reset.",
      ],
      doesNot: [
        "Does not work without a valid reset token from the email link.",
        "Does not show your old password.",
        "Does not change your email address.",
      ],
      tips: [
        "Use a strong, unique password that you don't use on other sites.",
        "If the link expired, go back to the login page and request a new reset email.",
      ],
    },
  },

  "/suspended": {
    title: "Account Suspended",
    content: {
      does: [
        "Informs you that your company's access has been suspended by a system administrator.",
        "Shows the reason for suspension if one was provided.",
        "Provides guidance on how to contact support or the system administrator.",
      ],
      doesNot: [
        "Does not allow access to any other pages while suspended.",
        "Does not let you unsuspend your own company — only a system administrator can do that.",
        "Does not delete your data — all company data is preserved during suspension.",
      ],
      tips: [
        "Contact your system administrator to understand why your account was suspended and how to resolve it.",
        "Your data is safe — suspension is temporary and reversible by an administrator.",
      ],
    },
  },

  "/pending-approval": {
    title: "Pending Approval",
    content: {
      does: [
        "Shows that your company registration has been received and is awaiting administrator review.",
        "Confirms your signup was successful.",
      ],
      doesNot: [
        "Does not allow access to the app until your company is approved.",
        "Does not guarantee approval — the system administrator reviews each application.",
        "Does not let you speed up the approval process from this page.",
      ],
      tips: [
        "Approval is typically completed within 1-2 business days.",
        "You will be able to log in and access all features once approved.",
      ],
    },
  },

  "/system": {
    title: "System Creator Dashboard",
    content: {
      does: [
        "Shows system-wide metrics: total companies, users, trucks, trips, and claims across all tenants.",
        "Displays clean claim rate and dispatch efficiency aggregated across all companies.",
        "Provides a high-level health overview of the entire platform.",
        "Dev Mode toggle exposes routes, feature flags, permissions, and schema for debugging.",
        "Feature Usage Heatmap shows which modules are being used (populates as companies use the platform).",
      ],
      doesNot: [
        "Does not show per-company breakdowns — use Company Console for that.",
        "Does not allow editing company data directly from here.",
        "Does not show individual trip, patient, or employee details.",
        "Does not show data from any single company — all metrics are aggregated.",
      ],
      tips: [
        "Check the system dashboard daily for anomalies in claim rates or efficiency.",
        "A drop in clean claim rate may indicate a documentation training issue across companies.",
        "Use Dev Mode to verify feature flags and route configurations during development.",
      ],
    },
  },

  "/creator-console": {
    title: "Company Console",
    content: {
      does: [
        "Lists all registered companies organized by status tabs: Pending, Active, Suspended, Rejected.",
        "Lets you approve pending companies (transitions them to active).",
        "Lets you suspend active companies with a required reason and confirmation override.",
        "Lets you unsuspend suspended companies to restore their access.",
        "Soft Delete: marks a company as deleted with a 30-day recovery window — the company is hidden from login and active lists but data is preserved.",
        "Restore: lets you undo a soft-deleted company within the recovery window.",
        "Permanent Delete: removes pending or rejected companies permanently.",
        "Shows company details: name, owner email, creation date, current status, and soft-delete timestamp.",
        "Lets you trigger a password reset email to a company owner (no password is ever visible).",
        "Lets you edit company profile information (name).",
        "Shows a soft-deleted badge with days remaining in the recovery window.",
      ],
      doesNot: [
        "Does not let you view or set passwords for any user — only triggers reset emails.",
        "Does not manage individual employees within a company — that's done in the company's Employees page.",
        "Does not show company-level operational data (trips, runs, patients, etc.).",
        "Does not permanently delete active companies — you must soft-delete first.",
      ],
      tips: [
        "Review pending companies promptly — they cannot operate until approved.",
        "Suspending a company immediately blocks all non-creator access — the company sees a suspension notice.",
        "Use 'Force Password Reset' if a company owner is locked out — it sends a reset email to their address.",
        "The suspend action requires typing 'OVERRIDE' to confirm — this prevents accidental suspension.",
        "Soft-deleted companies can be restored within 30 days. After that, they may be permanently removed.",
      ],
    },
  },

  "/creator-settings": {
    title: "System Settings",
    content: {
      does: [
        "Shows platform-wide configuration options for the system creator.",
        "Displays approval and onboarding settings: manual approval required, training mode for pending companies.",
        "Shows notification settings (email on new signup — coming soon).",
        "Shows platform settings: signup enabled, maintenance mode (coming soon).",
        "Data Maintenance: clear test/demo employees from a selected company (preserves the Owner).",
        "These settings are separate from individual company settings.",
      ],
      doesNot: [
        "Does not manage individual company configurations — those are inside each company's Settings page.",
        "Does not currently allow toggling most settings (they are display-only in this version).",
        "Does not control user authentication or password policies.",
      ],
      tips: [
        "These settings will become editable in a future release.",
        "Company-level settings (grace windows, load times, etc.) are managed inside each tenant's app.",
        "Use 'Clear Test Employees' after demo/testing to remove leftover profiles without affecting the company owner.",
      ],
    },
  },

  "/simulation-lab": {
    title: "Simulation Lab",
    content: {
      does: [
        "Lets you create and run simulated scenarios to test dispatch and scheduling workflows.",
        "Generates simulated data (patients, trucks, crews, trips) that is isolated from real company data.",
        "Allows testing of different operational configurations without affecting live operations.",
        "Tracks simulation runs with scenario names and status.",
      ],
      doesNot: [
        "Does not modify real company data — all simulation data is tagged and isolated.",
        "Does not generate real claims or billing records.",
        "Does not affect live dispatch or crew schedules.",
        "Does not persist simulation results as permanent records.",
      ],
      tips: [
        "Use simulations to test new scheduling templates before applying them to real operations.",
        "Simulation data is clearly marked with an 'is_simulated' flag and never mixes with production data.",
      ],
    },
  },
};

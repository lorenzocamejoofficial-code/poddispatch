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
        "Shows alerts (e.g. late pickups) that need attention.",
        "Updates in real time — status changes from crew links appear here automatically.",
        "Lets you dismiss resolved alerts.",
      ],
      doesNot: [
        "Does not let you create or edit runs from this screen — use Scheduling for that.",
        "Does not show historical runs from past dates (change date in the sidebar date picker).",
        "Does not calculate drive-time conflicts or route optimization.",
        "Does not send notifications to crew — use Crew Schedule Delivery for that.",
      ],
      tips: [
        "If a truck shows no crew, it means no crew was assigned for that date in Trucks & Crews.",
        "If runs are missing, check that they were assigned to the truck in Scheduling.",
        "The date picker in the header controls which day you're viewing.",
      ],
    },
  },

  "/scheduling": {
    title: "Patient Runs / Scheduling",
    content: {
      does: [
        "Shows a 7-day weekly overview — click any day to open the daily drill-down.",
        "Daily Ops Snapshot bar: shows active trucks, total runs, unassigned count, avg runs/truck, empty trucks, overloaded trucks (>8 runs), DOWN trucks, and trucks with no crew — all at a glance.",
        "Auto-Fill: generates A and B legs from patient recurrence profiles (Dialysis/Outpatient) for the selected date. All generated runs go into the Unassigned Run Pool.",
        "Run Pool: a collapsible panel that lists all unassigned runs for the day. Default state is collapsed — click the header to expand. On high-volume days (40–100+ runs), the pool stays manageable.",
        "Run Pool grouping: inside the pool, runs are grouped by transport type (Dialysis / Outpatient / Other) and then by A-legs / B-legs. Each group is collapsible with a count badge.",
        "Run Pool filters: use the search box, A/B toggle, and transport type buttons to narrow the list. Sort by pickup time or destination.",
        "Assign Mode: click 'Focus A-legs (N)' or 'Focus B-legs (N)' inside a transport group to zoom into just that subgroup. A breadcrumb shows your location. Click Back or \u00d7 to exit.",
        "'Show N more' pagination: lists over 25 items show a 'Show more' link instead of rendering 100+ cards at once.",
        "Drag any pool card to a truck to assign it. Drag an assigned run back to the pool to unassign it. Drag within a truck to reorder slots.",
        "Default Setup Template: after manually assigning runs to trucks for a day, click 'Save as Default Setup' at the bottom of the Truck Builder. The template stores which transport types (Dialysis/Outpatient/Other) and leg types (A/B) go to which truck — not specific patient IDs.",
        "Apply Default Setup: on future matching days (same MWF/TTS pattern), click 'Apply Default Setup'. It reads unassigned pool runs and auto-places them into trucks using the saved rules. You can then drag/edit freely after.",
        "Two apply modes: 'Apply to unassigned only' (safe default — keeps existing assignments, fills the rest) or 'Rebuild all from template' (clears all slots first, then re-places everything).",
        "Template Info line shows the template name, last-updated date, and how many truck rules are stored. One template per day-type (MWF, TTS, or weekday) per company. Saved indefinitely until updated or cleared.",
        "Upcoming Non-Dialysis Transports panel: visible on the week view, below the 7-day calendar grid. Shows all outpatient, discharge, hospital, private pay, and ad-hoc legs scheduled for the next 7, 14, or 30 days. Designed to surface runs that are easy to forget because they don't auto-fill like dialysis.",
        "The panel defaults to 'Unassigned only' — focus on what's at risk of being missed. Toggle to see all upcoming non-dialysis runs. Click 'Go' on any row to jump to that day's view.",
        "Manually create A-legs and B-legs for ad-hoc runs (discharge, hospital, private pay).",
        "Exception editing: click the pencil icon on any run to change pickup location, time, or notes for THAT date only — the recurring series is unchanged. A branch icon marks exception runs.",
        "Each truck card shows a utilization badge: green (6–8 runs), yellow (3–5), red (0–2 or >10). Also shows first and last pickup time.",
        "Trucks marked DOWN show a red badge — runs cannot be added, but existing runs stay visible for reassignment.",
      ],
      doesNot: [
        "Does not auto-optimize routes or calculate drive-time conflicts between legs.",
        "Does not send anything to crew — share links are in Crew Schedule Delivery.",
        "Does not delete or edit patient profiles — use the Patients page for that.",
        "Does not prevent assigning the same patient twice on the same day.",
        "Editing a series (changing recurring defaults) must be done in the Patients page, not here.",
        "Does not automatically move runs off a truck that goes down — dispatcher must reassign manually.",
        "The Non-Dialysis panel does not show dialysis runs, does not auto-assign runs, and does not let you edit from within the panel.",
        "This is operational visibility only — not billing, payroll, or route optimization software.",
      ],
      tips: [
        "Check the Upcoming Non-Dialysis panel at the start of each week to catch outpatient/ad-hoc trips that need manual scheduling.",
        "Use the 30-day window on the Non-Dialysis panel to plan ahead for discharge runs you know are coming.",
        "If the panel shows 0 unassigned, all upcoming non-dialysis runs have been handled — safe to focus on dialysis.",
        "On a 100-run day: use Auto-Fill first, then open the Run Pool. Work transport group by transport group using Assign Mode to avoid overwhelm.",
        "Dialysis A-legs all go to the same facilities — cluster them by destination sort before assigning.",
        "Dialysis and Outpatient patients auto-fill if they have Schedule Days set and are Active with a recurrence start date.",
        "A-legs are pickups (home to facility). B-legs are returns (facility to home).",
        "Exception edits (one-day changes) show a branch icon and are reflected on the crew run sheet.",
        "Ad-hoc runs (discharge, hospital, private pay) are created manually — they don't auto-fill but appear in the Non-Dialysis panel once created.",
        "If a truck goes DOWN after runs are assigned: open that truck's card, trash each leg to return it to the pool, then reassign.",
        "Repeat-day workflow: (1) Auto-Fill generates runs into pool; (2) Apply Default Setup auto-places them into trucks; (3) drag-adjust exceptions; done.",
        "Template stores rules (e.g. Truck 1 = Dialysis A+B), not specific patient IDs — works even when the patient list varies day to day.",
        "One template per day-type per company: MWF days share one template, TTS another. Click Update Default at any time to overwrite.",
      ],
    },
  },

  "/trucks": {
    title: "Trucks & Crews",
    content: {
      does: [
        "Lets you add trucks to your fleet and rename existing trucks.",
        "Shows a Sunday–Saturday weekly calendar grid — every truck × every day of the week at a glance.",
        "Lets you assign, edit, or clear crew members on any truck for any day — including days weeks in advance.",
        "Navigate backward or forward by week using the Previous / Next buttons; jump to today anytime.",
        "'Copy Week' copies all crew assignments from the current week to a target week without overwriting existing ones.",
        "Lets you mark a truck as Down (Maintenance or Out of Service) for a specific date range — crew assignment is blocked and a DOWN badge appears.",
        "Removing a down record instantly restores that truck to available.",
        "Crew assignments created here appear in Scheduling, Dispatch Board, and Crew Run Sheets automatically.",
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
        "Hover any cell to reveal Assign, Edit, and Mark Down actions — the calendar is read-only until you hover.",
        "Mark a truck down BEFORE assigning crew for that day — the cell will show a DOWN badge and block assignment.",
        "If a truck goes down after runs were assigned, open Scheduling, find that truck, and move runs to another truck.",
        "Crew must be assigned for a date BEFORE generating a share link for that day in Crew Schedule Delivery.",
      ],
    },
  },

  "/employees": {
    title: "Employees",
    content: {
      does: [
        "Lets you create employee accounts with login credentials (email + password).",
        "Assigns a role to each employee: Admin or Crew.",
        "Stores employee info: name, phone, certification level, sex.",
        "Lets you toggle employees between Active and Inactive.",
        "Lets you search employees by name or phone number.",
        "Shows inactive employees when 'Show inactive' is toggled on.",
      ],
      doesNot: [
        "Does not reset employee passwords — contact your system administrator to do that.",
        "Does not delete employee accounts — deactivate instead to preserve history.",
        "Does not show employee shift history or run history.",
        "Does not auto-text crew — phone numbers are stored for reference; messages are sent manually via Crew Schedule Delivery.",
        "Does not manage certifications or expiry dates beyond the cert level label.",
      ],
      tips: [
        "Mark employees Active before assigning them to a crew in Trucks & Crews.",
        "Only Active employees appear in crew assignment dropdowns.",
        "Use Crew role for field staff, Admin for full access.",
      ],
    },
  },

  "/patients": {
    title: "Patients",
    content: {
      does: [
        "Stores patient records including name, DOB, phone, pickup address, dropoff facility, and notes.",
        "Tracks patient status: Active, In Hospital, Out of Hospital, Vacation, or Paused — non-Active patients are skipped by Auto-Fill.",
        "Transport Type: classify each patient as Dialysis (highly repetitive), Outpatient (semi-repetitive), or Ad-hoc (manual only).",
        "Recurrence Profile: set schedule days (MWF or TTS), chair time, duration, and recurrence start/end date — this is what Auto-Fill uses to generate daily runs.",
        "Stores weight — patients over 200 lbs are flagged for electric stretcher requirement.",
        "Lets you search and filter patients by name and status.",
      ],
      doesNot: [
        "Does not store medical records, diagnoses, medications, or insurance information.",
        "Does not auto-schedule patients — scheduling still happens in the Scheduling page.",
        "Does not allow editing a single run occurrence from here — use the pencil (exception) icon in Scheduling.",
        "Does not auto-update patient status based on runs — status must be manually updated here.",
        "Changing recurrence profile here affects ALL future Auto-Fill generations, not past runs.",
      ],
      tips: [
        "Set Transport Type and Recurrence Profile so Auto-Fill can generate runs correctly.",
        "Mark patients as In Hospital or Vacation to stop Auto-Fill from scheduling them during that period.",
        "Notes entered here appear on the crew run sheet patient detail view.",
        "Ad-hoc patients (transport type = Other/Ad-hoc) never auto-fill — create their runs manually in Scheduling.",
        "Setting an end date on recurrence stops generation after that date automatically.",
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
        "Does not auto-send SMS or push notifications — messages must be copied and sent manually via text/WhatsApp/phone.",
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
        "Shows system hard limits (max admins, trucks, crews, runs per truck).",
        "Includes the Staging Test Readiness Checklist to verify the system before live use.",
      ],
      doesNot: [
        "Does not control user passwords or account access — accounts are managed in Employees.",
        "Does not send any notifications when settings are changed.",
        "Does not allow changing system limits — those are fixed for this version.",
        "Does not store billing or subscription information.",
      ],
      tips: [
        "Update the company name before generating share links — it appears in all crew messages.",
        "Use the Test Readiness Checklist (at the bottom) to verify each setup step before your first live run.",
        "Settings are company-wide and apply to all users in your organization.",
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
        "Reflects any exception edits dispatch made for that specific date (e.g. hospital pickup instead of home).",
        "Lets crew tap a patient name to see contact info, DOB, weight, and transport notes.",
        "Lets crew mark each leg through the status flow: Pending → En Route → On Scene → With Patient → Transporting → Complete.",
        "'Complete Run Documentation' button opens a fast mobile form to capture: loaded miles, pickup/dropoff times, vitals (BP, HR, O₂, resp), transport condition checkboxes, mobility method, medical necessity note, PCS status, and patient signature.",
        "Submitting documentation automatically marks the trip as completed and ready for billing — no dispatcher or office action needed.",
        "'Patient Not Ready' button: if a patient is unavailable, tap this button. Dispatch sees a live alert immediately.",
        "Once the patient is ready, tap 'Patient Ready' on the alert banner to clear it from the dispatcher's view.",
        "Auto-refreshes every 45 seconds to show dispatcher updates.",
        "Includes a manual Refresh button and 'Last updated' timestamp.",
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
        "If you lose connection mid-form, re-open and re-submit — the system will accept the latest submission.",
        "Use 'Patient Not Ready' as soon as you know there's a delay — dispatch needs early warning.",
        "Phone numbers shown in the patient detail are tap-to-call on mobile.",
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
        "Patient Not Ready Alerts section: shows open alerts sent by crew when a patient is unavailable. Each alert includes truck name, patient, run number, pickup time, next run time, and the crew's note.",
        "Truck cards show a red alert badge when that truck has an open Patient Not Ready alert.",
        "Resolve button dismisses a Patient Not Ready alert once the situation is handled.",
        "Updates in real time — status changes and Not Ready alerts from crew links appear here automatically.",
        "Lets you dismiss resolved alerts.",
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
};

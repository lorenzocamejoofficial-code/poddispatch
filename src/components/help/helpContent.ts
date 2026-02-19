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
        "Shows a 7-day weekly overview of scheduled legs and truck activity.",
        "Lets you drill into any day to see individual transport legs.",
        "Lets you manually create A-legs (pickup to facility) and B-legs (return trip).",
        "Auto-fills legs from patient templates — pulls patients by schedule day (MWF or TTS) and pre-fills addresses from their profile.",
        "Lets you drag-and-drop legs onto trucks in the daily view.",
        "Lets you copy a full week's crew assignments to a future week.",
        "Warns you when scheduling a patient who is in-hospital, on vacation, or paused.",
      ],
      doesNot: [
        "Does not auto-schedule or optimize routes — you place legs manually or via auto-fill.",
        "Does not calculate drive-time conflicts between legs on the same truck.",
        "Does not send anything to crew — share links are generated in Crew Schedule Delivery.",
        "Does not delete or edit existing patient profiles — use the Patients page for that.",
        "Does not prevent double-booking the same patient on the same truck on the same day.",
      ],
      tips: [
        "Auto-Fill from Templates only generates legs for patients who have a matching schedule day set (MWF or TTS). Set this on the Patients page.",
        "A-legs are pickups (home → facility). B-legs are returns (facility → home).",
        "Legs must be dropped onto a truck in the Truck Builder before crew can see them.",
        "Copy Week Forward only copies crew assignments, not patient legs — run Auto-Fill again on each day.",
      ],
    },
  },

  "/trucks": {
    title: "Trucks & Crews",
    content: {
      does: [
        "Lets you add trucks to your fleet and rename existing trucks.",
        "Lets you assign two crew members to a specific truck for a specific date.",
        "Shows all past and upcoming crew assignments in a single table.",
        "Lets you edit crew member assignments inline.",
        "Lets you remove a crew assignment entirely.",
      ],
      doesNot: [
        "Does not deactivate or archive trucks — only add and rename for now.",
        "Does not enforce that the same employee is only on one truck per day — avoid double-assigning manually.",
        "Does not auto-generate share links — do that in Crew Schedule Delivery.",
        "Does not affect scheduling legs — legs are assigned to trucks in the Scheduling page.",
      ],
      tips: [
        "Crew members must be created in Employees (marked Active) before they appear here.",
        "One crew assignment per truck per date. If you need to change it, edit inline.",
        "Crew must be assigned for a date BEFORE generating a share link for that day.",
      ],
    },
  },

  "/employees": {
    title: "Employees",
    content: {
      does: [
        "Lets you create employee accounts with login credentials (email + password).",
        "Assigns a role to each employee: Admin, Dispatcher, or Crew.",
        "Stores employee info: name, phone, certification level, sex.",
        "Lets you toggle employees between Active and Inactive.",
        "Lets you search employees by name or phone number.",
        "Shows inactive employees when 'Show inactive' is toggled on.",
      ],
      doesNot: [
        "Does not reset employee passwords — contact your system administrator to do that.",
        "Does not delete employee accounts — deactivate instead to preserve history.",
        "Does not show employee shift history or run history.",
        "Does not auto-text crew — phone numbers are stored for your reference; sending messages is done manually via Crew Schedule Delivery.",
        "Does not manage certifications or expiry dates beyond the cert level label.",
      ],
      tips: [
        "Mark employees Active before assigning them to a crew in Trucks & Crews.",
        "Only Active employees appear in crew assignment dropdowns.",
        "Use Crew role for field staff, Admin for full access, Dispatcher for limited admin access.",
      ],
    },
  },

  "/patients": {
    title: "Patients",
    content: {
      does: [
        "Stores patient records including name, DOB, phone, pickup address, dropoff facility, and notes.",
        "Tracks patient status: Active, In Hospital, Out of Hospital, Vacation, or Paused.",
        "Stores scheduling day preference (Mon/Wed/Fri or Tue/Thu/Sat) for auto-fill.",
        "Stores weight — patients over 200 lbs are flagged for electric stretcher requirement.",
        "Stores estimated run duration and chair time for scheduling reference.",
        "Lets you search and filter patients by name, status, or phone.",
      ],
      doesNot: [
        "Does not store medical records, diagnoses, medications, or insurance information.",
        "Does not auto-schedule patients — scheduling must be done in the Scheduling page.",
        "Does not send patient info to crews beyond what is shown on the crew run sheet.",
        "Does not auto-update patient status based on runs — status must be manually updated here.",
      ],
      tips: [
        "Set Schedule Days (MWF or TTS) so that Auto-Fill in Scheduling can pick them up correctly.",
        "Mark patients as In Hospital or Vacation to stop Auto-Fill from scheduling them.",
        "Notes entered here will appear on the crew run sheet patient detail view.",
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
        "Lists all transport legs in order with pickup time, pickup address, and destination.",
        "Lets crew tap on a patient name to see contact info, DOB, weight, and notes.",
        "Lets crew mark each leg through the status flow: Pending → En Route → On Scene → With Patient → Transporting → Complete.",
        "Auto-refreshes every 45 seconds to show dispatcher updates.",
        "Includes a manual Refresh button and 'Last updated' timestamp.",
        "Pickup and destination addresses are tappable to open in Google Maps.",
      ],
      doesNot: [
        "Does not allow crew to add, remove, or reorder runs — only dispatch can do that.",
        "Does not allow skipping steps in the status flow — statuses advance one step at a time.",
        "Does not give access to any other part of the system.",
        "Does not work after the link expires (midnight following the run date).",
        "Does not show other trucks' runs — each link is scoped to one truck on one date.",
      ],
      tips: [
        "Bookmark or save the link before the shift starts.",
        "If the page shows 'Link Expired', contact dispatch for a fresh link.",
        "If runs look outdated, tap the Refresh button in the top-right corner.",
        "Phone numbers shown in the patient detail are tap-to-call on mobile.",
      ],
    },
  },
};

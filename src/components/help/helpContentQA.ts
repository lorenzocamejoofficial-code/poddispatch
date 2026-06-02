/** Page-specific Q&A help content for the contextual help panel. */

export interface HelpQA {
  title: string;
  description: string;
  questions: { q: string; a: string }[];
}

export const PAGE_HELP_QA: Record<string, HelpQA> = {
  "/": {
    title: "Dispatch Command",
    description: "Live operations view showing every active truck, assigned run, and real-time trip status.",
    questions: [
      { q: "What is this page for?", a: "This is your live operations view. It shows every active truck, every assigned run, and the real-time status of each trip from dispatch through completion." },
      { q: "How do I know if a run is on time?", a: "Each run card shows a status badge. If a run shows Late it means the crew has not tapped their first PCR time stamp yet and the scheduled pickup time has passed. The hold timer on the card shows how long the crew has been on scene." },
      { q: "How do I reassign a run to a different truck?", a: "Click the run card to expand it then use the reassign option. The system will check for conflicts on the receiving truck before confirming the move." },
      { q: "What does the Communications section do?", a: "It shows all active runs for the day. Use the Call Patient or Call Facility buttons to queue an automated call notifying them of a delay. The message is pre-filled with the patient name, pickup time, and your estimated arrival time." },
      { q: "What do the alert colors mean?", a: "Green alerts are informational and auto-dismiss. Yellow alerts require attention but are not urgent. Red alerts require dispatcher acknowledgment before they clear, these include missing crew inspections and flagged safety issues." },
      { q: "How do I handle a cancellation?", a: "Cancelled runs appear in the Pending Cancellation panel. You must resolve each cancellation by either confirming it or reassigning the run before it clears from the board." },
    ],
  },

  "/dispatch": {
    title: "Dispatch Command",
    description: "Live operations view showing every active truck, assigned run, and real-time trip status.",
    questions: [
      { q: "What is this page for?", a: "This is your live operations view. It shows every active truck, every assigned run, and the real-time status of each trip from dispatch through completion." },
      { q: "How do I know if a run is on time?", a: "Each run card shows a status badge. If a run shows Late it means the crew has not tapped their first PCR time stamp yet and the scheduled pickup time has passed. The hold timer on the card shows how long the crew has been on scene." },
      { q: "How do I reassign a run to a different truck?", a: "Click the run card to expand it then use the reassign option. The system will check for conflicts on the receiving truck before confirming the move." },
      { q: "What does the Communications section do?", a: "It shows all active runs for the day. Use the Call Patient or Call Facility buttons to queue an automated call notifying them of a delay. The message is pre-filled with the patient name, pickup time, and your estimated arrival time." },
      { q: "What do the alert colors mean?", a: "Green alerts are informational and auto-dismiss. Yellow alerts require attention but are not urgent. Red alerts require dispatcher acknowledgment before they clear, these include missing crew inspections and flagged safety issues." },
      { q: "How do I handle a cancellation?", a: "Cancelled runs appear in the Pending Cancellation panel. You must resolve each cancellation by either confirming it or reassigning the run before it clears from the board." },
    ],
  },

  "/scheduling": {
    title: "Patient Runs & Scheduling",
    description: "Build each day by assigning patients to trucks before dispatch takes over.",
    questions: [
      { q: "What is this page for?", a: "This is where you build the day before it starts. You assign patients to trucks by dragging runs from the pool into the truck builder. Once the day is built the Dispatch Command manages it live." },
      { q: "How do I assign a run to a truck?", a: "Drag any run card from the Run Pool on the left into a truck column in the Truck Builder on the right. You can also reorder runs within a truck by dragging them up or down." },
      { q: "What is the Run Pool?", a: "The Run Pool shows all unassigned runs for the selected day. Runs are automatically generated for recurring patients, dialysis patients on their scheduled days, outpatient patients on their appointment days. You can also add one-off runs manually using Add Leg on a truck." },
      { q: "What does Auto-Fill do?", a: "Auto-Fill generates A and B legs from your recurring patient schedules for the selected date and places them all in the unassigned pool. Use it each morning to populate the day then assign runs to trucks." },
      { q: "Why is a run showing as unsafe?", a: "The safety check compares what the patient needs, bariatric stretcher, oxygen, stair chair, against what the assigned truck has. If the truck is missing required equipment the run shows as unsafe." },
      { q: "How do I assign crew to a truck?", a: "Crew assignment for a specific day happens on Trucks & Crews. Pick the truck and day, choose 1, 2, or 3 crew members, and save. The assignment shows up here and on the Dispatch Command within a few seconds." },
    ],
  },

  "/trips": {
    title: "Trips & Clinical",
    description: "Complete trip records with documentation status, mileage, billing readiness, and PCR state.",
    questions: [
      { q: "What is this page for?", a: "This is your complete trip record. Every completed run appears here with its documentation status, mileage, billing readiness, and PCR completion state." },
      { q: "How do I move a trip to billing?", a: "A trip moves to billing automatically when the crew submits their PCR and all required documentation is complete. You can also manually move it using the Ready for Billing button on the trip row if you have resolved all blockers." },
      { q: "What does the Clean badge mean?", a: "Clean means the trip has all required documentation and is ready to generate a clean claim in Billing and Claims. Blocked means something is missing, click the trip to see what needs to be fixed." },
      { q: "How do I view the PCR for a trip?", a: "Click the Edit button on any trip row to open the trip detail panel. From there you can view all PCR fields, timestamps, vitals, signatures, and uploaded documents." },
      { q: "What does the status history show?", a: "The status history in the trip detail panel shows every status change the trip went through, who made the change, when, and what it changed from and to. This is your audit trail." },
      { q: "Can I export trip records?", a: "Yes. Use the Export CSV button at the top of the page to download all visible trips based on your current filters." },
    ],
  },

  "/billing": {
    title: "Billing & Claims",
    description: "Turn completed trips into paid claims, review, submit, and track payments.",
    questions: [
      { q: "What is this page for?", a: "This is where completed trips become paid claims. You review documentation, fix any issues, submit claims to your clearinghouse, and track what has been paid and what has been denied." },
      { q: "How do I get trips into the billing queue?", a: "Click Sync from Trips at the top of the page. This pulls in all completed trips that have a submitted PCR and creates claim records for them." },
      { q: "What does Blocked mean on a claim?", a: "Blocked means the claim cannot be submitted yet because required information is missing. Each blocked claim shows a plain English explanation of exactly what is missing and a Fix button that takes you to the right place to resolve it." },
      { q: "How do I submit a claim?", a: "First make sure the claim is in the Billing Ready column. Then click Pre-Submit to run the 8-point checklist. If all checks pass the Submit button appears. After submitting use the 837P Export button to generate the EDI file for your clearinghouse." },
      { q: "What is the 837P Export?", a: "The 837P is the standardized electronic file that clearinghouses like Office Ally require to submit claims to Medicare and Medicaid. Generate this file and upload it to your clearinghouse portal." },
      { q: "What is the 835 Import?", a: "When your clearinghouse sends back a payment response file called an 835 you import it here. The system reads it automatically, updates your claim statuses, translates any denial codes into plain English, and flags any secondary insurance opportunities." },
      { q: "What does a denial code mean?", a: "Every denial code is translated into plain English in the claim detail view. For example CO-45 means Medicare reduced the charge to their allowed rate, no action needed. CO-16 means the claim is missing required information, you need to fix the documentation and resubmit." },
      { q: "What is a secondary insurance opportunity?", a: "When Medicare pays a claim it typically covers 80 percent. If the patient has a secondary insurance like Medicaid or a supplement plan on file PodDispatch will flag the remaining amount as a potential secondary claim. Click Generate Secondary Claim to create and submit it." },
    ],
  },

  "/compliance": {
    title: "Compliance & QA",
    description: "Documentation quality flags, vehicle inspections, incident reports, and payer rules.",
    questions: [
      { q: "What is this page for?", a: "This is your compliance dashboard. It shows documentation quality flags, vehicle inspection records, incident reports, and payer billing rules for your company." },
      { q: "What are red flags?", a: "Red flags are documentation issues that will block a claim from being paid. Common examples include missing medical necessity criteria, no crew signature on the PCR, or missing timestamps. Fix these before submitting to your clearinghouse." },
      { q: "What are yellow flags?", a: "Yellow flags are consistency issues that need human review but do not automatically block billing. Examples include timestamps that appear to have been entered simultaneously or odometer readings that don't match the documented mileage." },
      { q: "How do I run the auto-flag scan?", a: "Click Run Auto-Flag at the top of the QA Queue tab. This scans all completed trips and flags any documentation or consistency issues. Run this daily before reviewing your billing queue." },
      { q: "Where do vehicle inspections appear?", a: "Completed pre-trip inspections submitted by crew appear in the Vehicle Inspections tab. You can filter by date and truck, see which items were flagged missing, and view dispatcher acknowledgment history. Use Export CSV to save records for audits." },
      { q: "What are payer rules?", a: "Payer rules define what documentation is required for each payer type. Medicare, Medicaid, facility contracts, and cash. These rules drive the billing gate checks and the required field indicators in the PCR." },
    ],
  },

  "/patients": {
    title: "Patients",
    description: "Patient directory, every patient your company transports should have a record here.",
    questions: [
      { q: "What is this page for?", a: "This is your patient directory. Every patient your company transports should have a record here before they are scheduled for a run." },
      { q: "What information do I need to add a patient?", a: "At minimum you need first name, last name, date of birth, pickup address, and primary insurance payer. Member ID and mobility level are strongly recommended for billing and scheduling." },
      { q: "What is PCS on File?", a: "PCS stands for Physician Certification Statement. Medicare requires an active PCS for recurring non-emergency transport like dialysis. Toggle this on when you have a signed PCS from the patient's physician and upload the document in the Documents section." },
      { q: "What is a Standing Order?", a: "A standing order means the physician has authorized recurring transport for this patient on a regular schedule. This simplifies scheduling for dialysis and other recurring patients." },
      { q: "Where do I upload patient documents?", a: "Use the Documents section at the bottom of the patient record. You can upload PCS forms, DNR orders, prior authorizations, and insurance cards. These documents are available to billers and are referenced during PCR documentation." },
      { q: "What does the Special Equipment field mean?", a: "Special Equipment flags what the patient requires for safe transport. Bariatric Stretcher, Extra Crew, Lift Assist, or Other. This information is used by the scheduling safety check to make sure the assigned truck has the right equipment." },
    ],
  },

  "/employees": {
    title: "Employees",
    description: "Manage your team, add employees, assign roles, and control access.",
    questions: [
      { q: "What is this page for?", a: "This is where you manage your team. Add employees, assign roles, and control who has access to what in PodDispatch." },
      { q: "What roles are available?", a: "Owner has full access to everything including subscription, NPI/EIN edits, owner promotion, and clearinghouse credentials. Manager has broad admin access across operations, scheduling, billing, and compliance, but cannot edit clearinghouse credentials, change the subscription, edit NPI/EIN, or promote another owner. Dispatcher manages the dispatch board, scheduling, patients, trucks, and employees. Biller manages claims, billing workflows, compliance/QA, and view-only patient/facility data. Crew accesses only the crew UI for their assigned runs, daily inspection, and PCR documentation. Certified admins (Owner, Manager, Dispatcher, Biller) can also enter the crew UI directly without a separate account." },
      { q: "How do I add a new employee?", a: "Click Add Employee and fill in their name, email, phone, role, and certification level. They will receive an invitation email with a link to set their password and access the system." },
      { q: "A crew member forgot their password, how do I help them?", a: "Click the Reset Password button next to their name on the employee list. This sends a password reset email to their registered address. The email contains a link they click to set a new password." },
      { q: "Can I see what email a crew member uses to log in?", a: "Yes. The Email column on the employee list shows the email address for every employee. This is the address they use to log in and where system notifications are sent." },
      { q: "How do I deactivate an employee who has left?", a: "Click the edit icon next to their name and change their status to Inactive. They will immediately lose access to the system. Their historical records are preserved." },
    ],
  },

  "/reports": {
    title: "Reports & Metrics",
    description: "Operational and financial performance summary, check weekly for insights.",
    questions: [
      { q: "What is this page for?", a: "This is your operational and financial performance summary. Check it weekly to understand trip volume, billing completion, on-time performance, and accounts receivable aging." },
      { q: "What does Billing Complete Rate mean?", a: "Billing Complete Rate is the percentage of completed trips that have a clean submitted claim. A low rate means trips are completing but documentation or billing issues are preventing claims from being submitted." },
      { q: "What does Late Pickup Rate mean?", a: "Late Pickup Rate is the percentage of runs where the crew arrived more than 15 minutes after the scheduled pickup time. A high rate may indicate scheduling or routing problems." },
      { q: "What is AR Aging?", a: "AR Aging shows how long submitted claims have been waiting for payment broken into buckets, 0 to 30 days, 31 to 60 days, 61 to 90 days, and over 90 days. Claims sitting over 60 days should be followed up with the payer." },
      { q: "What does Utilization mean?", a: "Utilization is the percentage of scheduled capacity that was actually used. A truck scheduled for 8 runs that completed 6 runs has 75 percent utilization. Low utilization means trucks are being underused." },
    ],
  },

  "/owner-dashboard": {
    title: "Owner Command Center",
    description: "30-second business health check, see immediately if anything needs attention.",
    questions: [
      { q: "What is this page for?", a: "This is your 30-second business health check. It summarizes the most important things happening in your business today so you know immediately whether everything is running smoothly or something needs your attention." },
      { q: "What does the status line at the top mean?", a: "The status line gives you a plain English summary of the day. Green means things are moving normally. Yellow means something needs attention but is not urgent. Red means action is required today." },
      { q: "What are Secondary Opportunities?", a: "These are claims where a patient has secondary insurance that could recover additional payment beyond what Medicare or Medicaid paid. Click the card to go directly to those claims and generate secondary claims with one click." },
      { q: "What does Documentation show?", a: "Documentation shows trips that are complete but have PCR issues blocking them from billing. Resolving these quickly prevents revenue from sitting uncollected." },
      { q: "Why is Money Coming In showing zero?", a: "This shows the total value of submitted claims that have not yet been paid. If it shows zero it means either no claims have been submitted yet or all submitted claims have already been paid or denied." },
    ],
  },

  "/trucks": {
    title: "Trucks & Crews",
    description: "Configure your fleet, set equipment flags and inspection checklists.",
    questions: [
      { q: "What is this page for?", a: "This is where you configure your fleet. Set equipment flags on each truck so the scheduling safety check knows what each truck can handle. Configure the pre-trip inspection checklist for each truck here." },
      { q: "What equipment flags should I set?", a: "Set Bariatric Stretcher if the truck has a bariatric-rated stretcher. This is the most important flag because it determines whether bariatric patients can be assigned to that truck. Other equipment is verified through the daily pre-trip inspection checklist." },
      { q: "What is the vehicle inspection configuration?", a: "Each truck has an inspection template where you choose which items from the Georgia DPH checklist crew must verify before each shift. You can also toggle the gate that requires inspection completion before crew can access any PCR for that truck." },
      { q: "What does gate enabled mean on the inspection?", a: "When gate is enabled crew cannot open any PCR for that truck until they have submitted their pre-trip inspection for the day. This enforces compliance and ensures equipment is verified before patient contact." },
      { q: "How do I assign crew to a truck?", a: "Use the weekly calendar grid on this page. Hover any truck/day cell, click Assign, and choose up to three crew members. The system blocks the same employee from being double-booked on two trucks on the same day, and respects the 45-minute minimum gap between runs." },
      { q: "How do I mark a truck Out of Service?", a: "Use Mark Down on the truck row and pick a date range plus a reason (Maintenance or Out of Service). The truck is blocked from new assignments for those dates, and any existing runs must be reassigned manually in Scheduling." },
    ],
  },

  "/settings": {
    title: "Settings",
    description: "Company operational settings, on-time grace window, service time defaults, session security, retention policy, system limits, and outbound caller ID.",
    questions: [
      { q: "What is this page for?", a: "This is where you configure company-wide operational parameters: late-pickup grace window, service time defaults used by feasibility checks, HIPAA session timeout, data retention commitment, the outbound caller ID used for automated patient/facility calls, and a test-email diagnostic. Clearinghouse credentials (Office Ally) are configured separately in Billing & Claims, not here." },
      { q: "What is the grace window?", a: "The late threshold, how many minutes after the scheduled pickup time a run can arrive before it is flagged as Late on the dispatch board and reports. Choose 15, 30, or 45 minutes based on how strict your on-time definition is." },
      { q: "What are the service time defaults?", a: "Load time, unload time, facility delay, dialysis B-leg buffer, and discharge buffer are the minute values the scheduler uses when calculating feasibility, whether a new run will fit on a truck without colliding with adjacent runs. Tune these to match how long your crews actually take on scene." },
      { q: "What does the session timeout do?", a: "When enabled, users are automatically logged out after 30 minutes of inactivity, with a 5-minute warning before logout. This is a HIPAA workforce control. Disabling it is flagged as a compliance risk and is not recommended." },
      { q: "What is the data retention policy?", a: "PodDispatch retains records for 10 years, meeting or exceeding applicable Medicare and state retention requirements. This setting documents your company's declared retention commitment for audits; no records are automatically deleted by the system. Only Owners can change it." },
      { q: "What are system limits?", a: "Operational caps for the deployment: up to 4 admins, 30 crew, 30 trucks, and 10 runs per truck. The overload threshold (8 runs/truck) is what turns a truck yellow/red on the Daily Ops Snapshot. These are platform-enforced, not editable." },
      { q: "What is the Verified Caller ID?", a: "The phone number, in E.164 format (e.g. +15555550123), that automated outbound calls to patients and facilities will appear to come from. You must verify this number with our calling provider before it works. If left blank, the platform's default outbound number is used." },
      { q: "What is the test email button?", a: "Sends a transactional test email to your own address so you can confirm deliverability and preview the sender name your crews, patients, and facilities will see. Useful right after onboarding or if a crew member reports missing invites." },
    ],
  },

  "/crew-dashboard": {
    title: "Crew Dashboard",
    description: "Today's run sheet for your truck, start runs, tap times, and report what's happening in the field.",
    questions: [
      { q: "What is this page for?", a: "This is your shift home base. It shows every run assigned to your truck for today in order, who your partner is, and lets you tap timestamps, open the PCR for the active run, and raise issues to dispatch." },
      { q: "Why don't I see any runs?", a: "You will only see runs when you are listed as a crew member on a truck for today and that truck has runs assigned in Scheduling. If you switched trucks mid-shift, ask your dispatcher to update the crew assignment in Trucks & Crews." },
      { q: "How do I start a run?", a: "Tap the time buttons in order. En Route, At Scene, At Patient, At Destination, In Quarters, on the active run card. Tapping At Patient opens the PCR for that run. Timestamps must be in chronological order; the system blocks out-of-order taps." },
      { q: "Patient is not ready — what do I do?", a: "Use the Patient Not Ready button on the run card. Add a short note (e.g. patient is still in dialysis) and submit. Dispatch sees a red alert on their board immediately and can decide whether to wait or reassign." },
      { q: "What is the Incident Report button?", a: "Use it to log anything that happened in the field that should be on the record, patient refusal, equipment failure, near-miss, safety concern, exposure. Dispatch sees these in real time and they are kept in the compliance record." },
      { q: "What does Emergency Upgrade do?", a: "If a non-emergency transport turns into an emergency, tap Emergency Upgrade and confirm. Within the first 120 seconds you can cancel an accidental trigger; after that it escalates to the dispatcher and is logged as an emergency incident." },
      { q: "Why is the PCR button locked on a run?", a: "The PCR opens once you tap At Patient on that run. If your truck requires a pre-trip inspection (set by your admin) you also have to complete it on the Checklist tab before any PCR will open." },
    ],
  },

  "/crew-patients": {
    title: "Patients (Crew View)",
    description: "Read-only patient lookup so you know what to expect before pickup.",
    questions: [
      { q: "What is this page for?", a: "Quick reference for any patient your company transports. Use it before pickup to check mobility, oxygen, bariatric flags, payer, and special notes." },
      { q: "Can I edit a patient here?", a: "No. The crew view is read-only. If something is wrong on the patient record, wrong address, missing equipment, expired PCS, let dispatch or the office know so they can update it in the admin Patients page." },
      { q: "How do I find a patient quickly?", a: "Use the search box at the top, it matches first name, last name, or phone number." },
      { q: "What do the icons on the patient card mean?", a: "Droplets indicate dialysis transport. Weight icon flags bariatric. Accessibility icon flags mobility needs (wheelchair, stretcher, lift assist). Stethoscope means oxygen or specialty equipment is required." },
    ],
  },

  "/crew-schedule": {
    title: "Crew Schedule (Crew View)",
    description: "Your upcoming runs across the week, see what is on the truck before the day starts.",
    questions: [
      { q: "What is this page for?", a: "It shows every run assigned to a truck you are crewed on, day by day for the current and upcoming weeks. Use it to plan your shift and to resume a PCR you already started." },
      { q: "How do I resume a PCR I started earlier?", a: "Find the run on the right day and click Continue PCR. It opens the same PCR with everything you had filled in still saved. You can also resume from the PCR tab." },
      { q: "Why is a run greyed out?", a: "A greyed run is on a day you are no longer assigned to that truck, or the run has been cancelled. The card stays visible so you can see what was on the schedule." },
      { q: "Why does a run show a different time than I remember?", a: "Dispatch can apply a one-time exception on a single date, different pickup time, address, or note, without changing the patient's recurring schedule. The time on this card is always what dispatch wants you to use." },
    ],
  },

  "/crew-schedule-admin": {
    title: "Crew Schedule Delivery",
    description: "Admin tool for delivering the daily schedule to crews, copy/text the day's run list, email it, or generate a one-day share link.",
    questions: [
      { q: "What is this page for?", a: "This is the admin delivery surface for getting today's schedule into crew hands. It is not the crew's own schedule view. From here you pick a truck and a date, then copy the formatted run list to paste into a text, email it directly to the assigned crew, or mint a one-day share link the crew can open on a personal device without logging in." },
      { q: "How is this different from the crew Schedule page?", a: "The crew Schedule page (inside the crew UI) is read-only and shows the crew their own upcoming runs. This admin page does the opposite, it packages and pushes the schedule out. Crews never see this page; only owners, dispatchers, and managers do." },
      { q: "What does Copy Daily Schedule do?", a: "It formats the selected truck's runs for the selected date into a clean text block, pickup times, patient names, addresses, return legs, and any flags, ready to paste into SMS, Slack, or any messenger. The system does not send the text for you; the copy-and-paste flow keeps you in control of which number you send it to." },
      { q: "What does Email Schedule do?", a: "It sends today's run list for the selected truck to the email address of every active crew member currently assigned to that truck. You can override the recipient if you need to send it somewhere else (e.g. a relief driver). Send events are logged in Email Activity." },
      { q: "What is a share link / Backup Link?", a: "A one-day, one-truck URL (under /crew/:token) that opens the daily run sheet without requiring login. Use it when a crew member is on a personal device, hasn't been onboarded yet, or has lost access. Links expire automatically, they are scoped to one truck for one date." },
      { q: "Why is a truck missing from the dropdowns?", a: "Trucks marked Out of Service are excluded from schedule delivery, you cannot send a schedule for a truck that should not be running. Restore the truck in Trucks & Crews to make it selectable again." },
      { q: "Why does the SMS button say Coming Soon?", a: "Direct outbound SMS from the platform is not enabled yet, use Copy Daily Schedule and paste into your messenger of choice, or use Email Schedule." },
      { q: "Can I send tomorrow's schedule today?", a: "Yes. The date picker lets you pick any date in the current scheduling window (up to ~13 months out). Crews will receive whatever is on the board for that date at the moment you send it." },
    ],
  },

  "/crew-checklist": {
    title: "Pre-Trip Inspection",
    description: "Daily Georgia DPH vehicle and equipment check that must be completed before patient contact.",
    questions: [
      { q: "What is this page for?", a: "This is your daily pre-trip inspection for the truck you are crewed on today. You go through each item, mark it OK or Missing, and submit. The submitted record is kept for compliance audits." },
      { q: "Do I have to complete this every day?", a: "Yes, once per truck per day. If you switch trucks during the day, the new truck needs its own inspection. Your dispatcher sees a red badge on the Checklist tab until it is submitted." },
      { q: "What if I mark something Missing?", a: "Add a short note describing what is missing or broken. The inspection still submits, but dispatch is alerted and the item shows up in the Vehicle Inspections compliance log. Severely missing items may block runs until they are fixed." },
      { q: "Why is the checklist locked?", a: "You are either not currently crewed on a truck for today, or your admin has not enabled the inspection for your truck. Talk to dispatch, the assignment is set in Trucks & Crews." },
      { q: "Can I redo today's inspection?", a: "No. Once submitted, the record is final for audit reasons. If something changed mid-shift, raise it as an Incident Report from the dashboard so it is properly logged." },
    ],
  },

  "/pcr": {
    title: "Patient Care Report (PCR)",
    description: "Document the transport, times, vitals, assessments, signatures, and narrative.",
    questions: [
      { q: "What is this page for?", a: "This is the patient care report for a single run. You fill in times, vitals, assessment, equipment used, signatures, and the narrative. When complete and signed, it locks and the trip moves to billing." },
      { q: "Why are some sections greyed out?", a: "Cards are turned on or off based on the transport type (dialysis, IFT, emergency, etc.) and the payer. Anything that does not apply to this trip is hidden so you only fill in what is needed." },
      { q: "Why is a field showing red?", a: "Red means it is required for this transport/payer and is still empty. The Pre-Submit checklist will block submission until every required field is filled and the timestamps are in order." },
      { q: "I started a PCR, where do I find it again?", a: "Open it from the Schedule tab or the PCR tab, both show a Continue button on any run that already has a saved-in-progress PCR. The PCR auto-saves as you type, so you will not lose work." },
      { q: "What is the Vehicle / Unit field?", a: "It is pre-filled with your truck name when the PCR opens. You can edit it, but it should match the truck in the system so the narrative and the inspection record line up." },
      { q: "Why is At Destination locked?", a: "You have to record at least one set of vitals before the At Destination timestamp is unlocked. This is a documentation gate to make sure the trip is properly assessed." },
      { q: "How do signatures work?", a: "Each crew member on the truck signs their own crew signature. Then you collect a patient or representative signature. Some payers also need a Refusal-to-Sign or Partner Sign Here flow, those modals appear automatically when needed." },
      { q: "Can I correct a PCR after it is submitted?", a: "Only admins can open a submitted PCR for correction. They use the targeted PCR Correction workflow which requires a reason and is fully audit-logged." },
      { q: "What does the Cancellation button do?", a: "If the transport did not happen, no-show, refusal, sent on another vehicle, open the cancellation form. You pick the reason and capture the required documentation, and the trip is closed out instead of needing a full PCR." },
    ],
  },

  "/crew/:token": {
    title: "Daily Run Sheet (Share Link)",
    description: "Read-only daily run list opened via a share link, typically used by crew on a personal device.",
    questions: [
      { q: "What is this page for?", a: "It is the same daily run sheet as the Crew Dashboard, opened from a one-day share link your dispatcher sent you. Use it when you are not logged in to your full crew account." },
      { q: "Can I tap times and open a PCR from here?", a: "Yes, the share link supports the same time taps, alerts, and PCR access as the logged-in Crew Dashboard. The link is scoped to one truck for one day." },
      { q: "The link says expired — what now?", a: "Share links are issued per day. Ask dispatch to send you the link for today, or sign in to your crew account directly at the login page." },
    ],
  },

  "/facilities": {
    title: "Facilities",
    description: "Directory of every dialysis center, hospital, SNF, and other pickup/dropoff facility your company services.",
    questions: [
      { q: "What is this page for?", a: "This is your facility directory, every dialysis center, hospital, nursing facility, or other site you pick up from or drop off at. Facilities are referenced by patient records and runs, so adding them here keeps addresses, contacts, and contracted rates consistent across the system." },
      { q: "What facility types are supported?", a: "Six standard types: Dialysis (with subtype), Hospital, SNF / Nursing facility, and additional categories for ALF, clinic, and residence. Each type carries its own clinical and financial metadata used in scheduling and billing." },
      { q: "What does the patient count column show?", a: "How many patient records currently use this facility as their dropoff (or treatment site). Use it to gauge volume and to spot unused facilities before deleting them." },
      { q: "What is the contract payer type / rate type?", a: "If a facility pays you directly under a contract (rather than billing Medicare/Medicaid per patient), set the contract payer type and rate type here. These values drive which rate is applied on the charge master when claims are generated for runs to this facility." },
      { q: "How do I deactivate a facility?", a: "Edit the facility and toggle Active off. Inactive facilities are hidden from new patient assignments and run creation, but historical trips and patient records that reference them are preserved." },
      { q: "Can I delete a facility?", a: "Yes, using the trash icon, but only after confirming the deletion in the confirmation dialog. Facilities still referenced by active patients should be deactivated instead of deleted to keep historical records intact." },
    ],
  },

  "/migration": {
    title: "Migration & Import",
    description: "Bring legacy data (patients, trips, trucks, employees) from your old system into PodDispatch.",
    questions: [
      { q: "What is this page for?", a: "This is the migration hub for moving off your old dispatch/billing system. From here you bulk-import patients, trips, trucks, and employees from CSV files, run a guided quick-start, operate in parallel-run mode while you cut over, and review the full history of every import you've performed." },
      { q: "What is the Import tab?", a: "Upload a CSV, map its columns to PodDispatch fields, preview the result with duplicate and data-quality warnings, then commit. Each import is logged so you can see what was added, skipped, and flagged." },
      { q: "What is the Quick Start wizard?", a: "A guided flow for new companies that walks you through importing the minimum data needed to start dispatching, patients, trucks, and crew, in the recommended order." },
      { q: "What is Parallel Run Mode?", a: "Use this while you're still running your old system alongside PodDispatch. It lets you import recent trip data periodically so you can compare PodDispatch output (claims, reports) against your existing system before fully cutting over." },
      { q: "How does duplicate detection work?", a: "On patient imports, the system matches first+last name against existing patients (case-insensitive, with partial-match warnings). Likely duplicates are shown in the preview so you can decide whether to skip them or import anyway." },
      { q: "Where do I see past imports?", a: "The History tab lists every import run for your company, file name, data type, row counts, errors, and who performed it. Use it as an audit trail and to re-download error reports." },
    ],
  },

  "/onboarding": {
    title: "Onboarding Wizard",
    description: "Six-step guided setup that gets your company ready to dispatch and bill.",
    questions: [
      { q: "What is this page for?", a: "The 6-step onboarding wizard that walks a new company from sign-up to a working dispatch + billing operation. It tracks progress on company info, charge master rates, clearinghouse connection, trucks, crew/employees, and first patient, and shows you which steps are done, in progress, or still needed." },
      { q: "Why is the company info step locked here?", a: "Company identity fields (legal name, NPI, EIN, billing address) are captured at sign-up and are not editable from production pages, only Owners can change them, and the change is logged. This step confirms what was captured so you can fix it before going live." },
      { q: "What does verifying my rates mean?", a: "Setting a base rate and a per-mile rate for each payer you plan to bill, on the Charge Master tab in Billing & Claims. At least one payer must have both values greater than $0 before the wizard considers this step complete, otherwise generated claims will have $0 amounts." },
      { q: "Do I have to connect a clearinghouse to use PodDispatch?", a: "No. You can dispatch and document trips without it. But to electronically submit 837P claims and import 835 payments / 999 acknowledgments automatically, you need to connect Office Ally credentials. Until then you can still export 837P files manually and upload them to your clearinghouse portal." },
      { q: "Can I skip steps and come back later?", a: "Yes. Each step records its own completion flag, so you can do them in any order and resume any time. The wizard is also accessible from the Onboarding Checklist that appears at the top of admin pages until everything is complete." },
      { q: "What happens when all six steps are done?", a: "The wizard congratulates you and the persistent onboarding checklist disappears from admin pages. From that point on, this page is mostly informational, you can revisit it any time, but it stops nudging you." },
    ],
  },

  "/admin/email-activity": {
    title: "Email Activity",
    description: "Log of every transactional email PodDispatch has sent on behalf of your company.",
    questions: [
      { q: "What is this page for?", a: "The deliverability log for every transactional email the platform sends out on your behalf, employee invites, password resets, crew schedule emails, support replies, and other system notifications. Use it to confirm an email went out, to whom, when, and whether it was delivered or bounced." },
      { q: "What do the status values mean?", a: "Pending = handed off to the email provider, not yet confirmed. Sent = accepted and delivered by the provider. Failed = the provider rejected it (error message shown in the row). Bounced = the recipient's mail server rejected it after delivery. Suppressed = the address is on the platform's do-not-send list (typically after repeated bounces or complaints)." },
      { q: "Why didn't my crew member get their invite?", a: "Filter by their email address and look at the most recent row. If the status is Sent but they don't have it, ask them to check spam and confirm the address is correct. If it's Bounced or Failed, the error message tells you why (bad address, full mailbox, blocked by their domain). Resend from the Employees page after fixing the issue." },
      { q: "What is the Resend ID?", a: "The unique tracking ID returned by our email provider for that send. It's mainly useful for support, paste it into a support ticket and we can look up the full delivery trail (opens, clicks, provider-side bounces)." },
      { q: "How far back does this go?", a: "The date-range filter spans the last 24 hours, 7 days, 30 days, or 90 days. Older entries are retained but aren't shown by default. Results are capped at the most recent 500 rows per filter to keep the page fast, narrow your filters if you need to find something older." },
      { q: "Why do I see a Company column?", a: "Only system creators see the Company column and the company filter, they can view email activity across every company on the platform. Company users only see their own company's emails." },
    ],
  },
};

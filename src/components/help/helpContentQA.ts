/** Page-specific Q&A help content for the contextual help panel. */

export interface HelpQA {
  title: string;
  description: string;
  questions: { q: string; a: string }[];
}

export const PAGE_HELP_QA: Record<string, HelpQA> = {
  "/": {
    title: "Dispatch Command",
    description: "Live operations view: every active truck, every run, real-time trip status.",
    questions: [
      { q: "What is this page for?", a: "It is your live operations view. Every active truck, every assigned run, and the real-time status of each trip from dispatch through completion." },
      { q: "How is the page laid out?", a: "Top: date navigation and a Report Incident button. Then Pending Crew Cancellations (when present), Patient Alerts, the general Alerts panel, the Failed Calls banner, and the Communications section. Below that is the Trucks grid with one TruckCard per truck. Use Expand All / Collapse All to see every run at once." },
      { q: "How do I know if a run is on time?", a: "Each run card carries an on-time badge. Late means the crew has not tapped the first PCR timestamp and the scheduled pickup time has passed. The hold timer on the card shows how long the crew has been on scene or at destination." },
      { q: "How do I reassign a run to a different truck?", a: "Click the run card and use the reassign action. The system checks the receiving truck for time conflicts before confirming the move." },
      { q: "What does the Communications section do?", a: "It lists active runs and gives you Call Patient and Call Facility buttons to queue an automated delay-notification call. The message is pre-filled with patient name, pickup time, and your ETA. Failed calls also show as a red banner above." },
      { q: "What do the alert colors mean?", a: "Green is informational and auto-dismisses. Yellow needs attention but is not urgent. Red requires dispatcher acknowledgement before it clears (missing inspections, flagged safety issues, etc.)." },
      { q: "How do I handle a cancellation?", a: "Cancelled runs appear in the Pending Cancellation panel. Resolve each one by confirming the cancellation or reassigning the run before it clears from the board." },
      { q: "What is Report Incident at the top?", a: "It opens the incident report form so dispatch can log a field event (refusal, near-miss, equipment failure, exposure) directly without waiting for the crew to file it." },
    ],
  },

  "/dispatch": {
    title: "Dispatch Command",
    description: "Live operations view: every active truck, every run, real-time trip status.",
    questions: [
      { q: "What is this page for?", a: "It is your live operations view. Every active truck, every assigned run, and the real-time status of each trip from dispatch through completion." },
      { q: "How is the page laid out?", a: "Date navigation and Report Incident at the top, then Pending Crew Cancellations, Patient Alerts, Alerts, Failed Calls banner, Communications, and the Trucks grid. Expand All / Collapse All toggles every TruckCard at once." },
      { q: "How do I know if a run is on time?", a: "Each run shows an on-time badge. Late means the scheduled pickup time has passed without the first PCR timestamp. Hold timers show wait time at scene or destination." },
      { q: "How do I reassign a run?", a: "Click the run card and use the reassign action. The system blocks moves that would create a time conflict on the receiving truck." },
      { q: "What does the Communications section do?", a: "Active runs with Call Patient / Call Facility buttons. The automated call is pre-filled with patient name, pickup time, and ETA. Failed calls appear in the red banner above the section." },
      { q: "What do the alert colors mean?", a: "Green is informational. Yellow needs attention. Red requires acknowledgement before it clears (missing inspection, flagged safety issue, unconfirmed cancellation, etc.)." },
      { q: "How do I handle a cancellation?", a: "Resolve each entry in the Pending Cancellation panel by confirming or reassigning. Unresolved cancellations stay on the board." },
      { q: "What is the Report Incident button?", a: "Opens the incident form so dispatch can log a field event directly when the crew cannot." },
    ],
  },

  "/scheduling": {
    title: "Patient Runs & Scheduling",
    description: "Build each day by assigning runs to trucks before dispatch goes live.",
    questions: [
      { q: "What is this page for?", a: "Build the day before it starts. Drag runs from the pool onto trucks, set exceptions, and confirm assignments. Once the day is built, Dispatch Command manages it live." },
      { q: "Week view vs. day view?", a: "Top buttons switch between them. Week view is where you copy crew assignments forward across days. Day view is where you build that single day, add A and B legs, and reassign runs." },
      { q: "How do I assign a run to a truck?", a: "Drag any run card from the Run Pool onto a truck column. You can also reorder runs within a truck by dragging up or down." },
      { q: "What is the Run Pool?", a: "All unassigned runs for the selected day. The system pre-generates A and B legs from recurring patient schedules (dialysis days, outpatient appointment days). You can also add one-off runs from each truck's + A Leg / + B Leg buttons." },
      { q: "What does Auto-Fill from Templates do?", a: "It generates A and B legs from your recurring patient schedules for the selected date and drops them in the unassigned pool. Run it once each morning, then assign." },
      { q: "Why is a run flagged unsafe?", a: "The safety check compares what the patient needs (bariatric stretcher, oxygen, stair chair, ALS-trained crew) against what the assigned truck and crew have. Mismatches are flagged before dispatch ever sees them." },
      { q: "What is Copy Crew Assignments Forward?", a: "From week view, copy this week's crew layout into upcoming weeks (1 month, 3 months, or rest of year) so you do not have to rebuild rosters every Monday." },
      { q: "What does the exception dialog do?", a: "If the run you are moving conflicts with another, you can override with a documented reason. Overrides are logged to the Override Monitor." },
    ],
  },

  "/trips": {
    title: "Trips & Clinical",
    description: "Every completed run as a trip record: documentation status, mileage, billing readiness.",
    questions: [
      { q: "What is this page for?", a: "The full ledger of completed runs. Every trip shows its documentation status, mileage, billing readiness, and PCR state. This is where billing reviews trips before they become claims." },
      { q: "What are the status filters at the top?", a: "Pills filter the table by status (All, In Progress, Completed, etc.). Use them to focus on what needs work without resorting tables." },
      { q: "How does a trip move to billing?", a: "Automatically once the crew submits the PCR and required documentation is complete. You can also push it manually with Ready for Billing if you have resolved every blocker." },
      { q: "What does the Clean badge mean?", a: "Clean means all documentation is present and a clean claim can be generated. Blocked means something is missing — click the trip to see exactly what." },
      { q: "How do I view or edit the PCR for a trip?", a: "Click Edit on the trip row to open the trip detail dialog. From there you can view every PCR field, timestamps, vitals, signatures, and attached documents. Admins can also open a submitted PCR for targeted correction." },
      { q: "What does the status history show?", a: "Every status change the trip went through, who made it, when, and what changed from and to. This is your audit trail." },
      { q: "Can I export?", a: "Yes. Export CSV at the top dumps every visible trip based on your current filter." },
    ],
  },

  "/billing": {
    title: "Billing & Claims",
    description: "Turn completed trips into paid claims. Review, submit, track payments, work denials.",
    questions: [
      { q: "What is this page for?", a: "Completed trips become paid claims here. You review documentation, run the pre-submit checklist, submit to Office Ally, watch the submission queue, work denials, and track payments." },
      { q: "What are the tabs on this page?", a: "Four: Claims Board (default), Charge Master, Missing Money, and Payer Directory. The toolbar also has link-buttons for 837P Export and 835 Import — those open dedicated pages, not tabs." },
      { q: "What is on the Claims Board?", a: "Every claim filtered by date, payer, and status, plus toolbar actions: Sync from Trips (pull in new completed trips), Scan Missing (run the missing-money checks), Check for Payments (poll Office Ally), Refresh, Export CSV, and Work Denials (a quick filter)." },
      { q: "How do I submit a claim?", a: "Open a claim from the Claims Board. Run Pre-Submit to clear the 8-point checklist. If it passes, the Submit to Office Ally button appears with a confirm dialog. You can also generate the 837P file from the toolbar and upload it to your clearinghouse portal." },
      { q: "What does Blocked mean?", a: "The claim cannot ship yet — something required is missing. The claim shows a plain-English reason and a Fix button that jumps you to the right spot." },
      { q: "What is on the Charge Master tab?", a: "Your rate table for each payer (Medicare, Medicaid, Commercial, Self-Pay, Default). Add Rate opens the rate dialog. If you change a rate while orphan claims exist, the orphan warning dialog asks how to apply it." },
      { q: "What is the Missing Money tab?", a: "The five-category scanner that finds revenue you may have left on the table — unbilled completed trips, claims missing modifiers, underpayments versus contract, expired timely-filing windows, and secondary opportunities you have not generated yet." },
      { q: "What is the Payer Directory tab?", a: "Your payer lookup with addresses, payer IDs, timely-filing days, and contact info. The directory drives the timely-filing deadlines you see on the Claims Board." },
      { q: "What is the Submission Pipeline strip?", a: "Live status across all in-flight submissions (queued, accepted, rejected, paid). The Submission Queue Errors panel below it details anything Office Ally pushed back." },
      { q: "What does the 835 Import button do?", a: "Opens the Remittance Import page. Drop in the 835 file from your clearinghouse and the parser matches each line to an existing claim, posts payments, translates denial codes, and quarantines anything it cannot match." },
      { q: "What does a denial code mean?", a: "Each denial code is translated to plain English in the claim detail. CO-45 means the payer reduced the charge to their allowed amount (no action). CO-16 means missing information — fix the documentation and resubmit through the Denial Recovery flow." },
      { q: "How do secondary insurance opportunities work?", a: "After Medicare pays (typically 80%), if the patient has secondary coverage on file the claim flags a secondary opportunity. Generate Secondary Claim builds the crossover automatically." },
    ],
  },

  "/compliance": {
    title: "Compliance & QA",
    description: "Documentation quality, vehicle inspections, incidents, overrides, claim failures, payer rules.",
    questions: [
      { q: "What is this page for?", a: "Your full compliance dashboard. Everything an auditor or surveyor will ask for lives in one of the tabs here." },
      { q: "What are the tabs on this page?", a: "Seven: QA Queue, Incidents, Overrides Log, Claim Failures, Compliance Vault, Payer Rules, and Vehicle Inspections." },
      { q: "What is the QA Queue?", a: "Trips that anomaly detection or kickback rules flagged for human review. Resolving them produces audit-defensible claims. Run Auto-Flag at the top to re-scan all completed trips." },
      { q: "What are red flags vs. yellow flags?", a: "Red flags block claims (missing medical necessity, no crew signature, missing timestamp). Yellow flags are consistency warnings that need review but do not auto-block (simultaneous timestamps, odometer mismatch)." },
      { q: "What is the Incidents tab?", a: "Every incident reported from the field — crew, dispatch, admin. Open one to see the form, attachments, and resolution. New incidents can be filed here directly with the Report Incident form." },
      { q: "What is the Overrides Log tab?", a: "Every safety override and billing override that anyone in your company has approved, with reason text and timestamp. Same data the system Override Monitor sees, scoped to your company." },
      { q: "What is the Claim Failures tab?", a: "Claims rejected by Office Ally or the payer at the submission layer (999/277CA failures). Each row shows the failure reason and a link back to the claim to fix and resubmit." },
      { q: "What is the Compliance Vault tab?", a: "Document storage for licenses, BAAs, DPH inspection certificates, COIs, policies. Upload, version, and retrieve when an auditor asks." },
      { q: "What is the Payer Rules tab?", a: "Documentation requirements per payer (Medicare, Medicaid, facility contracts, cash). These rules drive the billing-gate checks and the required-field indicators inside the PCR." },
      { q: "What is the Vehicle Inspections tab?", a: "Completed daily pre-trip inspections from the crew. Filter by date and truck, see which items were marked missing, view dispatcher acknowledgements. Export CSV for audit packets." },
    ],
  },

  "/patients": {
    title: "Patients",
    description: "Patient directory: every patient your company transports lives here.",
    questions: [
      { q: "What is this page for?", a: "Your patient directory. Every patient must have a record here before they can be scheduled." },
      { q: "How do I filter the list?", a: "Use the status dropdown above the table (Active, In Hospital, Out of Hospital, Vacation, Paused) plus the search box. Pagination is at the bottom." },
      { q: "What are the toolbar tools?", a: "Add Patient opens the full add/edit dialog. Insurance Tools at the top runs eligibility checks and can prefill a new patient straight from the clearinghouse. Export CSV dumps every filtered patient. Bulk Delete removes selected patients after a destructive confirm." },
      { q: "What goes in the patient dialog?", a: "Transport type, pickup address, dropoff facility, mobility, weight, primary/secondary insurance, ICD-10 (via the picker), document attachments, schedule days (MWF, TTS, custom), and schedule overrides. Anything missing here will show as a red blocker on the claim later." },
      { q: "What is PCS on File?", a: "Physician Certification Statement. Medicare requires an active PCS for recurring non-emergency transport (dialysis especially). Toggle it on when you have the signed PCS and upload the document in the Documents section of the dialog." },
      { q: "What is a Standing Order?", a: "Physician authorisation for recurring transport on a regular schedule. Simplifies dialysis and other repeat-trip scheduling." },
      { q: "What does the Special Equipment field do?", a: "Flags the safety needs (Bariatric Stretcher, Extra Crew, Lift Assist, Other) used by the scheduling safety check to confirm the assigned truck and crew are capable." },
      { q: "What is the Patient View dialog vs. Edit?", a: "Clicking the row opens the read-only Patient View dialog (good for crew or biller reference). The pencil icon opens the full edit dialog. The Claim Timeline drawer is also available from the patient context to see every claim tied to them." },
      { q: "What is the Upstream Readiness panel inside edit?", a: "It tells you whether the patient is set up cleanly enough to generate a clean claim — missing fields are listed there so you can fix them before scheduling." },
    ],
  },

  "/employees": {
    title: "Employees",
    description: "Manage your team: add employees, assign roles, control access.",
    questions: [
      { q: "What is this page for?", a: "Roster of every person with access to PodDispatch. Add employees, assign roles, reset passwords, deactivate departures." },
      { q: "What roles are available?", a: "Owner: full access including subscription, NPI/EIN, owner promotion, and clearinghouse credentials. Manager: broad admin across operations, scheduling, billing, compliance — but cannot edit clearinghouse, change subscription, edit NPI/EIN, or promote an owner. Dispatcher: dispatch board, scheduling, patients, trucks, employees. Biller: claims, billing workflows, compliance, view-only patient/facility data. Crew: only the crew UI for their assigned runs. Certified admins (Owner/Manager/Dispatcher/Biller) can also enter the crew UI directly without a separate account." },
      { q: "How do I add an employee?", a: "Click Add Employee, fill in name, email, phone, role, and certification level. They receive an invitation email with a password-set link." },
      { q: "A crew member forgot their password — what now?", a: "Click Reset Password next to their row. A reset email goes to their registered address with a link to set a new password." },
      { q: "Where do I see what email they log in with?", a: "The Email column on the table is the login address and where every system notification goes." },
      { q: "How do I deactivate someone who has left?", a: "Edit the row and set status to Inactive. They lose access immediately. All their historical records are preserved." },
      { q: "Are there limits?", a: "Yes. Up to 4 admin-class users (Owner/Manager/Dispatcher/Biller combined) and 30 crew per company." },
    ],
  },

  "/reports": {
    title: "Reports & Metrics",
    description: "Operational and financial performance across four lenses.",
    questions: [
      { q: "What is this page for?", a: "Your performance summary. Trip volume, billing completion, on-time performance, AR aging, and revenue cycle health — all in one place." },
      { q: "What are the tabs?", a: "Four: Overview (KPI summary cards), OTP & Risk (on-time performance charts and risk flags), AR Aging (aging buckets table), Revenue Cycle (trend charts)." },
      { q: "What does Billing Complete Rate mean?", a: "Percentage of completed trips that have a clean submitted claim. A low rate means trips are completing but documentation or billing issues are preventing submission." },
      { q: "What does Late Pickup Rate mean?", a: "Percentage of runs where the crew arrived more than 15 minutes after the scheduled pickup time. A high rate often points to scheduling or routing problems." },
      { q: "What does AR Aging show?", a: "How long submitted claims have been waiting for payment, bucketed 0–30, 31–60, 61–90, and 90+ days. Anything past 60 days should be on the follow-up queue." },
      { q: "What does Utilization mean?", a: "Percentage of scheduled capacity actually used. A truck scheduled for 8 runs that completed 6 is 75% utilised." },
      { q: "How do I change the date range?", a: "Date range selector at the top: Today, This Week, This Month, or Custom." },
    ],
  },

  "/owner-dashboard": {
    title: "Command Center",
    description: "30-second business health check: today's operations, money, denials, gaps.",
    questions: [
      { q: "What is this page for?", a: "Your 30-second business health check. Six cards summarise the most important things happening today so you know whether things are normal or something needs attention." },
      { q: "What are the cards I see?", a: "Today's Operations (trips, trucks, inspections), Money Coming In (90-day claims + month collected), Denials this month, Secondary Opportunities, Denial Recovery action list, and Documentation Gaps. Each card has a button that drills into the source page (Billing, Trips, Compliance)." },
      { q: "What is the status line at the top?", a: "Plain-English summary of the day. Green is normal. Yellow needs attention but is not urgent. Red means action is required today." },
      { q: "What are Secondary Opportunities?", a: "Claims where a patient has secondary insurance that could recover more revenue beyond what Medicare or Medicaid paid. Click the card to jump straight to those claims and generate the secondary." },
      { q: "What does Documentation Gaps show?", a: "Trips that are complete but have PCR issues blocking them from billing. Resolve these quickly to keep revenue from sitting." },
      { q: "Why is Money Coming In showing zero?", a: "Either no claims have been submitted yet or every submitted claim has already been paid or denied. The page only counts open submitted claims." },
    ],
  },

  "/trucks": {
    title: "Trucks & Crews",
    description: "Configure your fleet and assign crews to trucks day by day.",
    questions: [
      { q: "What is this page for?", a: "Two things in one page: configure trucks (equipment, inspection checklist, OOS dates) and assign crews to trucks day by day on the weekly calendar." },
      { q: "How is the page laid out?", a: "Trucks section at the top with the truck list. Crew Assignments section below with the weekly calendar grid. Use the week navigator at the top of the calendar to move between weeks." },
      { q: "How do I add a truck?", a: "Add Truck button. Enter the name and vehicle ID. Then click the truck to set equipment flags (bariatric stretcher, oxygen, etc.) and the inspection checklist template." },
      { q: "What equipment flags matter most?", a: "Bariatric Stretcher is the most important because it determines whether bariatric patients can be assigned to that truck. Other equipment is verified through the daily pre-trip inspection." },
      { q: "What is the vehicle inspection configuration?", a: "Each truck has a template where you choose which items from the Georgia DPH checklist crew must verify before each shift. The gate toggle blocks PCR access for that truck until the inspection is submitted that day." },
      { q: "How do I assign crew to a truck?", a: "Hover the truck/day cell on the calendar, click Assign, and pick up to three crew members (M1/M2/M3). The system blocks the same employee from being double-booked across two trucks on the same day. A 45-minute back-to-back gap warning is an optional toggle in Admin → On-Time Settings, off by default." },
      { q: "What is Copy Schedule Forward?", a: "Roll a known-good week of crew assignments forward 1 month, 3 months, or to the end of the year, matching by weekday or by every-day pattern. Saves rebuilding rosters every Monday." },
      { q: "How do I mark a truck Out of Service?", a: "Mark Down on the truck row. Pick Down-Maintenance or Down-Out of Service, set a date range, and add a reason. The truck is blocked from new assignments for those dates; existing runs must be reassigned manually in Scheduling." },
    ],
  },

  "/settings": {
    title: "Company Settings",
    description: "Operational defaults that change how the rest of the system behaves.",
    questions: [
      { q: "What is this page for?", a: "Company-wide operational parameters: late-pickup grace window, service time defaults used by feasibility checks, HIPAA session timeout, retention policy, outbound caller ID, and a test-email diagnostic. Clearinghouse credentials (Office Ally) are configured separately, on the Billing & Claims page." },
      { q: "What is the On-Time grace window?", a: "How many minutes after the scheduled pickup time a run can arrive before it is flagged Late on the dispatch board and reports. Pick 15, 30, or 45 minutes based on how strict your definition is." },
      { q: "What is the 45-minute run-gap toggle?", a: "Optional warning that flags back-to-back runs on the same truck scheduled less than 45 minutes apart. Off by default for every new company. Turn it on if you want a heads-up before tight runs are scheduled; the On-Time tracker still catches the consequences either way." },
      { q: "What are the service time defaults?", a: "Load time, unload time, facility delay buffer, dialysis B-leg buffer, and discharge buffer. The scheduler uses these to calculate whether a new run will fit on a truck without colliding with adjacent runs. Tune them to match how long your crews actually take on scene." },
      { q: "What does the session timeout do?", a: "When enabled, users are automatically logged out after 30 minutes of inactivity, with a 5-minute warning. This is a HIPAA workforce control. Disabling it is flagged as a compliance risk and is not recommended." },
      { q: "What is the data retention policy?", a: "PodDispatch retains records for 10 years, meeting or exceeding Medicare and state requirements. This setting documents your declared retention commitment for audits; no records are auto-deleted by the system. Only Owners can change it." },
      { q: "What are the system limits?", a: "Operational caps: up to 4 admins, 30 crew, 30 trucks, and 10 runs per truck. The overload threshold (8 runs per truck) is what turns a truck yellow or red on the Daily Ops Snapshot. These are platform-enforced and not editable." },
      { q: "What is the Verified Caller ID?", a: "The phone number (E.164, like +15555550123) that automated outbound calls to patients and facilities appear to come from. You must verify the number with our calling provider first. Blank means the platform's default outbound number is used." },
      { q: "What is the test email button?", a: "Sends a transactional test email to your own address so you can confirm deliverability and preview the sender name your crews, patients, and facilities will see. Useful right after onboarding or when a crew member reports missing invites." },
    ],
  },

  "/crew-dashboard": {
    title: "Crew Workspace",
    description: "Today's run sheet for your truck. Start runs, tap times, raise issues.",
    questions: [
      { q: "What is this page for?", a: "Your shift home. Every run assigned to your truck for today in order, who your partner is, plus tap-to-record timestamps, PCR access, and the buttons to raise issues to dispatch." },
      { q: "Why don't I see any runs?", a: "You will only see runs when you are crewed on a truck for today and that truck has runs in Scheduling. If you switched trucks mid-shift, ask your dispatcher to update Trucks & Crews." },
      { q: "How do I start a run?", a: "Tap the time buttons in order on the active run card: En Route → At Scene → At Patient → At Destination → In Quarters. Tapping At Patient opens the PCR. Timestamps must be chronological; out-of-order taps are blocked." },
      { q: "What do Patient Not Ready and Facility Delay do?", a: "They start a documented hold timer so dispatch knows why you are waiting. Add a short note (e.g. patient still in dialysis), confirm, and dispatch sees the red alert on their board immediately. Cancel Hold ends the timer when the wait ends." },
      { q: "What is the Cancel button on a run?", a: "Opens the cancel-trip dialog with a reason text field. After confirming, the cancellation documentation form opens automatically so the trip is properly closed out instead of needing a full PCR." },
      { q: "What is Report Incident?", a: "Log anything that happened in the field that should be on the record — patient refusal, equipment failure, near-miss, safety concern, exposure. Dispatch sees these live and they are kept in the compliance record." },
      { q: "What does the Emergency Event button do?", a: "If a non-emergency transport turns into an emergency, tap it and confirm. You have 120 seconds to cancel an accidental trigger; after that it escalates to dispatcher and is logged as an emergency incident." },
      { q: "Why is the PCR button locked on a run?", a: "The PCR opens once you tap At Patient. If your truck requires a pre-trip inspection, you also have to submit it on the Checklist tab before any PCR will open." },
    ],
  },

  "/crew-patients": {
    title: "Patients (Crew View)",
    description: "Read-only patient lookup so you know what to expect before pickup.",
    questions: [
      { q: "What is this page for?", a: "Quick reference for any patient your company transports. Use it before pickup to check mobility, oxygen, bariatric flags, payer, and special notes." },
      { q: "Can I edit a patient here?", a: "No. The crew view is read-only. If something is wrong, tell dispatch or the office so they can update it in the admin Patients page." },
      { q: "How do I find a patient quickly?", a: "Search box at the top matches first name, last name, or phone number." },
      { q: "What do the icons on the patient card mean?", a: "Droplets = dialysis transport. Weight = bariatric. Accessibility = mobility needs (wheelchair, stretcher, lift assist). Stethoscope = oxygen or specialty equipment required." },
      { q: "How do I see insurance?", a: "Expand the patient card. Primary insurance and member ID are hidden in the collapsed view to keep PHI off-screen." },
    ],
  },

  "/crew-schedule": {
    title: "Crew Schedule (Crew View)",
    description: "Your upcoming runs across the week. See what is on the truck before the day starts.",
    questions: [
      { q: "What is this page for?", a: "Every run assigned to a truck you are crewed on, day by day, current and upcoming weeks. Plan your shift and resume PCRs you already started." },
      { q: "How is it laid out?", a: "Week navigator at the top, then a 7-day picker row. Partner name shows in a banner. Each day lists run cards with leg type (A or B), patient name, pickup time, transport type, and pickup → destination." },
      { q: "How do I resume a PCR I started earlier?", a: "On any run with a saved-in-progress PCR you see Continue. Click it and the PCR opens exactly where you left off. Run cards also show Start (not started) and View (completed) depending on state." },
      { q: "Why is a run greyed out?", a: "You are no longer assigned to that truck on that day, or the run has been cancelled. The card stays visible so you can see what was on the schedule." },
      { q: "Why does a run show a different time than I remember?", a: "Dispatch applied a one-time exception for that date (different pickup time, address, or note) without changing the patient's recurring schedule. The card always shows the time dispatch wants you to use." },
    ],
  },

  "/crew-schedule-admin": {
    title: "Crew Schedule Delivery",
    description: "Push today's run list to crews: copy/text, email, or one-day share link.",
    questions: [
      { q: "What is this page for?", a: "The admin delivery surface for getting today's schedule into crew hands. Pick a truck and date, then copy the formatted run list to paste into a text, email it to the assigned crew, or mint a one-day share link the crew opens without logging in." },
      { q: "How is it laid out?", a: "Three cards: Schedule Date (calendar picker with Back to Today), Daily Schedule Text (truck select + Copy / Send SMS / Send Email actions), and Backup Share Link (truck select + generate/copy link)." },
      { q: "How is this different from the crew Schedule page?", a: "The crew Schedule page is read-only and shows crew their own runs. This admin page packages and pushes the schedule outward. Crews never see this page; only owners, managers, and dispatchers do." },
      { q: "What does Copy Daily Schedule do?", a: "Formats the truck's runs for the selected date into clean text — pickup times, patient names, addresses, return legs, flags — ready to paste into SMS, Slack, or any messenger. The system does not send the text for you; you stay in control of which number receives it." },
      { q: "What does Email Schedule do?", a: "Sends the formatted run list to every active crew member currently assigned to that truck. You can override the recipient (e.g. relief driver). Every send is logged in Email Activity." },
      { q: "What is the Backup Share Link?", a: "A one-day, one-truck URL (under /crew/:token) that opens the daily run sheet without login. Use it when a crew member is on a personal device, hasn't been onboarded yet, or has lost access. Links expire automatically." },
      { q: "Why is a truck missing from the dropdowns?", a: "Trucks marked Out of Service are excluded — you cannot send a schedule for a truck that should not run. Restore the truck in Trucks & Crews to make it selectable." },
      { q: "Why does the SMS button say Coming Soon?", a: "Direct outbound SMS from the platform is not enabled yet. Use Copy Daily Schedule and paste into your messenger, or use Email Schedule." },
      { q: "Can I send tomorrow's schedule today?", a: "Yes. The date picker covers the entire scheduling window (about 13 months out). Crews receive whatever is on the board for that date at the moment you send." },
    ],
  },

  "/crew-checklist": {
    title: "Pre-Trip Inspection",
    description: "Daily Georgia DPH vehicle and equipment check, required before patient contact.",
    questions: [
      { q: "What is this page for?", a: "Your daily pre-trip inspection for the truck you are crewed on today. Mark each item OK or Missing and submit. The record is kept for compliance audits." },
      { q: "Do I have to do it every day?", a: "Yes, once per truck per day. Switching trucks mid-day means the new truck needs its own inspection. Your dispatcher sees a red badge on the Checklist tab until it is submitted." },
      { q: "What if I mark something Missing?", a: "Add a short note describing what is missing or broken. The inspection still submits, but dispatch is alerted and the item shows in the Vehicle Inspections compliance log. Severely missing items may block runs until they are fixed." },
      { q: "Why is the checklist locked?", a: "You are not currently crewed on a truck for today, or your admin has not enabled the inspection for your truck. Talk to dispatch — assignment is set in Trucks & Crews." },
      { q: "Can I redo today's inspection?", a: "No. Once submitted the record is final for audit reasons. If something changed mid-shift, file it as an Incident Report from the dashboard." },
    ],
  },

  "/pcr": {
    title: "Patient Care Report (PCR)",
    description: "Document the transport: times, vitals, assessments, signatures, narrative.",
    questions: [
      { q: "What is this page for?", a: "The patient care report for a single run. Fill in times, vitals, assessment, equipment used, signatures, and narrative. When complete and signed it locks and the trip moves to billing." },
      { q: "How is it laid out?", a: "A vertical stack of cards. The cards shown depend on the transport type and payer for this run — only what is relevant for this trip appears, so you fill in less. Each card has a completion badge; locked cards show the LockedSectionOverlay until their preconditions are met (e.g. pre-contact lock lifts at At Patient time)." },
      { q: "Why are some sections greyed out?", a: "Cards are turned on or off by transport type (dialysis, IFT, emergency, etc.) and payer. Anything that does not apply is hidden so you only see what you need." },
      { q: "Why is a field showing red?", a: "Red means required for this transport/payer and still empty. Pre-Submit will block submission until every required field is filled and timestamps are in order." },
      { q: "What is the Kickback Checklist?", a: "Ten quick checks for the things that most often cause denials. Fix them here instead of getting the kickback from the payer later." },
      { q: "What is the Vehicle / Unit field?", a: "Pre-filled with your truck name when the PCR opens. You can edit it but it should match the truck in the system so the narrative and inspection record line up." },
      { q: "Why is At Destination locked?", a: "You have to record at least one set of vitals before At Destination unlocks. This is the documentation gate that makes sure the trip was properly assessed." },
      { q: "How do signatures work?", a: "Each crew member on the truck signs their own crew signature, then you collect a patient or representative signature. Refusal-to-Sign and Partner Sign Here modals appear automatically when required by payer rules." },
      { q: "What does the Cancellation button do?", a: "If the transport did not happen (no-show, refusal, sent on another vehicle), open the cancellation form. Pick the reason, capture documentation, and the trip is closed out instead of needing a full PCR." },
      { q: "Can I correct a PCR after submission?", a: "Only admins can re-open a submitted PCR. They use the targeted PCR Correction workflow, which requires a reason and is fully audit-logged." },
    ],
  },

  "/crew/:token": {
    title: "Daily Run Sheet (Share Link)",
    description: "Read-only daily run list opened via share link — used by crew on a personal device.",
    questions: [
      { q: "What is this page for?", a: "Same daily run sheet as the Crew Dashboard, opened from a one-day share link your dispatcher sent. Use it when you are not logged in to your full crew account." },
      { q: "Can I tap times and open a PCR?", a: "Yes. The share link supports the same time taps, alerts, and PCR access as the logged-in Crew Dashboard. It is scoped to one truck for one day." },
      { q: "The link says expired — what now?", a: "Share links are issued per day. Ask dispatch for today's link, or sign in to your crew account at the login page." },
    ],
  },

  "/facilities": {
    title: "Facilities",
    description: "Directory of every dialysis center, hospital, SNF, and other pickup/dropoff site.",
    questions: [
      { q: "What is this page for?", a: "Your facility directory. Every dialysis center, hospital, SNF, ALF, clinic, or residence you pick up from or drop off at. Patients and runs reference these records, so keeping them up to date keeps addresses, contacts, and contracted rates consistent everywhere." },
      { q: "What facility types are supported?", a: "Six standard types: Dialysis (with Hospital-based G / Freestanding J / Unknown D subtypes), Hospital, SNF / Nursing facility, Outpatient Specialty, Assisted Living, and Private Residence. Each carries its own clinical and financial metadata that flows into scheduling and billing." },
      { q: "What does the patient count column show?", a: "How many patient records currently use this facility as their dropoff or treatment site. Use it to spot unused facilities before deleting." },
      { q: "What are the contract payer type and rate type?", a: "If the facility pays you directly under a contract (rather than billing Medicare/Medicaid per patient), set the contract payer and rate type here. These drive which rate is applied on the Charge Master when claims are generated for runs to this facility. Invoice preference (Per Trip / Weekly / Monthly) controls how often facility invoices are produced." },
      { q: "How do I deactivate a facility?", a: "Edit it and toggle Active off. Inactive facilities are hidden from new patient assignments and run creation, but historical trips and patient records that reference them are preserved." },
      { q: "Can I delete a facility?", a: "Yes, using the trash icon and a destructive confirm. Facilities still referenced by active patients should be deactivated, not deleted, to keep historical records intact." },
    ],
  },

  "/migration": {
    title: "Migration & Import",
    description: "Bring legacy data (patients, trips, trucks, employees) from your old system into PodDispatch.",
    questions: [
      { q: "What is this page for?", a: "The migration hub for moving off your old dispatch or billing system. Bulk-import data from CSV, run a guided quick-start, operate in parallel-run mode while you cut over, and review every past import." },
      { q: "What are the tabs?", a: "Four: Import Data, Quick Start, Parallel Run, and Import History." },
      { q: "What is the Import Data tab?", a: "Upload a CSV, map its columns to PodDispatch fields, preview with duplicate and data-quality warnings, then commit. Each import is logged so you can see what was added, skipped, and flagged. A Start-Forward Mode banner appears once you're ready to dispatch, with a Go to Dispatch button." },
      { q: "What is the Quick Start wizard?", a: "A guided flow for new companies that walks you through importing the minimum data needed to start dispatching — patients, trucks, and crew — in the recommended order." },
      { q: "What is Parallel Run Mode?", a: "Use this while you are still running your old system alongside PodDispatch. Periodically import recent trip data so you can compare PodDispatch output (claims, reports) against your old system before fully cutting over." },
      { q: "How does duplicate detection work?", a: "On patient imports the system matches first + last name against existing patients (case-insensitive, with partial-match warnings). Likely duplicates are surfaced in the preview so you can skip them or import anyway." },
      { q: "Where do I see past imports?", a: "The Import History tab lists every import run for your company: file name, data type, row counts, errors, and who performed it. Use it as an audit trail and to re-download error reports." },
    ],
  },

  "/onboarding": {
    title: "Onboarding Wizard",
    description: "Six-step guided setup that gets your company ready to dispatch and bill.",
    questions: [
      { q: "What is this page for?", a: "The 6-step wizard that walks a new company from sign-up to a working dispatch and billing operation. It tracks progress on company info, charge master rates, clearinghouse connection, trucks, crew, and first patient." },
      { q: "What are the six steps?", a: "1. Company Info Verified, 2. Rates Verified, 3. Clearinghouse Connected, 4. Trucks Added, 5. Team Invited, 6. Patients Added. Steps are sequential — you cannot open step N until everything prior is complete." },
      { q: "Why is the company info step locked here?", a: "Company identity fields (legal name, NPI, EIN, billing address) are captured at signup and only Owners can change them in production, with every change logged. This step just confirms what was captured so you can fix it before going live." },
      { q: "What does verifying my rates mean?", a: "Setting a base rate and a per-mile rate for each payer you plan to bill, in the Charge Master tab of Billing & Claims. At least one payer must have both values greater than $0 before the step completes — otherwise generated claims have $0 amounts." },
      { q: "Do I have to connect a clearinghouse to use PodDispatch?", a: "No. You can dispatch and document trips without it. But to electronically submit 837P claims and import 835 payments and 999 acknowledgements automatically you need to connect Office Ally. Until then you can still export 837P files manually and upload them to your clearinghouse portal." },
      { q: "Can I skip steps and come back?", a: "Each step records its own completion flag and the wizard resumes wherever you left off. The Onboarding Checklist at the top of admin pages also nudges you to finish until everything is done." },
      { q: "What happens when all six steps are done?", a: "The wizard congratulates you and the persistent checklist disappears from admin pages. This page becomes informational from then on — revisit any time, but it stops nudging." },
    ],
  },

  "/account": {
    title: "Account Settings",
    description: "Your personal account: email, password, two-factor authentication, replay tours.",
    questions: [
      { q: "What is this page for?", a: "Settings for your individual account (not your company). Change your login email, change your password, enable two-factor authentication, and replay any of the product tours." },
      { q: "How do I change my login email?", a: "Type the new address in the Change Email card and click Update Email. A confirmation link is sent to the new address; the change takes effect after you click it." },
      { q: "How do I change my password?", a: "Type a new password (8 characters minimum) in both fields of the Change Password card, then Update Password. You stay logged in on this device; other sessions are kept open." },
      { q: "What is the Two-Factor Authentication section?", a: "Set up an authenticator app (Google Authenticator, 1Password, Authy, etc.) to require a 6-digit code at login. Strongly recommended for any account with PHI access." },
      { q: "What is Replay Tours?", a: "List of every guided tour for your role. Click Replay on any one to walk through the page again. Useful when you onboard a new dispatcher or biller and want to give them a quick refresher." },
      { q: "Where do I change company settings (not personal)?", a: "Company Settings is a separate page at /settings (Admin → Settings in the sidebar). This page only changes things about you." },
    ],
  },

  "/admin/email-activity": {
    title: "Email & Call Activity",
    description: "Log of every transactional email and automated call PodDispatch has sent on your behalf.",
    questions: [
      { q: "What is this page for?", a: "The deliverability log for every transactional email and automated call the platform sends out on your behalf — employee invites, password resets, schedule emails, facility confirmation calls, support replies, system notifications." },
      { q: "What are the tabs?", a: "Two: Emails and Calls. Emails shows the outbound email log (to, subject, status, timestamp). Calls shows the outbound call log (to, status, duration)." },
      { q: "What do the email status values mean?", a: "Pending = handed off to the provider, not yet confirmed. Sent = accepted and delivered by the provider. Failed = the provider rejected it (error shown in the row). Bounced = the recipient's mail server rejected it after delivery. Suppressed = the address is on the do-not-send list (typically after repeated bounces or complaints)." },
      { q: "Why didn't my crew member get their invite?", a: "Filter by their email and look at the most recent row. Sent but missing → ask them to check spam and confirm the address. Bounced or Failed → the error explains why (bad address, full mailbox, blocked by their domain). Resend from the Employees page after fixing it." },
      { q: "What is the Resend ID?", a: "The unique tracking ID our email provider returned for that send. Mainly useful for support — paste it into a ticket and we can look up the full delivery trail." },
      { q: "How far back does the log go?", a: "Date-range filter spans the last 24 hours, 7 days, 30 days, or 90 days. Older entries are retained but not shown by default. Results are capped at the most recent 500 rows per filter to keep the page fast; narrow the filter if you need older results." },
      { q: "Why do I see a Company column?", a: "Only system creators see the Company column and the company filter; they view email and call activity across every company on the platform. Company users only see their own company's activity." },
    ],
  },

  "/override-monitor": {
    title: "Override Monitor",
    description: "Audit trail of every safety override and billing override anyone in your company approved.",
    questions: [
      { q: "What is this page for?", a: "The audit dashboard for any override approved in your company — safety overrides during scheduling and billing overrides during claim work. Every override has a typed reason, a user, a timestamp, and a role on record." },
      { q: "What are the tabs?", a: "Two: Safety and Billing. Safety lists scheduling and dispatch overrides (bariatric-equipment mismatch, crew certification, etc.). Billing lists claim-side overrides (forced submit, payer-rule bypass, modifier overrides), enriched with patient, truck, and run date so you can find the trip quickly." },
      { q: "What filters are available?", a: "Date range (from/to) and a simulation filter (All / Live Only / Simulated Only) so test data from the Simulation Lab does not pollute your real audit view." },
      { q: "What should I be looking for?", a: "Repeats. One user or one truck showing up over and over is a coaching opportunity. Repeated bariatric-equipment overrides usually mean the fleet is misconfigured, not that the rule is wrong. Repeated payer-rule bypasses usually mean a documentation gap upstream." },
      { q: "Can I undo an override from here?", a: "No. Overrides are historical records. Fix the root cause (equipment, certification, documentation) on the source page and future runs will not need the override." },
      { q: "Why does this matter?", a: "Overrides exist so the system never blocks a real emergency, but every override is a documented decision an auditor or attorney can ask about. Reviewing weekly keeps audits routine instead of stressful." },
    ],
  },

  "/remittance-import": {
    title: "Remittance Import (835)",
    description: "Import payer ERA / 835 files, auto-post payments, translate denials, quarantine mismatches.",
    questions: [
      { q: "What is this page for?", a: "Where the 835 electronic remittance advice files from your clearinghouse get imported. The parser reads each claim line, matches it to an existing claim in PodDispatch, posts the payment, translates the denial codes, and flags any secondary insurance opportunities." },
      { q: "How do I import a file?", a: "Drag and drop the 835 file (or paste the raw text) into the upload area. The parser runs immediately and shows you a per-line preview with match status before anything posts." },
      { q: "What is in the Remittance Activity panel?", a: "Live feed of what just imported — payments posted, partial pays, denials, secondary opportunities created. Use it to spot anything that needs immediate follow-up." },
      { q: "What is in the Remittance History panel?", a: "Every prior 835 you have imported with filename, date, payer, total paid, line count, and links into the matched claims. Your audit trail and your cash-application source of truth." },
      { q: "What happens if a line cannot be matched?", a: "It is quarantined for the system creator to investigate — never auto-posted to the wrong claim. Quarantine usually means an NPI mismatch (claim sent under the wrong NPI) or a CLP01 claim ID we have not seen before. Creator review unblocks it." },
      { q: "What if the file is rejected entirely?", a: "The parser shows the line and the reason (corrupt envelope, unsupported version, missing CLP segments). Re-pull the file from your clearinghouse and try again, or contact support with the file." },
    ],
  },

  "/edi-export": {
    title: "EDI Export (837P)",
    description: "Generate the standardized 837P electronic claim file for manual upload to your clearinghouse.",
    questions: [
      { q: "What is this page for?", a: "Manual generation of the 837P EDI file — the standardized X12 claim format Medicare, Medicaid, and commercial payers require. Use this when you have not connected an automated clearinghouse, or when you need to regenerate a batch." },
      { q: "How is the page laid out?", a: "Two info forms at the top — Provider Info (NPI, Tax ID, organisation name and address) and Submitter Info (submitter ID, contact name, contact phone). Below that is the claim selector and the Generate / Download 837P buttons." },
      { q: "Where do the provider fields come from?", a: "They are pre-filled from your company record (set during signup and editable by Owners only). Verify them every time you generate — bad NPI or tax ID is the most common reason a clearinghouse rejects an entire file." },
      { q: "What is the submitter ID?", a: "The trading partner ID your clearinghouse assigned you. Office Ally provides this in your trading partner agreement. Required on every 837P." },
      { q: "Which claims appear in the selector?", a: "Claims that have passed the Pre-Submit checklist and are marked ready for export but have not yet been submitted electronically. Submitted-and-paid claims are excluded." },
      { q: "What do I do with the downloaded file?", a: "Upload it to your clearinghouse's portal exactly as downloaded. Do not edit it — even invisible whitespace changes can cause rejections. After upload, watch for the 999 acknowledgement and the 277CA status response from the clearinghouse." },
      { q: "Why is the page hidden from the sidebar?", a: "Most companies connect Office Ally and submit automatically from the Billing & Claims page. EDI Export is a fallback for manual or batch workflows. Bookmark /edi-export to keep it handy." },
    ],
  },

  "/system": {
    title: "System Creator Dashboard",
    description: "Global oversight of every tenant: health, subscription, metrics, support.",
    questions: [
      { q: "What is this page for?", a: "The creator-only command centre for the whole platform. Every tenant company shows here with verification status, subscription health, and operational signals so you can spot issues before tenants do." },
      { q: "What are the tabs?", a: "Two: Overview and Metrics. Overview is the live health summary across every tenant. Metrics is the aggregate SaaS view (active companies, MRR, churn, claim throughput across all tenants combined)." },
      { q: "What is on Overview?", a: "Per-tenant health cards: subscription status, NPI/OIG verification status, last-active timestamp, open support tickets, override count, recent denials trend. Click into any tenant to open its Creator Console detail page." },
      { q: "What is on Metrics?", a: "Platform-wide SaaS metrics — active tenants, MRR, ARR, trial conversion, churn, total claims submitted, total dollars processed, p95 latency on the critical paths. Source of truth for board reporting." },
      { q: "Where do I work tenants directly?", a: "Creator Console (left nav). System Dashboard is read-only oversight; Creator Console is where you approve, suspend, archive, or delete tenants and where you investigate billing pipeline anomalies." },
    ],
  },

  "/creator-console": {
    title: "Creator Console",
    description: "Tenant lifecycle, billing pipeline monitoring, support, load testing, system health.",
    questions: [
      { q: "What is this page for?", a: "Creator-only management of every tenant on the platform — approvals, suspensions, archiving, deletions — plus the operational dashboards for the billing pipeline (remittance quarantine, reconciliation, acknowledgements) and platform health (support, load test, system health)." },
      { q: "What are the tabs?", a: "Twelve: Pending, Active, Awaiting Payment, Suspended, Rejected, Archived, Remittance Quarantine, Reconciliation, Acknowledgments, Support, Load Test, System Health. Counts in the badges show how many items each tab currently has." },
      { q: "What can I do on the company-list tabs (Pending → Archived)?", a: "Approve a tenant, Reject with a typed reason, Suspend with a reason plus an OVERRIDE confirmation string, Archive with a company-name confirmation, or Delete (bulk) with a DELETE confirmation. Bulk select supports bulk suspend and bulk delete. Inline edit lets you rename a company; search filters by name or owner email." },
      { q: "What is the Remittance Quarantine tab?", a: "835 lines that the parser could not auto-post because the NPI did not match or the CLP01 claim ID is unknown. You review each one, re-route to the correct tenant/claim, and release it back into posting. Nothing in quarantine ever auto-posts to the wrong claim." },
      { q: "What is the Reconciliation tab?", a: "End-of-day reconciliation between what tenants believe they posted and what the clearinghouse confirms was received. Variances are flagged for investigation." },
      { q: "What is the Acknowledgments tab?", a: "999 functional acknowledgements and 277CA status responses from clearinghouses, parsed and shown per tenant. Use it to confirm submissions landed and to chase tenants whose files were rejected at the envelope level." },
      { q: "What is the Support tab?", a: "Open tenant support tickets with timestamp, priority, and the 24-hour response guarantee timer. Reply directly from the panel — replies flow through Email Activity." },
      { q: "What is the Load Test tab?", a: "Harness for running synthetic load against the platform. Use only in coordination with on-call so alerts are silenced." },
      { q: "What is the System Health tab?", a: "Real-time health signals: edge function error rates, p95 latency on critical paths, DB connection pool, background job queues. The first place to check during an incident." },
    ],
  },

  "/creator-settings": {
    title: "Creator Settings",
    description: "Creator-only configuration: push settings to companies, reset tenant data, set CAC value.",
    questions: [
      { q: "What is this page for?", a: "Creator-only platform configuration. Most of what is here is destructive or scoped to a single tenant on purpose — read each section before clicking anything." },
      { q: "What does the target company selector do?", a: "Scopes the action below it to a specific tenant. Many of the actions here are per-company (push a setting, reset data) and the selector locks the target so you cannot accidentally hit the wrong tenant." },
      { q: "What does the Reset tool do?", a: "Wipes operational data (patients, trips, claims, schedules, etc.) for the selected company. Subscription, users, and company identity are preserved. Requires typing the company name exactly to confirm — there is no undo." },
      { q: "What is the CAC value field?", a: "Customer acquisition cost used in the SaaS metrics computations. Update it when your blended CAC changes; the System Dashboard Metrics tab picks it up automatically." },
      { q: "Why is everything here gated?", a: "Every action on this page either changes a tenant's data or affects platform-wide math. The gates exist so a slipped click cannot do real damage." },
    ],
  },

  "/creator-playbook": {
    title: "Creator Playbook",
    description: "Internal reference library: runbooks, decision trees, escalation paths, copy templates.",
    questions: [
      { q: "What is this page for?", a: "The internal knowledge base for the platform team. Runbooks for common incidents, decision trees for tenant requests, escalation paths, and the copy templates you reuse in support replies." },
      { q: "What are the tabs?", a: "An All tab plus one tab per playbook category (categories are generated dynamically from the entries themselves)." },
      { q: "Can I add or edit playbooks?", a: "Yes. Use the create/edit/delete actions on each entry. Content supports rich text or markdown, whichever the entry uses." },
      { q: "What goes in here vs. in support tickets?", a: "Playbooks are reusable — how to respond to common asks, how to investigate common issues, how to escalate. Support tickets are the per-tenant conversation. If you find yourself writing the same answer twice, promote it into a playbook." },
    ],
  },

  "/simulation-lab": {
    title: "Simulation Lab",
    description: "Sandbox for seeding scenarios and stress-testing dispatch without touching real PHI.",
    questions: [
      { q: "What is this page for?", a: "Creator-only sandbox for exercising the platform with synthetic data. Seed standard scenarios, inject live chaos events to stress the dispatch board, capture snapshots, and validate the billing and scheduling pipelines — all without affecting real tenant PHI." },
      { q: "How is the page laid out?", a: "Status cards at the top (Trucks, Patients, Trips, Crews, Runs counts in the simulation tenant). Then preconditions check, Seed Size selector (Small / Medium / Large), Standard Scenarios section, Live Chaos Events section, Snapshots card, pipeline validation panels, and destructive wipe cards at the bottom." },
      { q: "What is the difference between Standard Scenarios and Live Chaos Events?", a: "Standard Scenarios seed a whole day's worth of synthetic data from scratch (Dialysis Heavy Day, Dialysis + Discharge Mix, Late Adds + Cancellations, Billing Risk Day, Facility Delay Day). Live Chaos Events inject pressure into the data that is already there — Facility Behind, Crew Slow, Patient Not Ready, Late Add Discharge, Cancel/No-Show, Truck Down, Cascade Pressure." },
      { q: "What do snapshots do?", a: "Save the entire simulation state under a name so you can come back to that exact starting point later. Useful for demoing the same scenario repeatedly, or for comparing how the system behaves before and after a code change." },
      { q: "What do the validation panels show?", a: "After running a scenario, the schedule validator confirms feasibility math, safety enforcement, and copy-forward integrity. The pipeline validator confirms PCRs flow into Trips and Trips flow into clean Claims with the right amounts. Anything red is a regression worth investigating." },
      { q: "Will simulated data show up in real metrics?", a: "No. Simulation runs are tagged at the row level and the Override Monitor, reports, and creator dashboards all filter them out by default. The Override Monitor exposes an explicit Simulated Only filter if you want to look at just simulated overrides." },
      { q: "How do I clean up?", a: "Use the wipe cards at the bottom of the page. Each is destructive and requires a confirmation — start with the targeted ones (wipe trips, wipe patients) and only use the full wipe if you really want a clean slate." },
    ],
  },
};

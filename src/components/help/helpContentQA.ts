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
      { q: "What do the alert colors mean?", a: "Green alerts are informational and auto-dismiss. Yellow alerts require attention but are not urgent. Red alerts require dispatcher acknowledgment before they clear — these include missing crew inspections and flagged safety issues." },
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
      { q: "What do the alert colors mean?", a: "Green alerts are informational and auto-dismiss. Yellow alerts require attention but are not urgent. Red alerts require dispatcher acknowledgment before they clear — these include missing crew inspections and flagged safety issues." },
      { q: "How do I handle a cancellation?", a: "Cancelled runs appear in the Pending Cancellation panel. You must resolve each cancellation by either confirming it or reassigning the run before it clears from the board." },
    ],
  },

  "/scheduling": {
    title: "Patient Runs & Scheduling",
    description: "Build each day by assigning patients to trucks before dispatch takes over.",
    questions: [
      { q: "What is this page for?", a: "This is where you build the day before it starts. You assign patients to trucks by dragging runs from the pool into the truck builder. Once the day is built the Dispatch Command manages it live." },
      { q: "How do I assign a run to a truck?", a: "Drag any run card from the Run Pool on the left into a truck column in the Truck Builder on the right. You can also reorder runs within a truck by dragging them up or down." },
      { q: "What is the Run Pool?", a: "The Run Pool shows all unassigned runs for the selected day. Runs are automatically generated for recurring patients — dialysis patients on their scheduled days, outpatient patients on their appointment days. You can also add one-off runs manually using Add Leg on a truck." },
      { q: "What does Auto-Fill do?", a: "Auto-Fill generates A and B legs from your recurring patient schedules for the selected date and places them all in the unassigned pool. Use it each morning to populate the day then assign runs to trucks." },
      { q: "Why is a run showing as unsafe?", a: "The safety check compares what the patient needs — bariatric stretcher, oxygen, stair chair — against what the assigned truck has. If the truck is missing required equipment the run shows as unsafe." },
      { q: "How do I assign crew to a truck?", a: "Crew assignment happens on the Dispatch Command page. Changes made there will update this page automatically within a few seconds." },
    ],
  },

  "/trips": {
    title: "Trips & Clinical",
    description: "Complete trip records with documentation status, mileage, billing readiness, and PCR state.",
    questions: [
      { q: "What is this page for?", a: "This is your complete trip record. Every completed run appears here with its documentation status, mileage, billing readiness, and PCR completion state." },
      { q: "How do I move a trip to billing?", a: "A trip moves to billing automatically when the crew submits their PCR and all required documentation is complete. You can also manually move it using the Ready for Billing button on the trip row if you have resolved all blockers." },
      { q: "What does the Clean badge mean?", a: "Clean means the trip has all required documentation and is ready to generate a clean claim in Billing and Claims. Blocked means something is missing — click the trip to see what needs to be fixed." },
      { q: "How do I view the PCR for a trip?", a: "Click the Edit button on any trip row to open the trip detail panel. From there you can view all PCR fields, timestamps, vitals, signatures, and uploaded documents." },
      { q: "What does the status history show?", a: "The status history in the trip detail panel shows every status change the trip went through — who made the change, when, and what it changed from and to. This is your audit trail." },
      { q: "Can I export trip records?", a: "Yes. Use the Export CSV button at the top of the page to download all visible trips based on your current filters." },
    ],
  },

  "/billing": {
    title: "Billing & Claims",
    description: "Turn completed trips into paid claims — review, submit, and track payments.",
    questions: [
      { q: "What is this page for?", a: "This is where completed trips become paid claims. You review documentation, fix any issues, submit claims to your clearinghouse, and track what has been paid and what has been denied." },
      { q: "How do I get trips into the billing queue?", a: "Click Sync from Trips at the top of the page. This pulls in all completed trips that have a submitted PCR and creates claim records for them." },
      { q: "What does Blocked mean on a claim?", a: "Blocked means the claim cannot be submitted yet because required information is missing. Each blocked claim shows a plain English explanation of exactly what is missing and a Fix button that takes you to the right place to resolve it." },
      { q: "How do I submit a claim?", a: "First make sure the claim is in the Billing Ready column. Then click Pre-Submit to run the 8-point checklist. If all checks pass the Submit button appears. After submitting use the 837P Export button to generate the EDI file for your clearinghouse." },
      { q: "What is the 837P Export?", a: "The 837P is the standardized electronic file that clearinghouses like Office Ally require to submit claims to Medicare and Medicaid. Generate this file and upload it to your clearinghouse portal." },
      { q: "What is the 835 Import?", a: "When your clearinghouse sends back a payment response file called an 835 you import it here. The system reads it automatically, updates your claim statuses, translates any denial codes into plain English, and flags any secondary insurance opportunities." },
      { q: "What does a denial code mean?", a: "Every denial code is translated into plain English in the claim detail view. For example CO-45 means Medicare reduced the charge to their allowed rate — no action needed. CO-16 means the claim is missing required information — you need to fix the documentation and resubmit." },
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
      { q: "What are payer rules?", a: "Payer rules define what documentation is required for each payer type — Medicare, Medicaid, facility contracts, and cash. These rules drive the billing gate checks and the required field indicators in the PCR." },
    ],
  },

  "/patients": {
    title: "Patients",
    description: "Patient directory — every patient your company transports should have a record here.",
    questions: [
      { q: "What is this page for?", a: "This is your patient directory. Every patient your company transports should have a record here before they are scheduled for a run." },
      { q: "What information do I need to add a patient?", a: "At minimum you need first name, last name, date of birth, pickup address, and primary insurance payer. Member ID and mobility level are strongly recommended for billing and scheduling." },
      { q: "What is PCS on File?", a: "PCS stands for Physician Certification Statement. Medicare requires an active PCS for recurring non-emergency transport like dialysis. Toggle this on when you have a signed PCS from the patient's physician and upload the document in the Documents section." },
      { q: "What is a Standing Order?", a: "A standing order means the physician has authorized recurring transport for this patient on a regular schedule. This simplifies scheduling for dialysis and other recurring patients." },
      { q: "Where do I upload patient documents?", a: "Use the Documents section at the bottom of the patient record. You can upload PCS forms, DNR orders, prior authorizations, and insurance cards. These documents are available to billers and are referenced during PCR documentation." },
      { q: "What does the Special Equipment field mean?", a: "Special Equipment flags what the patient requires for safe transport — Bariatric Stretcher, Extra Crew, Lift Assist, or Other. This information is used by the scheduling safety check to make sure the assigned truck has the right equipment." },
    ],
  },

  "/employees": {
    title: "Employees",
    description: "Manage your team — add employees, assign roles, and control access.",
    questions: [
      { q: "What is this page for?", a: "This is where you manage your team. Add employees, assign roles, and control who has access to what in PodDispatch." },
      { q: "What roles are available?", a: "Owner has full access to everything. Dispatcher manages the dispatch board and scheduling. Billing manages claims and billing workflows. Crew accesses only the crew UI for their assigned runs and PCR documentation." },
      { q: "How do I add a new employee?", a: "Click Add Employee and fill in their name, email, phone, role, and certification level. They will receive an invitation email with a link to set their password and access the system." },
      { q: "A crew member forgot their password — how do I help them?", a: "Click the Reset Password button next to their name on the employee list. This sends a password reset email to their registered address. The email contains a link they click to set a new password." },
      { q: "Can I see what email a crew member uses to log in?", a: "Yes. The Email column on the employee list shows the email address for every employee. This is the address they use to log in and where system notifications are sent." },
      { q: "How do I deactivate an employee who has left?", a: "Click the edit icon next to their name and change their status to Inactive. They will immediately lose access to the system. Their historical records are preserved." },
    ],
  },

  "/reports": {
    title: "Reports & Metrics",
    description: "Operational and financial performance summary — check weekly for insights.",
    questions: [
      { q: "What is this page for?", a: "This is your operational and financial performance summary. Check it weekly to understand trip volume, billing completion, on-time performance, and accounts receivable aging." },
      { q: "What does Billing Complete Rate mean?", a: "Billing Complete Rate is the percentage of completed trips that have a clean submitted claim. A low rate means trips are completing but documentation or billing issues are preventing claims from being submitted." },
      { q: "What does Late Pickup Rate mean?", a: "Late Pickup Rate is the percentage of runs where the crew arrived more than 15 minutes after the scheduled pickup time. A high rate may indicate scheduling or routing problems." },
      { q: "What is AR Aging?", a: "AR Aging shows how long submitted claims have been waiting for payment broken into buckets — 0 to 30 days, 31 to 60 days, 61 to 90 days, and over 90 days. Claims sitting over 60 days should be followed up with the payer." },
      { q: "What does Utilization mean?", a: "Utilization is the percentage of scheduled capacity that was actually used. A truck scheduled for 8 runs that completed 6 runs has 75 percent utilization. Low utilization means trucks are being underused." },
    ],
  },

  "/owner-dashboard": {
    title: "Owner Command Center",
    description: "30-second business health check — see immediately if anything needs attention.",
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
    description: "Configure your fleet — set equipment flags and inspection checklists.",
    questions: [
      { q: "What is this page for?", a: "This is where you configure your fleet. Set equipment flags on each truck so the scheduling safety check knows what each truck can handle. Configure the pre-trip inspection checklist for each truck here." },
      { q: "What equipment flags should I set?", a: "Set Bariatric Stretcher if the truck has a bariatric-rated stretcher. This is the most important flag because it determines whether bariatric patients can be assigned to that truck. Other equipment is verified through the daily pre-trip inspection checklist." },
      { q: "What is the vehicle inspection configuration?", a: "Each truck has an inspection template where you choose which items from the Georgia DPH checklist crew must verify before each shift. You can also toggle the gate that requires inspection completion before crew can access any PCR for that truck." },
      { q: "How do I assign crew to a truck?", a: "Crew assignment for a specific day happens on the Dispatch Command page or the Patient Runs and Scheduling page. The Trucks and Crews page is for permanent fleet configuration not daily crew assignment." },
      { q: "What does gate enabled mean on the inspection?", a: "When gate is enabled crew cannot open any PCR for that truck until they have submitted their pre-trip inspection for the day. This enforces compliance and ensures equipment is verified before patient contact." },
    ],
  },

  "/settings": {
    title: "Settings",
    description: "Company operational settings and clearinghouse integration configuration.",
    questions: [
      { q: "What is this page for?", a: "This is where you configure operational parameters like grace windows, service time defaults, session security, and data retention. The Clearinghouse tab lets you connect to Office Ally for automated claim submission and payment retrieval." },
      { q: "How do I connect to Office Ally?", a: "Go to the Clearinghouse tab and follow the four-step setup wizard. You will create an Office Ally account, enter your Office Ally login credentials, configure folder paths, and enable automatic processing." },
      { q: "What does the session timeout do?", a: "The session timeout automatically logs users out after 30 minutes of inactivity with a 5-minute warning. This is a HIPAA compliance requirement. Disabling it is not recommended." },
      { q: "What is the data retention policy?", a: "This documents your company's commitment to retaining trip records, PCR data, and billing documents. Medicare requires a minimum 7-year retention period. No records are automatically deleted." },
      { q: "What are system limits?", a: "System limits show the maximum number of admins, crews, trucks, and runs per truck allowed for your deployment. The overload threshold triggers a warning when a truck has more than 8 runs assigned." },
    ],
  },
};

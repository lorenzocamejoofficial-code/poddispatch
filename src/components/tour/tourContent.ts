/**
 * Per-page guided tour content. Keyed by route path → role(s).
 *
 * Each step is a centered popup that names what to do and *where* to do
 * it on the page, framed around the bigger goal: getting claims accepted
 * and paid. Steps reference real on-screen elements by label so the user
 * can find them — no DOM coupling required (which keeps the tour stable
 * as the UI evolves).
 *
 * Tours auto-fire on first visit per (user_id, page_key) via PageTour.
 * Users can replay any tour from Account Settings → "Replay product tour".
 */

export type TourRole = "owner" | "creator" | "manager" | "dispatcher" | "biller" | "crew";

export type TourStep = {
  title: string;
  body: string;
  /** Optional pointer to a UI element label, e.g. "the Add Patient button (top right)". */
  lookFor?: string;
};

export type PageTour = {
  pageKey: string;          // stable id used in user_tour_progress
  route: string;            // pathname this tour fires on
  roles: TourRole[];        // who sees it
  pageName: string;
  goal: string;             // one-line "why this page matters for getting paid"
  steps: TourStep[];
};

export const PAGE_TOURS: PageTour[] = [
  {
    pageKey: "patients",
    route: "/patients",
    roles: ["owner", "creator", "manager", "dispatcher", "biller"],
    pageName: "Patients",
    goal: "Every clean claim starts with a complete patient record. Bad demographics or missing insurance is the #1 reason claims get denied.",
    steps: [
      {
        title: "Step 1 — Discover their coverage first",
        body: "Before you add a new patient, click Discover Coverage. Enter just their name + DOB and we'll search Office Ally for every active policy (Medicare, Medicaid, commercial, etc.) sorted in Coordination of Benefits order.",
        lookFor: "the Discover Coverage button (top right of the page)",
      },
      {
        title: "Step 2 — Promote policies into slots",
        body: "From the discovery results, click Use as Primary / Secondary / Tertiary on each policy. If we already have a matching patient by name + DOB, we'll update them. Otherwise it pre-fills the Add Patient form.",
      },
      {
        title: "Step 3 — Verify what you already have",
        body: "For an existing patient with known insurance, click Verify Insurance to do a real-time eligibility check. Inactive coverage = denied claim, so always verify before scheduling.",
        lookFor: "the Verify Insurance button (next to Discover)",
      },
      {
        title: "Step 4 — Add or finish the patient record",
        body: "Fill in pickup address, dropoff facility, mobility, weight, PCS doc, and transport schedule. Anything missing here will show as a red blocker on the claim later.",
        lookFor: "the Add Patient button",
      },
      {
        title: "Why this matters",
        body: "Patients with verified active coverage, a valid PCS on file, complete demographics, and the right ICD-10 codes default to a high Claim Probability Score — meaning first-pass acceptance and faster payment.",
      },
    ],
  },
  {
    pageKey: "dispatch",
    route: "/dispatch",
    roles: ["owner", "creator", "manager", "dispatcher"],
    pageName: "Dispatch Board",
    goal: "The Dispatch Board turns scheduled runs into completed, billable trips. Every hold timer that doesn't get resolved is wait time you can't bill for.",
    steps: [
      {
        title: "Step 1 — Watch the truck cards",
        body: "Each truck card shows its current run, safety badge, hold timers, and crew. Red badges mean a blocker (bariatric without power stretcher, MF/FF crew on a bariatric, etc.) — fix those before dispatch.",
      },
      {
        title: "Step 2 — Resolve hold timers",
        body: "When a truck is waiting (at scene, at destination, etc.), a hold timer starts. Crews stop it by tapping the next timestamp in their PCR — those minutes become billable wait time on the claim.",
      },
      {
        title: "Step 3 — Use the Comms Outbox",
        body: "Automated facility confirmation calls queue up here. Failed calls show a red banner — re-queue or place a manual call to avoid no-show write-offs.",
      },
      {
        title: "Why this matters",
        body: "Completed PCRs from dispatch flow straight into Trips → Claims. The cleaner the dispatch day, the fewer corrections billing has to make later.",
      },
    ],
  },
  {
    pageKey: "scheduling",
    route: "/scheduling",
    roles: ["owner", "creator", "manager", "dispatcher"],
    pageName: "Scheduling",
    goal: "This is where runs get assigned to trucks. Bad assignments (safety conflicts, < 45-min gaps, inactive trucks) cascade into safety overrides and denied claims.",
    steps: [
      {
        title: "Step 1 — Drag a run onto a truck",
        body: "The system enforces a 45-minute minimum gap between runs per truck and blocks assignment to OOS or inactive trucks automatically.",
      },
      {
        title: "Step 2 — Resolve safety badges",
        body: "If you see a red Safety badge (bariatric/equipment/crew-cert mismatch), reassign or override with a reason. Overrides are logged to the Override Monitor.",
      },
      {
        title: "Step 3 — Confirm the day",
        body: "Once everything is green, dispatch goes live and crews see runs on their workspace. PCRs are auto-created when the first timestamp is tapped.",
      },
      {
        title: "Why this matters",
        body: "Clean assignments → complete PCRs → clean claims. A 45-min conflict can mean a late arrival and a wait-time write-off, so the system blocks it up front.",
      },
    ],
  },
  {
    pageKey: "trucks",
    route: "/trucks",
    roles: ["owner", "creator", "manager", "dispatcher"],
    pageName: "Trucks & Crews",
    goal: "Your fleet roster. OOS trucks can't be assigned and uninspected trucks throw alerts that block dispatch.",
    steps: [
      {
        title: "Step 1 — Add your trucks",
        body: "Each truck stores its NPI alignment, equipment flags (power stretcher, bariatric capable), and Georgia DPH inspection history.",
        lookFor: "the Add Truck button",
      },
      {
        title: "Step 2 — Run inspections",
        body: "Daily DPH inspections live here. Missed inspections create operational alerts on the Dispatch Board.",
      },
      {
        title: "Step 3 — Build crews",
        body: "Pair certified employees into crews (Driver/Attendant, or 3-member crews for bariatric). Crew certification is what gates Bariatric/ALS runs.",
      },
      {
        title: "Why this matters",
        body: "The right truck + the right crew is half of safety compliance. The other half (PCS, ICD-10, eligibility) lives on the patient and PCR.",
      },
    ],
  },
  {
    pageKey: "employees",
    route: "/employees",
    roles: ["owner", "creator", "manager"],
    pageName: "Employees",
    goal: "Your workforce roster. Roles here determine what every teammate can see and do.",
    steps: [
      {
        title: "Step 1 — Invite teammates",
        body: "Invitations are sent by email. Each invite picks one of: Owner, Dispatcher, Biller, or Crew. Max 4 admins per company.",
        lookFor: "the Invite button",
      },
      {
        title: "Step 2 — Track certifications",
        body: "EMT-B, AEMT, EMT-P, CPR, etc. Certifications expire — expired certs block crew assignment automatically.",
      },
      {
        title: "Why this matters",
        body: "A claim signed by an expired-cert crew is a compliance audit finding. The system enforces this so you don't have to police it manually.",
      },
    ],
  },
  {
    pageKey: "trips",
    route: "/trips",
    roles: ["owner", "creator", "manager", "biller"],
    pageName: "Trips & Clinical",
    goal: "Every completed run lives here as a Trip Record. Billing reviews these before they become claims.",
    steps: [
      {
        title: "Step 1 — Open the PCR",
        body: "Click into any trip to review the PCR. Vitals, narrative, signatures, medical necessity, and ICD-10 must all be present to clear the pre-submit checklist.",
      },
      {
        title: "Step 2 — Use the Kickback Checklist",
        body: "The 10-point checklist flags anything that would cause a denial. Fix the kickbacks here instead of waiting for a 277CA rejection.",
      },
      {
        title: "Step 3 — Send to claims",
        body: "Once green, the trip is ready to queue. Admins can edit trip metadata and changes sync immediately to the matching claim record.",
      },
      {
        title: "Why this matters",
        body: "The Trips page is your last chance to catch a problem before it becomes a denial. Every kickback fixed here saves a 30-day AR cycle.",
      },
    ],
  },
  {
    pageKey: "billing",
    route: "/billing",
    roles: ["owner", "creator", "manager", "biller"],
    pageName: "Billing & Claims",
    goal: "The command center for everything money: charge master, claims queue, AR follow-up, denial recovery, and missing-money detection.",
    steps: [
      {
        title: "Step 1 — Set your rates",
        body: "Open the Charge Master tab and confirm base + mileage rates for each payer type (Medicare, Medicaid, Commercial, Self-Pay, Default). Medicare is seeded from CMS automatically.",
      },
      {
        title: "Step 2 — Work the AR Command Center",
        body: "Claims are bucketed into 5 stages (Draft → Submitted → Paid/Partial → Denied → Closed). The Unified Work Queue surfaces what to touch next, prioritized by timely-filing risk.",
      },
      {
        title: "Step 3 — Handle denials",
        body: "The Denial Recovery Engine gives you a guided checklist per denial code, tracks resubmission history, and links to the payer contact directory.",
      },
      {
        title: "Step 4 — Watch the scoreboard",
        body: "Claim Probability Score (0-100) is an advisory metric for first-pass acceptance. Low scores tell you which trips need attention before submission.",
      },
      {
        title: "Why this matters",
        body: "This is where revenue lives. Every claim shipped clean = cash in 14–30 days. Every kickback = a 30–60 day rework cycle.",
      },
    ],
  },
  {
    pageKey: "remittance-import",
    route: "/remittance-import",
    roles: ["owner", "creator", "manager", "biller"],
    pageName: "Remittance Import",
    goal: "ERA/835 files from payers are imported here. Lines that pass NPI + claim-match auto-post; failures quarantine for creator review.",
    steps: [
      {
        title: "Step 1 — Upload an 835",
        body: "Drop the ERA file. The parser reads CLP01 (claim ID) and CAS adjustment codes, then matches to existing claim records.",
        lookFor: "the file upload area",
      },
      {
        title: "Step 2 — Review quarantined lines",
        body: "Lines that fail NPI verification or claim matching are held in the Remittance Quarantine for the system creator to investigate — never auto-posted to the wrong claim.",
      },
      {
        title: "Why this matters",
        body: "Auto-posting accuracy means your AR aging is real. Quarantine protects you from posting cash to the wrong place.",
      },
    ],
  },
  {
    pageKey: "reports",
    route: "/reports",
    roles: ["owner", "creator", "manager", "biller"],
    pageName: "Reports & Metrics",
    goal: "How the business is performing — operational throughput, financial health, and compliance posture.",
    steps: [
      {
        title: "Step 1 — Read the operational metrics",
        body: "Runs/day, on-time %, completion %, hold-timer breaches. These tell you whether dispatch is healthy.",
      },
      {
        title: "Step 2 — Read the financial metrics",
        body: "DSO, first-pass acceptance, denial rate, missing-money scan results. These tell you whether billing is healthy.",
      },
      {
        title: "Why this matters",
        body: "If a number is red here, drill into the source page (Trips, Billing, Dispatch) to fix the root cause.",
      },
    ],
  },
  {
    pageKey: "facilities",
    route: "/facilities",
    roles: ["owner", "creator", "manager", "dispatcher", "biller"],
    pageName: "Facilities",
    goal: "Your facility directory. Facility type drives clinical and billing defaults (e.g. SNF + dialysis = standing orders).",
    steps: [
      {
        title: "Step 1 — Add your facilities",
        body: "Six standard types: Hospital, SNF, Assisted Living, Dialysis Center, Wound Care Clinic, Physician Office. Each carries default contact + financial metadata.",
      },
      {
        title: "Why this matters",
        body: "Facility type cascades into transport defaults on the patient record, which reduces typing — and typing errors are where claims go to die.",
      },
    ],
  },
  {
    pageKey: "compliance",
    route: "/compliance",
    roles: ["owner", "creator", "manager", "biller"],
    pageName: "Compliance & QA",
    goal: "Your audit trail: HIPAA, vehicle inspections, override log, incident reports, and the QA queue.",
    steps: [
      {
        title: "Step 1 — Work the QA queue",
        body: "PCRs flagged by anomaly detection or kickback rules land here. Resolving them produces audit-defensible claims.",
      },
      {
        title: "Step 2 — Review overrides",
        body: "Every safety override or billing override is logged with reason + user. Auditors will ask for this.",
      },
      {
        title: "Why this matters",
        body: "HIPAA + DPH + payer audits all read from this page. Keep it clean and audits become routine, not emergencies.",
      },
    ],
  },
  {
    pageKey: "owner-dashboard",
    route: "/owner-dashboard",
    roles: ["owner", "creator", "manager"],
    pageName: "Owner Dashboard",
    goal: "Your 30,000-ft view: revenue, AR aging, fleet health, and the items that need owner-level attention.",
    steps: [
      {
        title: "Step 1 — Check the alerts",
        body: "Any owner-only alerts (subscription, compliance gaps, missing-money scan results) surface here first.",
      },
      {
        title: "Step 2 — Drill into anything red",
        body: "Every metric on this dashboard links to its source page so you can fix the root cause in one click.",
      },
      {
        title: "Why this matters",
        body: "If you only check one page per day, make it this one.",
      },
    ],
  },
  {
    pageKey: "crew-dashboard",
    route: "/crew-dashboard",
    roles: ["crew"],
    pageName: "Crew Workspace",
    goal: "Your shift home: today's runs, PCRs in progress, and notifications from dispatch.",
    steps: [
      {
        title: "Step 1 — Read your runs",
        body: "Today's assigned runs are listed in order. Tap one to open the PCR.",
      },
      {
        title: "Step 2 — Tap timestamps in order",
        body: "Timestamps are strictly chronological — Enroute → At Scene → Patient → At Destination → In Service. Each tap stops the matching hold timer.",
      },
      {
        title: "Step 3 — Complete the PCR before end of shift",
        body: "Vitals, signatures, narrative, and odometer readings are required. Incomplete PCRs block billing from sending the claim.",
      },
      {
        title: "Why this matters",
        body: "Your PCR is the legal medical record AND the billing source document. Getting it right the first time means the company gets paid and you don't get a callback.",
      },
    ],
  },
  {
    pageKey: "system",
    route: "/system",
    roles: ["creator"],
    pageName: "System Creator Dashboard",
    goal: "Global oversight: every tenant, subscription health, automated verification, support tickets, and the override monitor.",
    steps: [
      {
        title: "Step 1 — Watch tenant health",
        body: "Every active company shows here with verification, subscription, and usage signals.",
      },
      {
        title: "Step 2 — Work support tickets",
        body: "24-hour response guarantee. Tickets are timestamped from creation.",
      },
      {
        title: "Why this matters",
        body: "The platform is multi-tenant — your job here is to keep every tenant safe, compliant, and getting paid.",
      },
    ],
  },
];

export function getTourForRoute(route: string, role: TourRole | null | undefined): PageTour | null {
  if (!role) return null;
  // Exact match first; falls back to startsWith for nested routes
  const exact = PAGE_TOURS.find(t => t.route === route && t.roles.includes(role));
  if (exact) return exact;
  return PAGE_TOURS.find(t => route.startsWith(t.route + "/") && t.roles.includes(role)) ?? null;
}

export function getToursForRole(role: TourRole): PageTour[] {
  return PAGE_TOURS.filter(t => t.roles.includes(role));
}
# Truck checkoff loop: crew submits, dispatch reviews, next crew sees it's done

## What exists today (traced)

**Where the checklist lives**
- Crew page `/crew-checklist` (`CrewInspectionChecklist.tsx`) shows the Georgia ground-ambulance list (109 items in `vehicle-inspection-items.ts`), optionally trimmed per truck by `vehicle_inspection_templates`.
- When a crew submits, the app writes:
  - one row in `vehicle_inspections`: items, who submitted, when, the missing-item count, and a status of `complete` or `has_missing`;
  - one row in `vehicle_inspection_alerts` for each missing item;
  - a dispatch message in `alerts` (red if items are missing, green if not).
- **What dispatch sees today:**
  - The bell shows the `alerts` message as a "vehicle_inspection" event, but it only says an inspection happened.
  - The full sheet is visible only on Compliance & QA → Vehicle Inspections (`VehicleInspectionsTab`) and in the truck history on Trucks & Crews. Both are read-only.
  - `InspectionAlertExpanded`, which has the "Cleared to Proceed / Hold" buttons for missing items, exists but is not mounted anywhere. Dispatch can't acknowledge anything today.
- **The PCR gate:** `PCRPage` reads the day's inspection when the company setting requires an inspection before the PCR.

**How it's scoped**
- Each truck has at most one inspection per day. The database enforces this with a unique rule on company + truck + run date.
- Crew can read an inspection only if they are on that truck's crew for that date. Admin, dispatcher and billing can read inspections for their own company only.
- **Same day:** a crew reassigned onto a truck that was already inspected is already covered. They are on that day's crew record, so the checklist page loads the existing inspection and shows a read-only "Submitted by X at time" summary instead of a blank form.
- **Next day:** the inspection starts fresh, because the check is by date.
- So "already done" today means "this truck, this day". The missing piece is a dispatch review, and a clear message to the next crew.

**Crew-side notifications today**
- `notifications` table (per user, realtime, shown in the crew bell through `useNotificationFeed`).
- `useCrewBadges` puts a red dot on the Checklist menu item when today's inspection isn't done.

## Proposed design

### 1. Review period: per truck, per day (keep the current model)
- A dispatch acknowledgment covers the same truck + date row as the inspection. It resets the next day, when a new inspection is due.
- I don't recommend per shift: there is no shift record to key on, and adding one would mean reworking the scheduler.

### 2. Dispatch view and acknowledgment: one sign-off for the whole checklist
- **Where:** a "Checkoffs" section on the Dispatch Board's truck card, showing one of four badges:
  - Not submitted
  - Submitted, awaiting review
  - Reviewed
  - Has flags
- **Opening a checkoff** shows a side panel with:
  - the read-only item sheet (reusing the detail layout from `VehicleInspectionsTab`): items, crew notes, submitter and time;
  - the existing `InspectionAlertExpanded` controls for missing items.
- **Recommendation:** one "Mark Reviewed" for the whole checklist, plus the existing Cleared/Hold decision for each missing item.
  - Dispatch can't mark a checklist Reviewed while any missing item is still unanswered.
  - A separate check for each of the 109 items would be heavy and adds nothing, since the crew already marked each item OK or Missing.
- **Records:** each review writes an audit entry through `logAuditEvent`. Compliance & QA → Vehicle Inspections gets a "Reviewed by / at" column.

### 3. Next crew on the truck
- **On the crew checklist page:** the read-only summary gets a status banner.
  - **Green:** "Checkoff completed by {crew} at {time} and reviewed by dispatch ({name}, {time}). No need to redo it."
  - **Yellow:** shown when the checkoff is submitted but not yet reviewed.
  - **Red:** a Hold note.
- **Notification:** when dispatch marks a checkoff Reviewed, each member currently on that truck's crew for that day gets a bell notification of type `inspection_reviewed`.
- **When a crew is assigned later in the day:** if they're put on an already-reviewed truck, the same notification goes out when they open the checklist page. It's de-duplicated so each person gets it once per truck per day.
- **No new crew permissions:** the crew can already read the inspection row, so the new review columns come along with it.

## Technical details
- **Migration (additive, nullable):**
  - Add `reviewed_by uuid`, `reviewed_by_name text`, `reviewed_at timestamptz` and `review_note text` to `vehicle_inspections`.
  - Add an UPDATE rule that lets dispatchers and admins review only their own company's rows (`company_id = get_my_company_id()`), plus the matching grant.
  - Add `inspection_reviewed` to the list of allowed notification types in the notifications insert rule.
- **New code:**
  - A `reviewInspection()` helper in `src/lib/inspection-review.ts` that refuses to mark Reviewed while missing items are unanswered and records the audit entry. It gets tests: unanswered items block the review; Hold still allows it but sets the red banner.
  - Every new dispatch read is scoped with `getActiveCompanyId() ?? NO_COMPANY`.
- **Files touched:**
  - Dispatch board truck card, which mounts `InspectionAlertExpanded` plus the new review panel
  - `CrewInspectionChecklist.tsx` (banner and notify-once)
  - `VehicleInspectionsTab.tsx` (Reviewed column)
  - `useNotificationFeed` (label for the new notification)
- **Not touched:** the PCR gate, the scheduler, and NEMSIS/CTA.

## Open questions for you
1. Should an unreviewed checkoff block the PCR gate? The plan doesn't change it, so it stays "submitted is enough".
2. Should the next crew also get the notification when the checkoff is submitted but not yet reviewed, or only after dispatch reviews it?

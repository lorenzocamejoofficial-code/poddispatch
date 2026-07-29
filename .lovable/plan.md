# Certification Flow — Audit (read-only)

## 1. Cert data model

**Table:** `public.crew_certifications`
**Migration:** `supabase/migrations/20260623154115_5985d1ba-1bb1-41e5-8944-f9b81821357a.sql`

Columns of interest:
- `user_id` (FK to auth users), `company_id`
- `cert_type` enum `crew_cert_type`: `medic_number | cpr | drivers_license`
- `cert_level` enum `crew_cert_level`: `EMR | EMT_B | EMT_A | PARAMEDIC` (only used for `medic_number`)
- `cert_number`, `photo_path` (storage bucket `crew-certifications`)
- `issue_date`, `expiration_date`
- `status` enum `crew_cert_status`: `pending_review | approved | rejected | expired`
- `rejection_reason`
- `manually_verified` bool, `manual_verification_reason`, `manual_verification_expires_at` (used by the 30-day override)
- `uploaded_by`, `reviewed_by`, `reviewed_at`, `notes`, `created_at`, `updated_at`

**No 2-year renewal is encoded anywhere.** Each cert simply carries whatever `expiration_date` was entered on submission. The only automated renewal-related job is `supabase/functions/check-cert-expirations/index.ts`, which flips `approved → expired` once `expiration_date < today` and pings the crew + admins at 90/60/30/7/0 day marks. No auto-2-year default.

RLS: crew can read/insert/update their own pending rows; admins / system creator can update/delete any. Rows are append-only in practice (the panel always inserts a new row and displays the latest per `cert_type`).

## 2. The eligibility gate on Trucks & Crews

**File:** `src/pages/TrucksCrews.tsx` (lines ~320-353, in `fetchAll`).

Predicate (client-side, computed per profile):

```
REQUIRED = ["medic_number", "cpr", "drivers_license"]
A cert "counts" if:
  status === "approved"
  AND (
    (expiration_date exists AND expiration_date >= today)
    OR (manually_verified === true
        AND (manual_verification_expires_at is null OR >= today))
  )
assignable = all 3 REQUIRED cert_types are covered
blockedReason = "Missing/expired: <list of missing types>"
```

The 🚫 shown in the crew dropdown is driven entirely by `missing.length > 0`.

There is a mirror rule in the DB — `public.crew_assignable(_user_id uuid)` in the same migration — which also requires all 3 approved + non-expired (or manually verified). That RPC is defined but the Trucks & Crews page does its own client-side computation; it does not call the RPC.

Sibling gate: `src/hooks/useCrewViewEligibility.ts` decides whether a user sees the Crew UI, and only checks `profiles.cert_level` (not the crew_certifications table). Different gate, different rule.

## 3. Admin-side entry ("Employees → Certifications")

**Two admin surfaces exist:**

- **`src/pages/Employees.tsx`** — each employee row has a `ShieldCheck` dropdown item (line 799) that opens `CrewCertificationsDialog` in `adminMode` (line 979). The dialog is `src/components/crew/CrewCertificationsDialog.tsx`. Also shows a badge with pending count and a header link "Certification Queue" → `/certification-queue`.
- **`src/pages/CertificationReviewQueue.tsx`** at route `/certification-queue` — approve / reject only; no create.

**In the per-employee dialog (adminMode), an admin CAN:**
- Insert a new cert row for that employee (the `submit()` in `CertCard`, line ~180-222, always does `insert` into `crew_certifications` — it does NOT differentiate self vs admin). The `(isSelf || adminMode)` guard on line 284 exposes the Add/Update button to admins.
- Approve a pending row (`approve()`, line ~224).
- Reject with reason (`reject()`, line ~236).
- Apply a 30-day manual-verify override (`override()`, line ~250) — sets `manually_verified=true`, `manual_verification_expires_at = today+30`, and status→approved.

So the answer to "can an admin INSERT for an employee": **yes, via the per-employee ShieldCheck dialog.** The `/certification-queue` page is approve/reject-only.

## 4. Crew self-service entry

**Page:** `src/pages/crew/CrewCertifications.tsx` — renders `CrewCertificationsPanel` (non-adminMode) for `user.id`.
**Route:** `/crew-certifications` — registered in `src/App.tsx` across multiple role branches (lines 388, 435, 473, 508, 558). It is routed and reachable. Crew login exists (crew role in `useAuth`, `CrewLayout`, `useCrewViewEligibility`).

The form is the same `CertCard` used by admins. Crew members can add/replace their own three certs; each submit inserts a new `pending_review` row that an admin must approve before it counts toward the eligibility gate.

## 5. All write paths to `crew_certifications`

INSERTs:
- `src/components/crew/CrewCertificationsDialog.tsx` line ~213 — `CertCard.submit()`. Fires for both crew self-submit and admin-on-behalf-of-employee (same code path). Always inserts a new `pending_review` row.

UPDATEs:
- `src/components/crew/CrewCertificationsDialog.tsx` — `approve()` (~229), `reject()` (~242), `override()` (~256).
- `src/pages/CertificationReviewQueue.tsx` — bulk `approveIds()` (~132) and `rejectOne()` (~157).
- `supabase/functions/check-cert-expirations/index.ts` — daily cron flips `approved → expired` when past `expiration_date`; also writes notifications (separate table).

Seeds / other edge functions: none found. No writes from `create-user`, no migration/seed inserts, no other functions touching `crew_certifications`.

## Notable gaps worth naming (still no changes)
- **No auto 2-year renewal / default expiration.** Every cert must have a manually entered `expiration_date`, or `submit()` blocks with "Expiration date is required".
- **Dual-source eligibility.** Client computes it in `TrucksCrews.tsx`; DB has `crew_assignable()` RPC that isn't wired to the UI. Any future rule change needs both.
- **`useCrewViewEligibility` uses only `profiles.cert_level`**, not `crew_certifications`. Someone with an unapproved (or no) `crew_certifications` row can still reach the Crew UI as long as their profile has a `cert_level` string — they just can't be assigned to a truck.

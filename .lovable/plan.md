## Consolidated P2 Fix Plan (items 1–5 to build, 6–7 report-only)

---

### 1. PHONE NORMALIZATION — build

**Storage choice:** store as **10 digits only** (e.g. `"6785238355"`). Rationale: single canonical form, safe for search/dedup (Employees.tsx already string-compares phones for duplicates), and formatting for display can be layered later without a data migration. Non-US numbers just store as-is if length ≠ 10.

**Shared helper (new):** `src/lib/phone.ts`
```ts
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = String(input).replace(/\D/g, "");
  if (!digits) return null;
  // Strip leading US country code "1" if 11 digits
  const trimmed = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return trimmed;
}
```

**Save sites to update (call `normalizePhone(...)` on the payload only — leave input UI unchanged):**

| File | Line(s) | Field |
|---|---|---|
| `src/pages/CompanySignup.tsx` | 189 | `phone` |
| `src/pages/Employees.tsx` | 219, 289, 405, 433 | `phone_number` (create + edit paths) |
| `src/pages/Employees.tsx` | 202, 385 | duplicate-check comparisons — normalize both sides so `"678-523-8355"` matches `"6785238355"` |
| `src/pages/Patients.tsx` | 459, 489, 494 | `phone`, `secondary_payer_phone`, `tertiary_payer_phone` |
| `src/pages/FacilitiesPage.tsx` | 104 | `phone` |

Not touched: `EDIExport.tsx` submitter `contact_phone` (that's clearinghouse config, format may matter to Office Ally — out of scope).

---

### 2. PASSWORD MIN-LENGTH → 8 everywhere — build

| File | Line | Current | Change |
|---|---|---|---|
| `src/pages/CompanySignup.tsx` | 115, 333 | 8 (placeholder "Min 8") | keep |
| `src/pages/ResetPassword.tsx` | 86 | 8 | keep |
| `src/pages/Employees.tsx` | 194 | 6 | → 8 |
| `src/pages/Employees.tsx` | 615 | placeholder "Min 6 characters" | → "Min 8 characters" |
| `src/pages/AcceptInvite.tsx` | 86 | 6 | → 8 |
| `src/pages/AcceptInvite.tsx` | 203 | placeholder "Min 6 characters" | → "Min 8 characters" |

Error message text kept identical style: "Password must be at least 8 characters".

---

### 3. MANAGER ROLE COPY — build (with sub-finding)

**Confirmed:** Manager IS a real selectable role in the Add Employee dropdown — `src/pages/Employees.tsx` line 628 (create) and line 855 (edit) both render `<SelectItem value="manager">Manager</SelectItem>`. `isAdmin` check on line 537 treats manager as admin.

**Fix:** `src/components/tour/tourContent.ts` line 150
- Current: `"Each invite picks one of: Owner, Dispatcher, Biller, or Crew. Max 4 admins per company."`
- New: `"Each invite picks one of: Owner, Manager, Dispatcher, Biller, or Crew. Max 4 admins per company."`

(Admin cap stays at 4 — per Core memory. Manager counts as admin, so no count change needed.)

**Sub-finding (report only, no separate dropdown fix required):** Manager IS in the dropdown, so item 3b does not apply. No secondary finding.

---

### 4. ZIP VALIDATION — mostly already done, small addition

**ZIP entry points found:**

| Location | Structure | Status |
|---|---|---|
| `src/pages/CompanySignup.tsx` line 418 | **discrete field** | ✅ already input-masked to 5 digits (line 419) AND validated `/^\d{5}$/` at line 148. No change needed. |
| `src/pages/Patients.tsx` line 1132 `pickup_address` | **free-text** single field ("Street, City, ST ZIP") | ⚠️ Recommend **skip** — parsing/validating a ZIP substring inside a free-form address is error-prone (PO Boxes, apt suites, "GA 30301-1234" ZIP+4, missing state, etc.). Not worth the false-positive rate. |
| `src/pages/FacilitiesPage.tsx` line 240 `address` | **free-text** single field | ⚠️ Same as above — skip. |

**Proposed build:** none — CompanySignup ZIP is the only field driving the Medicare lookup and already validates. Report items 4b/4c as skipped-with-reason. If you want a discrete ZIP field added to Patients/Facilities that's a bigger schema change (out of P2 scope).

---

### 5. DOB VALIDATION — build

**Field location:** `src/pages/Patients.tsx` line 1088 — `<Input type="date" value={form.dob} onChange={...} />`. Save happens in the create/update handler (lines 458, and the update path further down).

**Change:** in the save handler (before insert/update), if `form.dob` is set:
```ts
if (form.dob) {
  const dob = new Date(form.dob);
  const today = new Date(); today.setHours(23,59,59,999);
  const min = new Date(); min.setFullYear(min.getFullYear() - 120);
  if (dob > today) { toast.error("Date of birth cannot be in the future."); return; }
  if (dob < min)   { toast.error("Date of birth is more than 120 years ago — please double-check."); return; }
}
```

Also add `max={new Date().toISOString().slice(0,10)}` to the DOB `<Input type="date">` (line 1088) for immediate browser-level UX.

Applied to both the create form and, if present, the edit form (same file — will verify the second call site during build).

---

### 6. TRIAL 12-HOUR AUTO-START — REPORT ONLY

**Mechanism found:**
- `supabase/functions/manage-company/index.ts` — when Creator approves a company, sets `approval_grace_deadline = now + 12 hours` on the `subscription_records` row.
- `supabase/functions/start-trial-timer-if-needed/index.ts` — invoked on first login; if `trial_started_at` is null and status is `trial_pending_start`, stamps `trial_started_at = now` and flips status to `trial_active`. (This IS the "start on first login" path.)
- `supabase/functions/sweep-approval-grace/index.ts` — periodic sweep: any row whose `approval_grace_deadline` has passed with `trial_started_at` still null gets force-started at the deadline. **This is the 12-hour auto-start**.

**Options (for your decision — not building):**
- **A. Login-only:** delete the sweep function (or gate it behind a flag). Trial only starts when the owner actually signs in. Risk: dormant approved accounts never start their clock, skewing your funnel metrics.
- **B. Extend grace:** change `12 * 60 * 60 * 1000` in `manage-company/index.ts` to e.g. 72h or 7d. Simple one-line change; preserves the safety net against accounts that never log in.
- **C. Hybrid:** keep the sweep but only fire it after 7 days AND send a reminder email at 24h/72h. Larger change (needs email template + scheduling).

No code change this turn.

---

### 7. /contact DEMO FORM — REPORT ONLY

**Confirmed:** no `/contact` route or demo form exists in this project. `src/App.tsx` route table has no `/contact`; the only "contact" reference is a comment on line 327 about a data-export contact link on the cancelled-account landing. **The marketing site (`thepoddispatch.com` marketing pages) is a separate project** — this fix belongs there, not here.

No action in this repo.

---

## Build order (after approval)

1. Create `src/lib/phone.ts`.
2. Wire `normalizePhone` into the 4 files listed in §1.
3. Bump password mins to 8 in Employees + AcceptInvite (§2), update placeholders.
4. Update tour copy line 150 (§3).
5. Add DOB validation + `max` attr in Patients.tsx (§5).
6. Typecheck.

No changes to §4 (already covered), §6 (report-only), §7 (wrong repo).
# AUDIT — Minimum crew count enforcement

Read-only. No changes proposed.

**Short answer: there is NO "minimum 2 crew" rule anywhere in the stack.** A single certified Member 1 is sufficient to save a truck-day, receive leg assignments, complete a PCR, submit it, and auto-create a claim. Signature enforcement scales to whatever count is on the crew row (1 → 1 signature).

---

## 1. Weekly crew assignment save (Trucks & Crews)

**Client:** `src/pages/TrucksCrews.tsx:506-533` (`assignCrew`) + `:535-…` (`editCrew`)
- Only guard: `if (!m1Val && !m2Val && !m3Val)` → "Select at least one crew member".
- Duplicate-slot check (same person twice) exists.
- No check that ≥2 slots are filled.

**Server (authoritative):** `public.safe_assign_crew` — latest def in `supabase/migrations/20260624142142_773149d7-…sql`
- Builds `v_member_ids` from non-null params.
- Rejects only if `array_length(v_member_ids, 1) IS NULL` → "Select at least one crew member".
- Runs cert gate (`crew_assignable`) per provided member and cross-truck conflict check, then inserts.
- **No minimum-count rule.** Member 1 alone passes.

**Verdict:** A truck-day can be saved with only Member 1.

---

## 2. Assigning a leg/run to a truck (`truck_run_slots`)

**Client:** `src/pages/Scheduling.tsx:1064` (`supabase.from("truck_run_slots").insert(...)`) and slot reorder at `:1015-1016`. `src/hooks/useSchedulingStore.tsx:175-…` reads slots.
- Insert payload: `leg_id, truck_id, run_date, slot_order`. No crew lookup, no count check.

**Server:** `truck_run_slots` has no trigger/policy that inspects `crews.memberN_id` count. Slot-order helper `safe_update_slot_order` is concurrency only.

**Verdict:** Legs assign to a truck with zero regard for how many crew are on it that day. A truck with only Member 1 (or even zero crew — nothing blocks the insert either) accepts legs.

---

## 3. Starting / finalizing a PCR

**File:** `src/pages/PCRPage.tsx`
- `assignedCrewCount` is derived from the joined `crews` row for `trip.crew_id`: `PCRPage.tsx:900-921` — counts whichever of `member1_id/member2_id/member3_id` are non-null (so 1, 2, or 3).
- Submit gate (`PCRPage.tsx:1263-1264`):
  ```
  if (assignedCrewCount > 0 && !areAllCrewSigned(trip.signatures_json||[], assignedCrewCount)) { … block … }
  ```
- `areAllCrewSigned` (`src/components/pcr/CrewSignaturesSection.tsx:662`) verifies the signature array length matches `assignedCrewCount`. With a 1-person crew it requires **1** signature.
- Attending medic pick (`PCRPage.tsx:1055-1060`, `MedicSelector.tsx`) accepts any member from the crew, including a lone Member 1.
- Other submit prerequisites are field-completeness (times, miles, signature obtained, transport-specific fields per `src/lib/safety-rules.ts`), none of which reference crew count.

**Verdict:** A solo crew can advance a PCR all the way to `pcr_status='submitted'`. No dual-signature / driver-plus-attendant rule.

---

## 4. Claim generation trigger

**Function:** `public.auto_create_claim_on_pcr_submit` — current def `supabase/migrations/20260517224836_644b47a6-…sql` (superseded fields in later migrations, but same shape).
- Body reads patient/leg payer + PCS, addresses, ZIPs, resolves rate from `charge_master`, computes base/mileage/extras, inserts into `claim_records`.
- **Never references `crews`, `member1_id/member2_id/member3_id`, or any crew-count value.**

**Verdict:** Claim creation is fully independent of crew count.

---

## Summary matrix

| Layer | Minimum-crew rule? | Fails on solo Member 1? |
|---|---|---|
| `safe_assign_crew` RPC | No — only ≥1 required | No |
| `TrucksCrews.tsx` client | No | No |
| `truck_run_slots` insert | No | No |
| PCR submit gate | No — scales to N | No (1 sig required for 1-person crew) |
| `auto_create_claim_on_pcr_submit` | No — doesn't look at crew | No |

**End-to-end:** solo Member 1 → truck-day saved → legs assigned → PCR completed → PCR submitted → claim auto-created. There is no "at least 2 certified crew" enforcement anywhere.

---

## Files referenced
- `src/pages/TrucksCrews.tsx:506-570` (assignCrew / editCrew)
- `supabase/migrations/20260624142142_773149d7-5533-401a-a167-68f42b34fbb4.sql` (`safe_assign_crew`)
- `src/pages/Scheduling.tsx:1064, 1015-1016` (`truck_run_slots` insert / reorder)
- `src/hooks/useSchedulingStore.tsx:175-203` (slot reads)
- `src/pages/PCRPage.tsx:864, 900-921, 1055-1060, 1263-1288` (crew count, medic pick, submit gate)
- `src/components/pcr/CrewSignaturesSection.tsx:662` (`areAllCrewSigned`)
- `supabase/migrations/20260517224836_644b47a6-7740-4244-91f3-65a3a183d79d.sql` (`auto_create_claim_on_pcr_submit`)

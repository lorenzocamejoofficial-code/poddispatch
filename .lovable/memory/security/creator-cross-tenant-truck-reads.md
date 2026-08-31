---
name: Creator cross-tenant truck reads
description: trucks has a system-creator SELECT policy across all tenants; every tenant-facing query must filter company_id via getActiveCompanyId()
type: constraint
---
The `trucks` table has an RLS policy `System creator read trucks count` with
`USING (is_system_creator())` — no company filter — so platform-wide counts work
for the creator console. Consequence: when a system creator is inside a tenant
(including the simulation lab), any tenant-facing query that relies on RLS alone
returns OTHER tenants' trucks.

**Rule:** every tenant-facing read of `trucks` (and any other table carrying a
creator-wide policy) must explicitly filter `.eq("company_id", scopedCompanyId)`
using `getActiveCompanyId()` from `src/lib/company-scope.ts` (falls back to
`NO_COMPANY` so a null tenant returns zero rows, never all rows).

**Why:** Do not narrow the creator policy — SystemCreatorDashboard's truck count
across real tenants depends on it.

**Scope is NOT limited to trucks.** ~55 public-table policies use
`is_system_creator()`/`is_owner_or_creator()` with no company predicate, incl.
trip_records, claim_records, safety_overrides, billing_overrides, hold_timers,
facilities, biller_tasks, qa_reviews, claim_creation_failures, comms_events,
crew_certifications, operational_alerts.

**Scoped surfaces:** DispatchBoard (trucks, safety_overrides, hold_timers),
useSchedulingStore, TrucksCrews (trucks, crew_certifications),
VehicleInspectionsTab, OwnerDashboard (trucks, claim_records, trip_records),
ReportsAndMetrics, TruckBuilder, CrewScheduleAdmin, FacilitySelect,
CommunicationsSection, usePCRData, useSidebarBadges (all badge counts),
BillerTaskQueue.

Creator-only surfaces (SystemCreatorDashboard, CreatorConsole,
CreatorCompanyDetail, src/components/creator/**) stay unscoped by design.

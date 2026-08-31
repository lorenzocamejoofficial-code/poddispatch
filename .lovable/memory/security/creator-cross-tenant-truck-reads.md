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

**Scoped surfaces:** DispatchBoard, useSchedulingStore (Scheduling/run pages),
TrucksCrews (already scoped), VehicleInspectionsTab, OwnerDashboard,
ReportsAndMetrics.

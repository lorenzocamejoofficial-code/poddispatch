---
name: Creator-side aggregate filter
description: Every creator/platform-wide aggregate query MUST exclude test/sandbox/soft-deleted companies via fetchRealCompanyIds()
type: constraint
---
**Rule:** Any creator-side query that aggregates ACROSS companies (platform metrics,
SaaS dashboards, billing reconciliation, support ticket dashboards, customer
health views, future analytics) MUST scope to real customer tenants only.

**How to apply:** Use `fetchRealCompanyIds()` from `src/lib/real-companies.ts`
then `.in("company_id", realIds)` on every downstream table query. If realIds
is empty, short-circuit to zeros — do NOT issue unfiltered queries.

**Filters baked into the helper:**
- creator_test_tenant = false   (Lorenzo Test, etc.)
- is_sandbox = false            (LOADTEST + simulation sandboxes)
- deleted_at IS NULL            (soft-archived tenants)

**Why:** Without this, test tenants and archived sandboxes inflate platform
metrics. Per-company queries scoped via RLS are unaffected — this rule only
applies to creator-side cross-tenant aggregates.

**Currently scoped views:** SystemCreatorDashboard, SaaSMetricsTab,
CompanyHealthTable, ReconciliationReportPanel, SupportTicketsPanel,
CreatorConsole loadCompanies.

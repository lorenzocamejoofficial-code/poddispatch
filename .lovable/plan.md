## Responsive Pass — Entire App

The app already uses Tailwind with `lg:` breakpoints in the three shells (AdminLayout, CrewLayout, CreatorLayout) and most pages. A true "rewrite every page" pass would touch 60+ files and risk regressions on dense dispatch/billing tables that intentionally require horizontal scroll. Instead I'll do a layered pass that delivers the user-visible win everywhere without rewriting every grid.

### Breakpoints (Tailwind config)
Add custom breakpoints so the rest of the codebase keeps working:
- `sm: 480px` (small mobile cutoff)
- `md: 768px` (tablet)
- `lg: 1024px` (sidebar collapses below this — already the default in shells)
- `xl: 1280px`
- `2xl: 1440px` (desktop full layout)

Existing `lg:` usage already matches the "sidebar visible ≥1024" rule, so shells need no breakpoint rewrite — just verification.

### 1. Global baselines (`src/index.css`, `tailwind.config.ts`)
- Body text: ensure `body` is `text-base` (16px) — currently inherits. Add explicit `font-size: 16px` on `html` to guarantee mobile readability and prevent iOS input zoom.
- Add `.tap-44` utility (min 44×44) for icon buttons used on mobile.
- Add `overflow-x: hidden` on `body` as last-resort horizontal-scroll guard, scoped so tables can still scroll inside their own containers (`overflow-x-auto` on wrappers).

### 2. Layout shells — verify + tighten
- `AdminLayout`, `CrewLayout`, `CreatorLayout`: already have hamburger + off-canvas sidebar < `lg`. Audit each:
  - Confirm `<SidebarTrigger>`/menu button is ≥44px tap target.
  - Confirm header doesn't overflow on 320px (truncate title, hide secondary badges below `sm`).
- `src/pages/Login.tsx`, `CompanySignup.tsx`, `CompletePayment.tsx`, `TrialExpired.tsx`, `AcceptInvite.tsx`, `Legal`, `ForgotPassword/Email`, `ResetPassword`: stack to single column, full-width buttons below `sm`.

### 3. High-traffic pages (responsive-pass each)
- `DispatchBoard.tsx` — truck cards already grid; verify single column < `md`, wrap header actions.
- `Scheduling.tsx` — stack panels < `md`.
- `BillingAndClaims.tsx`, `TripsAndClinical.tsx`, `RemittanceImport.tsx`, `EDIExport.tsx` — wrap dense tables in `overflow-x-auto`, stack filter rows < `md`.
- `OwnerDashboard.tsx`, `SystemCreatorDashboard.tsx`, `ReportsAndMetrics.tsx` — KPI grids to 1 col < `sm`, 2 col < `lg`.
- `PCRPage.tsx` and `src/components/pcr/*` — already form-heavy; stack two-column rows < `md`, full-width buttons < `sm`.
- `CrewDashboard.tsx`, `crew/CrewPatients.tsx`, `crew/CrewSchedule.tsx`, `DailyRunSheet.tsx` — these are field-use; verify tap targets and stacking.
- `AdminSettings.tsx`, `Employees.tsx`, `TrucksCrews.tsx`, `FacilitiesPage.tsx`, `Patients.tsx` — table/grid wrappers + stacked filter bars.

### 4. Out of scope (intentional)
- Dense data tables (claims grid, dispatch matrix) keep horizontal scroll inside their card — this is correct UX, not a bug. They get a scroll wrapper, not a vertical-stack rewrite.
- No visual redesign, no token changes, no dark-mode work, no logic changes.
- Lower-traffic creator/admin sub-pages (CreatorSettings, OverrideMonitor, SimulationLab, MigrationOnboarding, SysRecovery, EmailActivity) get a quick pass for overflow only.

### 5. Verification
- Browser screenshots at 1440 / 1024 / 768 / 375 on: Login, DispatchBoard, BillingAndClaims, PCRPage, CrewDashboard, AdminSettings.
- Check no horizontal scroll on `<body>` at 375px.

### Risk / size
~25–35 files touched. Mostly className additions (`grid-cols-1 md:grid-cols-2`, `flex-col sm:flex-row`, `w-full sm:w-auto`, `overflow-x-auto` wrappers). No business logic. ~400–600 LOC across the codebase.

Approve and I'll execute in this order: config → global CSS → shells → auth/public pages → dispatch/billing → crew → settings, screenshotting checkpoints along the way.
# Roadmap — company lifecycle fix

- [ ] Pass 1: persist trial dates + expiry sweep + cron auth
- [ ] Pass 2: one trial clock (useAuth, CreatorCompanyDetail, TrialBanner)
- [ ] Pass 3: creator levers (extend trial, comp/activate) — creator-only, reason, history + audit
- [ ] Pass 4: close founding deadlock (ChoosePlan, TrialExpired)
- [ ] Tests (shared clock, sweep idempotency) + build

# Roadmap — unified cancel workflow
- [x] Shared cancelTrip() + "voided" claim status
- [x] Scheduling, Truck Builder, Trips & Clinical flag, crew Confirm Cancel all routed through it
- [x] Billing scan reuses shared void helper
- [x] Tests + build

# Roadmap — NEMSIS CTA test harness
- [x] Pass 1: transport (secrets, SOAP client, nemsis_cta_submissions, nemsis-cta-submit, creator screen, tests)
- [ ] Pass 2-5: fixtures, NV fix + DEM exporter, DEM 1, EMS 1-5 (await approval)

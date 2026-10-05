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

# Roadmap — two-axis classification (transport x payer), one stage at a time
- [x] Stage 0: transport-vocabulary module + tests (no behavior change)
- [x] Stage 1: additive migration (transport_kind enum, payer_class, nullable columns)
- [x] Stage 2: backfill dry-run reviewed and approved
- [x] Stage 3: backfill applied + dual-write triggers (2 no-payer trips left NULL for review)
- [x] Stage 4: clinical readers on transport_kind (ePCR cards/fields/narrative) + parity + SQL/TS drift tests
- [x] Stage 4b: ePCR section rules on transport_kind (emergency upgrade wins)
- [x] Stage 5 billing readers on payer_class (hardened vocabulary, claim payer_class, commercial pricing fix)
- [ ] Stages 6-7: UI, contract (awaiting owner per stage)

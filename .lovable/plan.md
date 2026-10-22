# NEMSIS EMS 1–5 compliance fix (lossless export + live cases)

## Sourcing the live-case references
No git history recovery is needed. The Oct-4 live-case submission files are already committed verbatim in the project:

- `src/lib/nemsis/fixtures/ems1-submission.xml` — eRecord.01 `2026-EMS-1-Crash`, 3 crew groups
- `ems2-submission.xml` — `2026-EMS-2-Stroke`, 2 crew
- `ems3-submission.xml` — `2026-EMS-3-CHF`, 2 crew
- `ems4-submission.xml` — `351-073-92` (Seizure), 2 crew
- `ems5-submission.xml` — `351-073-93` (Delirium), 2 crew

None of them has an `eCustomResults` block. That matches defect 2. These files are the CTA-frozen submission fixtures, so I will copy them and leave the originals alone.

## Steps
1. **New reference copies.** Copy the 5 files into `tests/nemsis/reference/live/` as `2026-EMS-1-Crash_v351.xml`, `-2-Stroke`, `-3-CHF`, `-4-Seizure`, `-5-Delirium`. The old pre-testing references stay as they are for history.
2. **Apply your corrections by hand.** I will insert each missing element at its correct XSD sequence position, as a sibling right after the last existing instance of that element, inside the right group:
   - EMS 1: a second `eArrest.03` with value 3003005.
   - EMS 2–5: every listed `+=` value, including attributes (`PN="8801005"`, `CodeType="9924001"`, `PhoneNumberType="9913001"`). Crew-specific `eCrew.03` values go to the crew matched by its eCrew.01 ID. Assessment-group-specific `eExam.19`/`.20` values go to the group you named. `eOther.06` gets both values in every crew member group.
   - eCrew.901, for EMS 2–5: add `CorrelationID` to each `eCrew.CrewGroup` (first = `c2`, second = `c1`). Add one PCR-level `eCustomResults` block (after eOutcome/eOther, in XSD order), with one ResultsGroup per crew: `.01` = value, or `xsi:nil="true" NV="7701001"` for EMS 4 crew 1; `.02` = `eCrew.901`; `.03` = the matching CorrelationID.
   - This step uses a small one-off script (`scripts/nemsis/apply-live-corrections.mjs`). It builds the corrections from a table of your exact values, inserts with string anchors, and fails loudly if an anchor is missing. That makes the edits auditable and repeatable.
3. **Lossless exporter.** Add an optional `raw_reference?: string` field to `PcrExportInput`. At the top of `buildEmsDataSet`, if it is present, return the XML verbatim, replacing only the contents of `eRecord.02` and `.03` (software name) and `.04` (version) from `ctx.software`. If none of the software tags is found, it throws instead of passing the file through silently. The live trip path (no `raw_reference`) does not change at all.
4. **Fixtures.** Rewrite `tests/nemsis/fixtures/ems1.ts`–`ems5.ts` to read the live-case reference file and pass it as `raw_reference`, with ctx software set to Pod Dispatch / 1.0. `from-reference.ts` stays in place but is no longer used by these fixtures.
5. **Generator, diff and committed copies.** `gen-compliance.mjs` keeps its EMS-1..5 output. Point `diff-reference.mjs` runs at the new live references. Regenerate `tests/nemsis/submitted/` with the live-case filenames, and remove the old EMS 1–5 submitted copies. DEM-1 is not touched.

## Acceptance
- Each EMS-N output passes XSD with 0 Schematron errors. EMS 1's former warning is cleared by the added eArrest.03. Any warning that remains gets reported along with whether the reference itself has it.
- `diff-reference` shows 0 differences against each corrected live reference. A byte comparison shows the only change is the software identity.
- Per-file checks confirm that every value you listed is present (counted with grep), including the 2 races in EMS 2 and the eCustomResults correlation pairs.
- Live synthetic trip output still passes XSD, the type-check is clean, and the full test suite is green. A new unit test checks that `raw_reference` is passed through with only the software tags changed.

## Scope and risks
- Changes `src/lib/nemsis/exporter.ts`, which you have explicitly authorized here. It does not touch `nemsis-cta-submit`, the `*-submission.xml/.ts` CTA fixtures, `ems-record.ts` renderers, DEM, or the server-side exporter copy. Syncing the server-side copy stays a separate decision.
- The lossy model's truncation (defect 1) is bypassed for compliance files, not fixed for live trips. Live trips today have no repeated data, so fixing the model can come later.
- If an element's exact position is ambiguous (for example, which assessment group is "group 1" in EMS 5), I'll stop and ask rather than guess.
- Submission stays manual: I won't submit anything, and you click Submit yourself.

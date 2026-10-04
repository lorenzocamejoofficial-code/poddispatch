/**
 * Canonical EMS 1 (2026-EMS-1-Crash) submission payload, NEMSIS 3.5.1, schema 61.
 * Committed VERBATIM — do not reformat or alter. No envelope timestamp to stamp;
 * sent as-is. Fixed test-case data only — no tenant data, no PHI.
 */
import raw from "./ems1-submission.xml?raw";

export const EMS1_SUBMISSION_XML: string = raw;

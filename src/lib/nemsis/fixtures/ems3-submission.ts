/**
 * Canonical EMS 3 (2026-EMS-3-CHF) submission payload, NEMSIS 3.5.1, schema 61.
 * Committed VERBATIM — do not reformat or alter. No envelope timestamp to stamp;
 * sent as-is. Fixed test-case data only — no tenant data, no PHI.
 */
import raw from "./ems3-submission.xml?raw";

export const EMS3_SUBMISSION_XML: string = raw;

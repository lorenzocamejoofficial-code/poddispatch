/**
 * Canonical EMS 4 (Seizure) submission payload, NEMSIS 3.5.1, schema 61.
 * Committed VERBATIM — do not reformat or alter. No envelope timestamp to stamp;
 * sent as-is. Fixed test-case data only — no tenant data, no PHI.
 */
import raw from "./ems4-submission.xml?raw";

export const EMS4_SUBMISSION_XML: string = raw;

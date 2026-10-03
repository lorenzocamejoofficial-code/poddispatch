/**
 * Canonical DEM 1 submission payload (NEMSIS 2026 Active Test Cases, schema 3.5.1).
 *
 * This XML was produced by resolving the DEM 1 fixture against the official
 * NEMSIS 3.5.1 Data Dictionary and is treated as the source of truth. It is
 * committed VERBATIM — do not reformat, re-indent, reorder, or alter any
 * value or attribute; the CTA matches on exact data content.
 *
 * The DemographicReport timeStamp is a placeholder; the Pass 4 submit path
 * sets the real timestamp at send time.
 *
 * Fixed test-case data only — no tenant data, no company_id, no PHI.
 */
import raw from "./dem1-submission.xml?raw";

export const DEM1_SUBMISSION_XML: string = raw;

/** Top-level sections expected inside DemographicReport, in order. */
export const DEM1_SUBMISSION_SECTIONS = [
  "dRecord",
  "dAgency",
  "dContact",
  "dConfiguration",
  "dLocation",
  "dVehicle",
  "dPersonnel",
  "dDevice",
  "dFacility",
] as const;

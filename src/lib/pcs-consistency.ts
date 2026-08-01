/**
 * PCS-vs-condition consistency.
 *
 * Field presence is not the same as field truth. This module compares what the
 * Physician Certification Statement / patient chart SAYS the patient needs
 * against what the run actually documents, and reports contradictions before
 * the claim is built.
 */
export type MobilityClass = "ambulatory" | "wheelchair" | "stretcher" | "unknown";

export interface PcsConsistencyInputs {
  /** patients.mobility — what the chart / PCS says the patient requires. */
  chartMobility?: string | null;
  /** patients.default_bed_confined */
  chartBedConfined?: boolean | null;
  /** trip_records.patient_mobility or scheduling_legs.oneoff_mobility */
  documentedMobility?: string | null;
  /** trip_records.stretcher_required */
  stretcherRequired?: boolean | null;
  /** trip_records.stretcher_placement (free text; non-empty implies stretcher) */
  stretcherPlacement?: string | null;
  /** trip_records.bed_confined */
  bedConfined?: boolean | null;
}

export interface PcsMismatch {
  code: "pcs_mobility_mismatch" | "pcs_bed_confinement_mismatch";
  message: string;
}

/** Normalize free-text mobility wording into a comparable class. */
export function classifyMobility(value?: string | null): MobilityClass {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) return "unknown";
  // Negations first — "Unable to Ambulate" / "non-ambulatory" must never be
  // read as ambulatory just because the word "ambulat" appears.
  if (/(unable|non|not|cannot|can't)[ -]*(to )?ambulat/.test(v)) return "unknown";
  if (v.includes("stretcher") || v.includes("gurney") || v.includes("cot") || v.includes("bed confined") || v.includes("bed-confined")) return "stretcher";
  if (v.includes("wheelchair") || v.includes("w/c") || v.includes("chair")) return "wheelchair";
  if (v.includes("ambulat") || v.includes("walks") || v.includes("independent")) return "ambulatory";
  return "unknown";
}

const RANK: Record<MobilityClass, number> = { unknown: -1, ambulatory: 0, wheelchair: 1, stretcher: 2 };

export function evaluatePcsConsistency(inputs: PcsConsistencyInputs): PcsMismatch[] {
  const mismatches: PcsMismatch[] = [];

  const chart = classifyMobility(inputs.chartMobility);
  let documented = classifyMobility(inputs.documentedMobility);
  const stretcherSignal =
    inputs.stretcherRequired === true ||
    (!!inputs.stretcherPlacement && String(inputs.stretcherPlacement).trim().toLowerCase() !== "none");
  if (stretcherSignal) documented = "stretcher";

  if (chart !== "unknown" && documented !== "unknown" && RANK[chart] !== RANK[documented]) {
    mismatches.push({
      code: "pcs_mobility_mismatch",
      message: `PCS / patient chart says ${chart}, but this run documents ${documented}. Reconcile the certification with the run before billing.`,
    });
  }

  const chartBed = inputs.chartBedConfined;
  const runBed = inputs.bedConfined;
  if (typeof chartBed === "boolean" && typeof runBed === "boolean" && chartBed !== runBed) {
    mismatches.push({
      code: "pcs_bed_confinement_mismatch",
      message: `Bed-confinement conflict: chart says ${chartBed ? "bed-confined" : "not bed-confined"}, run documents ${runBed ? "bed-confined" : "not bed-confined"}.`,
    });
  }

  return mismatches;
}

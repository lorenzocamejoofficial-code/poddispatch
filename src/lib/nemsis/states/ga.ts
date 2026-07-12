/**
 * Georgia GEMSIS eCustom block — Phase 3.
 *
 * GA DPH adds ~15 state-required custom fields on top of NEMSIS core. This
 * module isolates every GA-only assumption so adding neighboring states
 * (AL, FL, SC, TN, NC) is a new sibling file, not a rewrite of the exporter.
 *
 * The exact CustomElementID list is finalized during GEMSIS vendor
 * onboarding — GA DPH sends the current schema with test credentials.
 * We render the shape here now and populate the actual IDs when creds
 * arrive. Emitting a schema-shaped eCustom today keeps the exporter
 * deterministic and unit-testable.
 */

import type { ExportContext } from "@/lib/nemsis/exporter";
import { el, wrap } from "@/lib/nemsis/xml-utils";

export function renderGeorgiaCustom(
  trip: Record<string, unknown>,
  ctx: ExportContext,
): string {
  const parts: string[] = [];

  // GA loaded-mileage attestation (billing already computes this)
  if (trip.loaded_miles != null) {
    parts.push(el("eCustom.01", { CustomElementID: "GA-LoadedMiles" }, String(trip.loaded_miles)));
  }

  // GA wait-time (billable minutes)
  if (trip.wait_time_minutes != null) {
    parts.push(el("eCustom.01", { CustomElementID: "GA-WaitTimeMinutes" }, String(trip.wait_time_minutes)));
  }

  // Software identity — GA requires this in every submission
  parts.push(el("eCustom.01", { CustomElementID: "GA-VendorSoftware" }, ctx.software.name));
  parts.push(el("eCustom.01", { CustomElementID: "GA-VendorSoftwareVersion" }, ctx.software.version));

  return wrap("eCustom", null, parts.join(""));
}
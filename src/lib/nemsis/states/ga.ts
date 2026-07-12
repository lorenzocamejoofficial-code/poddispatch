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

  // Each ResultsGroup pairs a value (eCustomResults.01) with the ID of the
  // matching entry in the state-registered eCustomConfiguration (.02).
  const group = (id: string, value: string): string =>
    wrap("eCustomResults.ResultsGroup", null,
      el("eCustomResults.01", null, value) +
      el("eCustomResults.02", null, id),
    );

  if (trip.loaded_miles != null) parts.push(group("GA-LoadedMiles", String(trip.loaded_miles)));
  if (trip.wait_time_minutes != null) parts.push(group("GA-WaitTimeMinutes", String(trip.wait_time_minutes)));
  parts.push(group("GA-VendorSoftware", ctx.software.name));
  parts.push(group("GA-VendorSoftwareVersion", ctx.software.version));

  return wrap("eCustomResults", null, parts.join(""));
}
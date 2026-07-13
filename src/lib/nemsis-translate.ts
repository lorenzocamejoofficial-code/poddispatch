/**
 * NEMSIS translation layer — Phase 1b foundation.
 *
 * PURPOSE: Let PCR cards write NEMSIS coded values (for future XSD/GEMSIS
 * Web Service export) WITHOUT breaking the downstream billing pipeline that
 * feeds Office Ally today. Every downstream reader (837P generator,
 * claim-readiness, pcr-narrative, qa-anomaly-checks, ambulance-modifier)
 * currently compares against DISPLAY strings like "Nasal cannula",
 * "BLS", "Emergency", etc. Those comparisons must keep working unchanged.
 *
 * RULE FOR PCR CARDS (Phase 1b onward):
 *   1. On write: persist BOTH forms — the NEMSIS code AND the legacy display.
 *      Convention: `<field>` stays the display (billing reads this),
 *      `<field>_code` gets the NEMSIS code (future export reads this).
 *   2. On read: cards call `resolveDisplay(codeSet, storedValue)` to render.
 *      That resolves either a code OR a legacy display OR a plain string,
 *      always returning the display so the UI stays stable.
 *
 * RULE FOR BILLING/EDI/QA READERS:
 *   - Continue reading the display field. Do NOT switch to `<field>_code`.
 *   - If a reader ever needs to accept a code-only value, call `toDisplay()`
 *     defensively BEFORE any string comparison so old and new rows behave
 *     identically.
 *
 * This module is dependency-free (only imports the code-set library) so it
 * is safe to use from any layer without creating cycles.
 */

import type { NemsisCode } from "./nemsis-code-sets";
import { findByCode, findByDisplay } from "./nemsis-code-sets";

/** Return the human-readable display for a stored value, whether it is a
 *  NEMSIS code, a legacy display string, or null. Falls back to the raw
 *  string when nothing matches so free-text values remain visible. */
export function toDisplay(
  codeSet: readonly NemsisCode[],
  stored: string | null | undefined,
): string | null {
  if (stored == null) return null;
  const s = String(stored).trim();
  if (!s) return null;
  return (
    findByCode(codeSet, s)?.display ??
    findByDisplay(codeSet, s)?.display ??
    s
  );
}

/** Return the NEMSIS code for a stored value, whether it is already a code
 *  or a legacy display. Returns null for unmapped free-text so callers can
 *  distinguish "unknown" from "mapped". */
export function toCode(
  codeSet: readonly NemsisCode[],
  stored: string | null | undefined,
): string | null {
  if (stored == null) return null;
  const s = String(stored).trim();
  if (!s) return null;
  return (
    findByCode(codeSet, s)?.code ??
    findByDisplay(codeSet, s)?.code ??
    null
  );
}

/** Return `{ code, display }` for a stored value. Either half may be null
 *  when the source is unmapped free-text. Convenience for card write paths
 *  that need to persist both columns in one shot. */
export function toPair(
  codeSet: readonly NemsisCode[],
  stored: string | null | undefined,
): { code: string | null; display: string | null } {
  return { code: toCode(codeSet, stored), display: toDisplay(codeSet, stored) };
}

/** True when the stored value round-trips through the code set — i.e. we
 *  can safely emit it in a NEMSIS XSD payload. Used by future export code
 *  and QA warnings; today's billing pipeline does not depend on this. */
export function isNemsisMapped(
  codeSet: readonly NemsisCode[],
  stored: string | null | undefined,
): boolean {
  return toCode(codeSet, stored) !== null;
}
/**
 * NEMSIS validation findings — pure parsing and finalization gating shared by
 * the in-app validation service (supabase/functions/nemsis-validate) and UI.
 *
 * Rule: any ENFORCED ERROR (XSD or an enforced Schematron set's [ERROR]/[FATAL])
 * blocks finalization; enforced WARNINGs are shown but allowed. Findings from
 * informational sets (state files by default — see SCHEMATRON_POLICY) are run
 * and shown, labelled informational, and never block.
 */

/** NEMSIS dataset version the app exports. */
export const NEMSIS_DATASET_VERSION = "3.5.1";

export type SchematronEnforcement = "enforce" | "informational" | "auto";
export interface SchematronPolicy {
  kind: "national" | "state";
  /** State code for state files, e.g. "GA". */
  state?: string;
  /**
   * enforce: findings gate finalization. informational: shown, never block.
   * auto: enforce only when the file's version matches the exported dataset
   * version (e.g. a state publishes a 3.5.1 file).
   */
  enforcement: SchematronEnforcement;
}

/**
 * Per Schematron set (asset set_id) enforcement configuration. Sets not listed
 * are national/compliance files and are enforced. Georgia publishes only a
 * 3.5.0 file while the exported data is 3.5.1, so it is informational. To
 * enforce a state file for an agency whose state publishes a matching version,
 * set its entry to "auto" (or "enforce").
 */
export const SCHEMATRON_POLICY: Record<string, SchematronPolicy> = {
  "state-ga-ems": { kind: "state", state: "GA", enforcement: "informational" },
};

export function policyFor(setId: string): SchematronPolicy {
  return SCHEMATRON_POLICY[setId] ?? { kind: "national", enforcement: "enforce" };
}

/** Whether a Schematron set's findings gate finalization. */
export function isSetEnforced(
  setId: string,
  fileVersion: string | null,
  policies: Record<string, SchematronPolicy> = SCHEMATRON_POLICY,
  datasetVersion = NEMSIS_DATASET_VERSION,
): boolean {
  const p = policies[setId] ?? { kind: "national", enforcement: "enforce" };
  if (p.enforcement === "enforce") return true;
  if (p.enforcement === "informational") return false;
  return !!fileVersion && (fileVersion === datasetVersion || fileVersion.startsWith(`${datasetVersion}.`));
}

export type FindingLevel = "ERROR" | "WARNING";

export interface ValidationFinding {
  level: FindingLevel;
  /** "XSD" or the Schematron set that produced it (e.g. "National", "Georgia"). */
  source: string;
  /** Natural-language message. */
  message: string;
  /** Element name(s) or XPath of the failing location. */
  location: string | null;
  /** Element(s) the rule reports on, e.g. "eHistory.05". */
  elements: string[];
  rule_id: string | null;
  /** false = informational (state file not enforced); shown but never blocks. Absent = enforced. */
  enforced?: boolean;
}

export interface ValidationResult {
  dataset: "DEM" | "EMS";
  findings: ValidationFinding[];
  error_count: number;
  warning_count: number;
  /** Findings from informational (non-enforced) rule sets. Not in error/warning counts. */
  informational_count?: number;
  can_finalize: boolean;
  /** Schematron files that ran, for display ("National 3.5.1…, Georgia …"). */
  rule_sets: { id: string; source: string; version: string | null; enforced?: boolean }[];
  validated_at: string;
}

function decode(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

const clean = (s: string) => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

export function roleToLevel(role: string | null | undefined): FindingLevel {
  const r = (role ?? "").toUpperCase();
  return r.includes("WARN") || r.includes("INFO") ? "WARNING" : "ERROR";
}

/** Turns an XPath like /*:EMSDataSet[...][1]/*:Header[...][1]/... into "EMSDataSet/Header/…". */
export function simplifyLocation(loc: string | null): string | null {
  if (!loc) return null;
  const parts = [...loc.matchAll(/\*:([A-Za-z0-9_.]+)\[namespace-uri\(\)='[^']*'\](?:\[(\d+)\])?/g)]
    .map((m) => (m[2] && m[2] !== "1" ? `${m[1]}[${m[2]}]` : m[1]));
  return parts.length ? parts.join("/") : loc;
}

/** Parses SVRL output (failed asserts and successful reports) into findings. */
export function parseSvrl(svrl: string, source: string): ValidationFinding[] {
  const out: ValidationFinding[] = [];
  const re = /<svrl:(failed-assert|successful-report)\b([^>]*)>([\s\S]*?)<\/svrl:\1>/g;
  for (const m of svrl.matchAll(re)) {
    const attrs = m[2];
    const attr = (n: string) => new RegExp(`\\b${n}="([^"]*)"`).exec(attrs)?.[1] ?? null;
    const text = /<svrl:text>([\s\S]*?)<\/svrl:text>/.exec(m[3])?.[1] ?? "";
    const diag = /<svrl:diagnostic-reference\b[^>]*>([\s\S]*?)<\/svrl:diagnostic-reference>/.exec(m[3])?.[1] ?? "";
    const elements = [...new Set([...clean(diag).matchAll(/\b([de][A-Z][A-Za-z]+\.\d{2,3})\b/g)].map((x) => x[1]))];
    out.push({
      level: roleToLevel(attr("role")),
      source,
      message: clean(text),
      location: simplifyLocation(attr("location") ? decode(attr("location")!) : null),
      elements,
      rule_id: attr("id"),
    });
  }
  return out;
}

/** libxml2 XSD errors -> findings (always ERROR). */
export function xsdFindings(errors: { message?: string; rawMessage?: string; loc?: { lineNumber?: number } | null }[]): ValidationFinding[] {
  return errors.map((e) => {
    const msg = (e.message ?? e.rawMessage ?? "Schema error").replace(/^.*?:\d+:\s*/, "").replace(/^element [^:]+: Schemas validity error : /, "").trim();
    const el = /Element '\{[^}]*\}([^']+)'/.exec(msg)?.[1] ?? null;
    return {
      level: "ERROR" as const,
      source: "XSD",
      message: msg.replace(/\{http:\/\/www\.nemsis\.org\}/g, ""),
      location: el ? `${el}${e.loc?.lineNumber ? ` (line ${e.loc.lineNumber})` : ""}` : (e.loc?.lineNumber ? `line ${e.loc.lineNumber}` : null),
      elements: el ? [el] : [],
      rule_id: null,
    };
  });
}

export function summarize(
  dataset: "DEM" | "EMS",
  findings: ValidationFinding[],
  rule_sets: ValidationResult["rule_sets"],
  now = new Date().toISOString(),
): ValidationResult {
  const gating = findings.filter((f) => f.enforced !== false);
  const error_count = gating.filter((f) => f.level === "ERROR").length;
  const warning_count = gating.length - error_count;
  const informational_count = findings.length - gating.length;
  return { dataset, findings, error_count, warning_count, informational_count, can_finalize: error_count === 0, rule_sets, validated_at: now };
}

export type FinalizeDecision = "block" | "confirm_warnings" | "proceed";

/**
 * Finalization gate. ERROR → block. WARNING only → show and require one
 * acknowledgement (a second click on the same result), then proceed.
 */
export function decideFinalization(result: ValidationResult, warningsAcknowledged: boolean): FinalizeDecision {
  if (result.error_count > 0) return "block";
  if (result.warning_count > 0 && !warningsAcknowledged) return "confirm_warnings";
  return "proceed";
}

/** Stable signature of a result's findings, so an acknowledgement only covers the warnings the user saw. */
export function findingsKey(result: ValidationResult): string {
  return result.findings.map((f) => `${f.level}|${f.source}|${f.rule_id}|${f.location}|${f.message}`).join("\n");
}

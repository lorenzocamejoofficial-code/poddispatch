/**
 * NEMSIS validation findings — pure parsing and finalization gating shared by
 * the in-app validation service (supabase/functions/nemsis-validate) and UI.
 *
 * Rule: any ERROR (XSD or Schematron [ERROR]/[FATAL]) blocks finalization;
 * WARNINGs are shown but finalization is allowed.
 */

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
}

export interface ValidationResult {
  dataset: "DEM" | "EMS";
  findings: ValidationFinding[];
  error_count: number;
  warning_count: number;
  can_finalize: boolean;
  /** Schematron files that ran, for display ("National 3.5.1…, Georgia …"). */
  rule_sets: { id: string; source: string; version: string | null }[];
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
  const error_count = findings.filter((f) => f.level === "ERROR").length;
  const warning_count = findings.length - error_count;
  return { dataset, findings, error_count, warning_count, can_finalize: error_count === 0, rule_sets, validated_at: now };
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

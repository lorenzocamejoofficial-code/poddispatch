/**
 * NEMSIS CTA (Compliance Testing Application) SOAP client helpers.
 * Pure functions only — no Deno/network APIs — so they are unit tested from src/.
 * Spec: https://cta.nemsis.org/ComplianceTestingWs/endpoints/compliancetestingws.wsdl
 * (SOAP 1.1 document/literal, namespace http://ws.nemsis.org/, credentials in body.)
 */

export const CTA_ENDPOINT = "https://cta.nemsis.org:443/ComplianceTestingWs/endpoints/";
export const CTA_NS = "http://ws.nemsis.org/";
export const SOAP_ACTIONS = {
  SubmitData: "http://ws.nemsis.org/SubmitData",
  RetrieveStatus: "http://ws.nemsis.org/RetrieveStatus",
  QueryLimit: "http://ws.nemsis.org/QueryLimit",
} as const;

/** 61 = EMS, 62 = DEM (Demographics) per WSDL NemsisDataSchema. */
export const DATA_SCHEMA = { EMS: 61, DEM: 62 } as const;

export interface CtaCredentials {
  username: string;
  password: string;
  organization: string;
}

export function xmlEscape(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function privilege(c: CtaCredentials): string {
  return (
    `<ws:username>${xmlEscape(c.username)}</ws:username>` +
    `<ws:password>${xmlEscape(c.password)}</ws:password>` +
    `<ws:organization>${xmlEscape(c.organization)}</ws:organization>`
  );
}

function envelope(body: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="${CTA_NS}">` +
    `<soapenv:Header/><soapenv:Body>${body}</soapenv:Body></soapenv:Envelope>`
  );
}

export function buildQueryLimitEnvelope(c: CtaCredentials): string {
  return envelope(
    `<ws:QueryLimitRequest>${privilege(c)}<ws:requestType>QueryLimit</ws:requestType></ws:QueryLimitRequest>`,
  );
}

export function stripXmlDeclaration(xml: string): string {
  return xml.replace(/^\uFEFF?\s*<\?xml[^?]*\?>\s*/, "");
}

export function buildSubmitDataEnvelope(
  c: CtaCredentials,
  payloadXml: string,
  dataSchema: number,
  schemaVersion: string,
  additionalInfo = "",
): string {
  return envelope(
    `<ws:SubmitDataRequest>${privilege(c)}` +
      `<ws:requestType>SubmitData</ws:requestType>` +
      `<ws:submitPayload><ws:payloadOfXmlElement>${stripXmlDeclaration(payloadXml)}</ws:payloadOfXmlElement></ws:submitPayload>` +
      `<ws:requestDataSchema>${dataSchema}</ws:requestDataSchema>` +
      `<ws:schemaVersion>${xmlEscape(schemaVersion)}</ws:schemaVersion>` +
      `<ws:additionalInfo>${xmlEscape(additionalInfo)}</ws:additionalInfo>` +
      `</ws:SubmitDataRequest>`,
  );
}

export function buildRetrieveStatusEnvelope(c: CtaCredentials, requestHandle: string): string {
  return envelope(
    `<ws:RetrieveStatusRequest>${privilege(c)}` +
      `<ws:requestType>RetrieveStatus</ws:requestType>` +
      `<ws:requestHandle>${xmlEscape(requestHandle)}</ws:requestHandle>` +
      `<ws:originalRequestType>SubmitData</ws:originalRequestType>` +
      `<ws:additionalInfo></ws:additionalInfo>` +
      `</ws:RetrieveStatusRequest>`,
  );
}

/** Masks the password element so request copies can be stored safely. */
export function redactPassword(xml: string): string {
  return xml.replace(/(<(?:\w+:)?password>)[\s\S]*?(<\/(?:\w+:)?password>)/g, "$1********$2");
}

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<(?:[\\w-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`));
  return m ? m[1].trim() : null;
}

export interface ParsedCtaResponse {
  statusCode: number | null;
  requestHandle: string | null;
  limit: number | null;
  fault: string | null;
  reportSummary: string | null;
}

export function parseCtaResponse(xml: string): ParsedCtaResponse {
  const faultString = tag(xml, "faultstring");
  const code = tag(xml, "statusCode");
  const limit = tag(xml, "limit");
  const parts: string[] = [];
  const server = tag(xml, "serverErrorMessage");
  if (server) parts.push(`Server: ${server}`);
  const xmlErrs = xml.match(/<(?:[\w-]+:)?xmlError(?:\s[^>]*)?>[\s\S]*?<\/(?:[\w-]+:)?xmlError>/g);
  if (xmlErrs?.length) parts.push(`${xmlErrs.length} XML validation error(s)`);
  const failed = xml.match(/<(?:[\w-]+:)?failed-assert\b/g) ?? xml.match(/<(?:[\w-]+:)?failedAssert\b/g);
  if (failed?.length) parts.push(`${failed.length} rule violation(s)`);
  return {
    statusCode: code !== null && /^-?\d+$/.test(code) ? Number(code) : null,
    requestHandle: tag(xml, "requestHandle"),
    limit: limit !== null && /^-?\d+$/.test(limit) ? Number(limit) : null,
    fault: faultString,
    reportSummary: parts.length ? parts.join("; ") : null,
  };
}

const CODE_LABELS: Record<number, string> = {
  [-1]: "Invalid username and/or password",
  [-2]: "Account not permitted to perform this operation",
  [-3]: "Account not permitted for this organization",
  [-4]: "Invalid parameter value",
  [-5]: "Invalid parameter combination",
  [-11]: "Rejected: the same file is already on the server",
  [-12]: "Rejected: XML failed schema validation",
  [-13]: "Rejected: FATAL-level rule violation",
  [-14]: "Rejected: ERROR-level rule violation",
  [-15]: "Rejected: critical ETL rule violation",
  [-16]: "Rejected: critical business-intelligence rule violation",
  [-20]: "CTA server error",
  [-21]: "CTA server database error",
  [-22]: "CTA server file/network error",
  [-30]: "Rejected: message too large",
  0: "Still processing — check status later",
  1: "Imported successfully",
  2: "Imported, with ERROR-level rule violations reported",
  3: "Imported, with WARNING-level rule violations reported",
};

export function describeCtaCode(code: number | null, operation?: string): string {
  if (code === null) return "No status code in response";
  if (operation === "QueryLimit" && code > 0) return "Login OK";
  if (CODE_LABELS[code]) return CODE_LABELS[code];
  if (code < -100) return `CTA custom error (${code})`;
  if (code > 100) return `CTA custom success (${code})`;
  return `Unknown code (${code})`;
}

/**
 * Transport probe: a deliberately minimal DEMDataSet built only from invented
 * values. Exists solely to prove a round trip reaches the CTA; it is expected
 * to be rejected by validation. Contains no tenant, patient or claim data.
 */
export function buildTransportProbeXml(): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<DEMDataSet xmlns="http://www.nemsis.org" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dAgency><dAgency.01>PROBE-0001</dAgency.01><dAgency.02>PROBE-0001</dAgency.02>` +
    `<dAgency.03>PodDispatch Transport Probe</dAgency.03><dAgency.04>13</dAgency.04></dAgency>` +
    `</DEMDataSet>`
  );
}

/** Replaces only the DemographicReport timeStamp attribute value. Nothing else changes. */
export function stampDemographicReportTimeStamp(xml: string, iso: string): string {
  const re = /(<DemographicReport\b[^>]*\btimeStamp=")[^"]*(")/;
  if (!re.test(xml)) throw new Error("DemographicReport timeStamp attribute not found");
  return xml.replace(re, `$1${iso}$2`);
}

/** ISO-8601 with local offset, seconds precision (NEMSIS dateTime format). */
export function nemsisNow(d = new Date(), offsetMinutes = 0): string {
  const t = new Date(d.getTime() + offsetMinutes * 60_000);
  const p = (n: number) => String(Math.abs(n)).padStart(2, "0");
  const sign = offsetMinutes >= 0 ? "+" : "-";
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}T${p(t.getUTCHours())}:${p(t.getUTCMinutes())}:${p(t.getUTCSeconds())}` +
    `${sign}${p(Math.trunc(offsetMinutes / 60))}:${p(offsetMinutes % 60)}`;
}

export interface CtaValidationError {
  kind: "schema" | "rule" | "server";
  level: string | null;
  path: string | null;
  message: string;
  line: number | null;
  rule: string | null;
}

function decode(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim();
}
function attr(open: string, name: string): string | null {
  const m = open.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? decode(m[1]) : null;
}
function child(block: string, names: string[]): string | null {
  for (const n of names) { const v = tag(block, n); if (v) return decode(v); }
  return null;
}

/** totalErrorCount from the CTA report, if present. */
export function parseTotalErrorCount(xml: string): number | null {
  const v = tag(xml, "totalErrorCount");
  return v !== null && /^\d+$/.test(v) ? Number(v) : null;
}

/** Extracts element-level XSD and Schematron errors the CTA reports. Tolerant of namespaces/escaping. */
export function extractCtaValidationErrors(rawXml: string): CtaValidationError[] {
  // Reports sometimes come back entity-escaped inside a text node — unescape once if so.
  const xml = /&lt;(?:[\w-]+:)?(?:xmlError|failed-assert|failedAssert)\b/.test(rawXml)
    ? rawXml.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
    : rawXml;
  const out: CtaValidationError[] = [];
  for (const m of xml.matchAll(/<(?:[\w-]+:)?xmlError\b([^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?xmlError>/g)) {
    const body = m[2];
    const line = child(body, ["lineNumber", "line"]) ?? attr(m[1], "lineNumber");
    out.push({
      kind: "schema",
      level: child(body, ["level", "severity"]) ?? "error",
      path: child(body, ["xpath", "location", "elementPath", "path"]) ?? attr(m[1], "location"),
      message: child(body, ["desc", "description", "message", "text"]) ?? decode(body),
      line: line && /^\d+$/.test(line) ? Number(line) : null,
      rule: null,
    });
  }
  for (const m of xml.matchAll(/<(?:[\w-]+:)?(?:failed-assert|failedAssert|successful-report)\b([^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?(?:failed-assert|failedAssert|successful-report)>/g)) {
    const body = m[2];
    out.push({
      kind: "rule",
      level: attr(m[1], "role") ?? attr(m[1], "flag"),
      path: attr(m[1], "location"),
      message: child(body, ["text"]) ?? decode(body),
      line: null,
      rule: attr(m[1], "id") ?? attr(m[1], "test"),
    });
  }
  const server = tag(xml, "serverErrorMessage");
  if (server) out.push({ kind: "server", level: "error", path: null, message: decode(server), line: null, rule: null });
  return out.slice(0, 500);
}

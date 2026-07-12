/**
 * Minimal XML builder for NEMSIS payloads. Zero deps, browser + edge safe.
 * We hand-roll instead of pulling in a heavy DOM library because NEMSIS
 * eRecord shape is small, deterministic, and easier to unit-test as strings.
 */

const AMP  = /&/g;
const LT   = /</g;
const GT   = />/g;
const QUOT = /"/g;
const APOS = /'/g;

/** Escape a value for use inside an XML text node or attribute. */
export function xmlEscape(v: unknown): string {
  if (v == null) return "";
  return String(v)
    .replace(AMP, "&amp;")
    .replace(LT, "&lt;")
    .replace(GT, "&gt;")
    .replace(QUOT, "&quot;")
    .replace(APOS, "&apos;");
}

export type XmlAttrs = Record<string, string | number | null | undefined>;

/** Emit `<tag ...attrs>children</tag>`. If `children` is null/undefined
 *  or empty, emits a NEMSIS "not-value" self-closed placeholder that the
 *  NEMSIS schema treats as an intentional missing value with reason. */
export function el(
  tag: string,
  attrs: XmlAttrs | null,
  children: string | null | undefined,
): string {
  const attrStr = attrs
    ? Object.entries(attrs)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => ` ${k}="${xmlEscape(v)}"`)
        .join("")
    : "";
  if (children == null || children === "") {
    // NEMSIS uses xsi:nil for known-not-recorded fields.
    return `<${tag}${attrStr} xsi:nil="true" NV="7701003"/>`;
  }
  return `<${tag}${attrStr}>${children}</${tag}>`;
}

/** Wrap an already-rendered child list in a parent element without escaping. */
export function wrap(tag: string, attrs: XmlAttrs | null, inner: string): string {
  const attrStr = attrs
    ? Object.entries(attrs)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => ` ${k}="${xmlEscape(v)}"`)
        .join("")
    : "";
  return `<${tag}${attrStr}>${inner}</${tag}>`;
}
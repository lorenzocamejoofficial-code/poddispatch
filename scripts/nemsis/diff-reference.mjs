#!/usr/bin/env node
/**
 * Compare two NEMSIS XMLs as ordered (element-path, attrs, text) entries.
 * Usage: node scripts/nemsis/diff-reference.mjs <ours.xml> <reference.xml>
 *
 * Normalized away: every UUID attribute value, DemographicReport@timeStamp,
 * schemaLocation/xmlns attributes, and software identity (dRecord*, and
 * eRecord.SoftwareApplicationGroup / eRecord.02-.04). eRecord.01 must match.
 * Reports entries in the reference that are missing/different in ours, and
 * extra entries in ours. Exit 1 if any difference.
 */
import { readFileSync } from "node:fs";

function entries(xml) {
  const src = xml.replace(/<\?[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  const out = [];
  const stack = [];
  const re = /<(\/?)([A-Za-z_][\w.:-]*)((?:\s+[\w:.-]+\s*=\s*"[^"]*")*)\s*(\/?)>|([^<]+)/g;
  let m, pendingText = "";
  while ((m = re.exec(src))) {
    if (m[5] !== undefined) { pendingText += m[5]; continue; }
    const [, close, name, rawAttrs, selfClose] = m;
    if (close) {
      const top = stack.pop();
      if (top && top.leaf) top.entry.text = pendingText.trim();
      if (stack.length) stack[stack.length - 1].leaf = false;
      pendingText = "";
      continue;
    }
    if (stack.length) stack[stack.length - 1].leaf = false;
    pendingText = "";
    const attrs = [...rawAttrs.matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)]
      .filter(([, k]) => !k.startsWith("xmlns") && k !== "xsi:schemaLocation")
      .map(([, k, v]) => {
        if (k === "UUID") return `${k}=<uuid>`;
        if (name === "DemographicReport" && k === "timeStamp") return `${k}=<timestamp>`;
        return `${k}=${v}`;
      });
    const path = [...stack.map((s) => s.name), name].join("/");
    const entry = { path, attrs: attrs.join(" "), text: "" };
    if (!/(^|\/)dRecord(\.|\/|$)/.test(path) && !/(^|\/)eRecord\.(SoftwareApplicationGroup|0[234])(\/|$)/.test(path)) out.push(entry);
    if (!selfClose) stack.push({ name, entry, leaf: true });
  }
  return out.map((e) => `${e.path}${e.attrs ? ` [${e.attrs}]` : ""}${e.text ? ` = ${e.text}` : ""}`);
}

/** LCS-based ordered diff. */
function diff(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push(["+ extra in ours   ", a[i++]]);
    else ops.push(["- missing in ours ", b[j++]]);
  }
  while (i < n) ops.push(["+ extra in ours   ", a[i++]]);
  while (j < m) ops.push(["- missing in ours ", b[j++]]);
  return ops;
}

const [oursPath, refPath] = process.argv.slice(2);
if (!oursPath || !refPath) { console.error("usage: diff-reference.mjs <ours.xml> <reference.xml>"); process.exit(2); }
const ours = entries(readFileSync(oursPath, "utf8"));
const ref = entries(readFileSync(refPath, "utf8"));
const ops = diff(ours, ref);
console.log(`ours: ${ours.length} entries, reference: ${ref.length} entries (after normalization)`);
for (const [k, v] of ops) console.log(`${k}${v}`);
console.log(ops.length ? `DIFF: ${ops.length} difference(s)` : "DIFF: 0 differences — data matches reference");
process.exit(ops.length ? 1 : 0);

/**
 * Drift guard: the database trigger functions normalize_transport_kind /
 * normalize_payer_class must agree with the TS normalizers on every input.
 * Runs against the live database when PG* env vars are present (sandbox);
 * skipped otherwise, with a visible skip.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { normalizeTransportKind } from "./transport-vocabulary";
import { normalizePayerClass } from "./payer-class";

const HAS_DB = !!process.env.PGHOST;

const TRANSPORT_INPUTS = [
  "dialysis", "nemt_dialysis", "ift", "ift_general", "discharge", "ift_discharge", "outpatient",
  "outpatient_specialty", "wound_care", "woundcare", "ift_wound_care", "psych", "psych_transport",
  "behavioral", " PSYCH_TRANSPORT ", "Dialysis", "private_pay", "emergency", "complex", "adhoc",
  "hospital", "other", "", "garbage", "wound", "psych transport",
];
const PAYER_INPUTS = [
  "medicare", "medicaid", "commercial", "private", "insurance", "private_insurance", "facility",
  "facility_contract", "contract", "self_pay", "self-pay", "selfpay", "self", "cash", "private_pay",
  "private pay", "patient", "Medicare Part B", "GA Medicaid", " MEDICARE ", "", "default", "other",
  "bcbs", "aetna", "self pay", "Self Pay", "cash payment", "Cash", "private insurance", "facility contract",
  "SELF-PAY", "self  pay", "Private Pay", "selfpay ", "patient pay", "cash_pay", "privatepay", "Patient Responsibility",
];

function sqlMap(fn: string, inputs: string[]): (string | null)[] {
  const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
  const q = `select coalesce(public.${fn}(v)::text, '<null>') from unnest(array[${inputs.map(lit).join(",")}]::text[]) with ordinality as u(v, i) order by i`;
  const out = execFileSync("psql", ["-At", "-c", q], { encoding: "utf8" });
  return out.trim().split("\n").map((s) => (s === "<null>" ? null : s));
}

describe.skipIf(!HAS_DB)("SQL vs TS classification drift", () => {
  it("normalize_transport_kind == normalizeTransportKind", () => {
    const sql = sqlMap("normalize_transport_kind", TRANSPORT_INPUTS);
    TRANSPORT_INPUTS.forEach((v, i) => expect([v, sql[i]]).toEqual([v, normalizeTransportKind(v)]));
    expect(sqlMap("normalize_transport_kind", ["x"]).length).toBe(1);
  });
  it("normalize_payer_class == normalizePayerClass", () => {
    const sql = sqlMap("normalize_payer_class", PAYER_INPUTS);
    PAYER_INPUTS.forEach((v, i) => expect([v, sql[i]]).toEqual([v, normalizePayerClass(v)]));
  });
});

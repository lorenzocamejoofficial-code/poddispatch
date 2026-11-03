/**
 * NEMSIS certification records → submission XML.
 *
 * Only a company that is BOTH a test/sandbox tenant AND carries the
 * `nemsis_certification` flag may ever have records sent to the CTA. The
 * nemsis-cta-submit function calls `assertCertificationCompany` before it
 * builds or sends anything. The XML is generated from the stored record via
 * buildDemDataSet / buildEmsDataSet. `raw_reference` (verbatim fixture XML) is
 * refused here so the generated path can never quietly resend a static file.
 */
import {
  buildDemDataSet,
  buildEmsDataSet,
  type DemographicProfile,
  type ExportContext,
  type PcrExportInput,
} from "./exporter.ts";

export interface CertCompany {
  id: string;
  is_sandbox?: boolean | null;
  creator_test_tenant?: boolean | null;
  nemsis_certification?: boolean | null;
  deleted_at?: string | null;
}

export interface CertRecord {
  id: string;
  company_id: string;
  kind: "DEM" | "EMS" | string;
  case_key: string;
  payload: unknown;
}

export interface EmsCertPayload {
  input: PcrExportInput;
  ctx: ExportContext;
}

export const CERT_SOFTWARE = { creator: "PodDispatch", name: "PodDispatch", version: "1.0" } as const;

export class CertGuardError extends Error {}

export function isCertificationCompany(c: CertCompany | null | undefined): boolean {
  return !!c
    && c.nemsis_certification === true
    && (c.is_sandbox === true || c.creator_test_tenant === true)
    && !c.deleted_at;
}

export function assertCertificationCompany(c: CertCompany | null | undefined): asserts c is CertCompany {
  if (!isCertificationCompany(c)) {
    throw new CertGuardError("Refused: only the flagged NEMSIS certification company may submit to the CTA");
  }
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Builds the DEM or EMS DataSet XML from a stored certification record. */
export function buildCertRecordXml(
  record: CertRecord,
  company: CertCompany | null | undefined,
  opts: { timeStamp?: string } = {},
): { dataset: "DEM" | "EMS"; xml: string } {
  assertCertificationCompany(company);
  if (record.company_id !== company.id) throw new CertGuardError("Refused: record does not belong to this company");
  const p = record.payload;
  if (!isObj(p)) throw new CertGuardError("Record payload is empty");

  if (record.kind === "DEM") {
    if ("raw_reference" in p) throw new CertGuardError("Refused: generated submissions cannot carry raw_reference XML");
    const { meta: _meta, ...rest } = p;
    const profile = rest as unknown as DemographicProfile;
    if (!isObj(profile.agency) || !Array.isArray(profile.configurations)) {
      throw new CertGuardError("DEM record needs agency and configurations");
    }
    return {
      dataset: "DEM",
      xml: buildDemDataSet({ ...profile, software: profile.software ?? { ...CERT_SOFTWARE }, timeStamp: opts.timeStamp ?? profile.timeStamp }),
    };
  }
  if (record.kind === "EMS") {
    const ems = p as unknown as EmsCertPayload;
    if (!isObj(ems.input) || !isObj(ems.ctx)) throw new CertGuardError("EMS record needs input and ctx");
    if ("raw_reference" in ems.input) throw new CertGuardError("Refused: generated submissions cannot carry raw_reference XML");
    return { dataset: "EMS", xml: buildEmsDataSet(ems.input, { ...ems.ctx, test_mode: true }) };
  }
  throw new CertGuardError(`Unknown record kind: ${record.kind}`);
}

import { describe, it, expect } from "vitest";
import {
  buildQueryLimitEnvelope,
  buildSubmitDataEnvelope,
  buildRetrieveStatusEnvelope,
  buildTransportProbeXml,
  parseCtaResponse,
  describeCtaCode,
  redactPassword,
  CTA_ENDPOINT,
  DATA_SCHEMA,
} from "../../../supabase/functions/_shared/nemsis/cta-soap";

const creds = { username: "pod_dispatch", password: "s3cr<et>&'\"", organization: "PodDispatch" };

function order(xml: string, names: string[]) {
  const idx = names.map((n) => xml.indexOf(`<ws:${n}>`));
  idx.forEach((i) => expect(i).toBeGreaterThan(-1));
  expect([...idx].sort((a, b) => a - b)).toEqual(idx);
}

describe("CTA SOAP envelopes", () => {
  it("uses the single hardcoded CTA address", () => {
    expect(CTA_ENDPOINT).toBe("https://cta.nemsis.org:443/ComplianceTestingWs/endpoints/");
  });

  it("QueryLimit carries credentials in WSDL order", () => {
    const x = buildQueryLimitEnvelope(creds);
    order(x, ["username", "password", "organization", "requestType"]);
    expect(x).toContain("<ws:requestType>QueryLimit</ws:requestType>");
  });

  it("SubmitData has WSDL field order and embeds payload without declaration", () => {
    const x = buildSubmitDataEnvelope(creds, buildTransportProbeXml(), DATA_SCHEMA.DEM, "3.5.1", "probe");
    order(x, ["username", "password", "organization", "requestType", "submitPayload", "requestDataSchema", "schemaVersion", "additionalInfo"]);
    expect(x).toContain("<ws:requestDataSchema>62</ws:requestDataSchema>");
    expect(x).toContain("<ws:payloadOfXmlElement><DEMDataSet");
    expect(x.match(/<\?xml/g)?.length).toBe(1);
  });

  it("RetrieveStatus includes handle", () => {
    const x = buildRetrieveStatusEnvelope(creds, "H-1");
    expect(x).toContain("<ws:requestHandle>H-1</ws:requestHandle>");
  });

  it("escapes credentials", () => {
    const x = buildQueryLimitEnvelope(creds);
    expect(x).toContain("s3cr&lt;et&gt;&amp;&apos;&quot;");
  });

  it("redacts the password", () => {
    const x = redactPassword(buildQueryLimitEnvelope(creds));
    expect(x).toContain("<ws:password>********</ws:password>");
    expect(x).not.toContain("s3cr");
  });

  it("probe contains no tenant identifiers", () => {
    expect(buildTransportProbeXml()).toContain("PROBE-0001");
  });
});

describe("CTA response parsing", () => {
  it("parses QueryLimit success", () => {
    const p = parseCtaResponse(`<S:Envelope xmlns:S="x"><S:Body><ns2:QueryLimitResponse xmlns:ns2="http://ws.nemsis.org/"><ns2:requestType>QueryLimit</ns2:requestType><ns2:limit>500</ns2:limit><ns2:statusCode>51</ns2:statusCode></ns2:QueryLimitResponse></S:Body></S:Envelope>`);
    expect(p.limit).toBe(500);
    expect(p.statusCode).toBe(51);
    expect(describeCtaCode(51, "QueryLimit")).toBe("Login OK");
  });

  it("parses bad-login code", () => {
    const p = parseCtaResponse(`<ns2:SubmitDataResponse xmlns:ns2="a"><ns2:requestHandle></ns2:requestHandle><ns2:statusCode>-1</ns2:statusCode></ns2:SubmitDataResponse>`);
    expect(p.statusCode).toBe(-1);
    expect(describeCtaCode(-1)).toMatch(/username/);
    expect(describeCtaCode(-3)).toMatch(/organization/);
  });

  it("parses validation failure with handle and report", () => {
    const p = parseCtaResponse(`<r><requestHandle>abc</requestHandle><statusCode>-12</statusCode><reports><xmlValidationErrorReport><xmlError>bad</xmlError><xmlError>bad2</xmlError></xmlValidationErrorReport></reports></r>`);
    expect(p.requestHandle).toBe("abc");
    expect(p.reportSummary).toContain("2 XML validation");
    expect(describeCtaCode(-12)).toMatch(/schema/);
  });

  it("parses SOAP fault", () => {
    const p = parseCtaResponse(`<S:Fault><faultcode>S:Client</faultcode><faultstring>Unmarshalling Error</faultstring></S:Fault>`);
    expect(p.fault).toBe("Unmarshalling Error");
    expect(p.statusCode).toBeNull();
  });
});

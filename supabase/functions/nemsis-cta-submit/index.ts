/**
 * nemsis-cta-submit — creator-only NEMSIS CTA test harness transport.
 * Never reads tenant data: payloads come only from built-in fixtures/probe.
 * Sends only to the single hardcoded CTA_ENDPOINT. Password never logged.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  CTA_ENDPOINT,
  DATA_SCHEMA,
  SOAP_ACTIONS,
  buildQueryLimitEnvelope,
  buildRetrieveStatusEnvelope,
  buildSubmitDataEnvelope,
  buildTransportProbeXml,
  describeCtaCode,
  parseCtaResponse,
  redactPassword,
  type CtaCredentials,
  stampDemographicReportTimeStamp,
  nemsisNow,
  parseTotalErrorCount,
  extractCtaValidationErrors,
} from "../_shared/nemsis/cta-soap.ts";
import { DEM1_SUBMISSION_XML } from "../_shared/nemsis/fixtures/dem1-submission.ts";
import { EMS1_SUBMISSION_XML } from "../_shared/nemsis/fixtures/ems1-submission.ts";
import { EMS2_SUBMISSION_XML } from "../_shared/nemsis/fixtures/ems2-submission.ts";
import { EMS3_SUBMISSION_XML } from "../_shared/nemsis/fixtures/ems3-submission.ts";
import { EMS4_SUBMISSION_XML } from "../_shared/nemsis/fixtures/ems4-submission.ts";
import { EMS5_SUBMISSION_XML } from "../_shared/nemsis/fixtures/ems5-submission.ts";

const SCHEMA_VERSION = "3.5.1";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ping") }),
  z.object({ action: z.literal("submit"), test_case: z.enum(["TRANSPORT_PROBE", "DEM1", "EMS1", "EMS2", "EMS3", "EMS4", "EMS5"]) }),
  z.object({ action: z.literal("status"), request_handle: z.string().min(1).max(200) }),
]);

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Creator-only gate: validated JWT + system_creators membership.
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: u, error: uErr } = await admin.auth.getUser(auth.replace("Bearer ", ""));
  if (uErr || !u?.user) return json({ error: "Unauthorized" }, 401);
  const createdBy = u.user.id;
  const { data: sc, error: scErr } = await admin.from("system_creators").select("user_id").eq("user_id", createdBy).maybeSingle();
  if (scErr) return json({ error: "Creator check failed" }, 500);
  if (!sc) return json({ error: "Forbidden — system creators only" }, 403);

  let raw: unknown;
  try { raw = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const body = parsed.data;

  const password = Deno.env.get("NEMSIS_CTA_PASSWORD");
  const username = Deno.env.get("NEMSIS_CTA_USERNAME");
  if (!password || !username) {
    return json({ error: "NEMSIS CTA credentials are not configured (NEMSIS_CTA_USERNAME / NEMSIS_CTA_PASSWORD)." }, 412);
  }
  const creds: CtaCredentials = {
    username,
    password,
    organization: Deno.env.get("NEMSIS_CTA_ORGANIZATION") || "PodDispatch",
  };


  let operation: "QueryLimit" | "SubmitData" | "RetrieveStatus";
  let testCase: string;
  let envelopeXml: string;
  let dataSchema: number | null = null;
  let schemaVersion: string | null = null;
  let sentTimestamp: string | null = null;

  if (body.action === "ping") {
    operation = "QueryLimit"; testCase = "PING";
    envelopeXml = buildQueryLimitEnvelope(creds);
  } else if (body.action === "submit") {
    operation = "SubmitData"; testCase = body.test_case;
    dataSchema = (body.test_case === "EMS1" || body.test_case === "EMS2" || body.test_case === "EMS3" || body.test_case === "EMS4" || body.test_case === "EMS5") ? DATA_SCHEMA.EMS : DATA_SCHEMA.DEM;
    schemaVersion = SCHEMA_VERSION;
    if (body.test_case === "EMS1") {
      // EMS: no envelope timestamp — sent exactly as committed.
      envelopeXml = buildSubmitDataEnvelope(creds, EMS1_SUBMISSION_XML, dataSchema, schemaVersion, "PodDispatch 2026 EMS 1");
    } else if (body.test_case === "EMS2") {
      // EMS: no envelope timestamp — sent exactly as committed.
      envelopeXml = buildSubmitDataEnvelope(creds, EMS2_SUBMISSION_XML, dataSchema, schemaVersion, "PodDispatch 2026 EMS 2");
    } else if (body.test_case === "EMS3") {
      // EMS: no envelope timestamp — sent exactly as committed.
      envelopeXml = buildSubmitDataEnvelope(creds, EMS3_SUBMISSION_XML, dataSchema, schemaVersion, "PodDispatch 2026 EMS 3");
    } else if (body.test_case === "EMS4") {
      // EMS: no envelope timestamp — sent exactly as committed.
      envelopeXml = buildSubmitDataEnvelope(creds, EMS4_SUBMISSION_XML, dataSchema, schemaVersion, "PodDispatch 2026 EMS 4");
    } else if (body.test_case === "EMS5") {
      // EMS: no envelope timestamp — sent exactly as committed.
      envelopeXml = buildSubmitDataEnvelope(creds, EMS5_SUBMISSION_XML, dataSchema, schemaVersion, "PodDispatch 2026 EMS 5");
    } else if (body.test_case === "DEM1") {
      // Only runtime mutation: stamp the real send time on DemographicReport.
      sentTimestamp = nemsisNow();
      const payload = stampDemographicReportTimeStamp(DEM1_SUBMISSION_XML, sentTimestamp);
      envelopeXml = buildSubmitDataEnvelope(creds, payload, dataSchema, schemaVersion, "PodDispatch 2026 DEM 1");
    } else {
      envelopeXml = buildSubmitDataEnvelope(creds, buildTransportProbeXml(), dataSchema, schemaVersion, "PodDispatch transport probe");
    }
  } else {
    operation = "RetrieveStatus"; testCase = "STATUS";
    envelopeXml = buildRetrieveStatusEnvelope(creds, body.request_handle);
  }

  let httpStatus: number | null = null;
  let responseXml: string | null = null;
  let errorMessage: string | null = null;
  try {
    const res = await fetch(CTA_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: `"${SOAP_ACTIONS[operation]}"` },
      body: envelopeXml,
      signal: AbortSignal.timeout(30_000),
    });
    httpStatus = res.status;
    responseXml = await res.text();
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : String(e);
  }

  const p = responseXml ? parseCtaResponse(responseXml) : null;
  if (p?.fault) errorMessage = `SOAP fault: ${p.fault}`;
  const statusLabel = errorMessage && !p?.statusCode && p?.statusCode !== 0
    ? (p?.fault ? "SOAP fault" : "Network error")
    : describeCtaCode(p?.statusCode ?? null, operation);

  const row = {
    test_case: testCase,
    operation,
    data_schema: dataSchema,
    schema_version: schemaVersion,
    request_xml_redacted: redactPassword(envelopeXml),
    response_xml: responseXml ? redactPassword(responseXml).slice(0, 500_000) : null,
    http_status: httpStatus,
    status_code: p?.statusCode ?? null,
    status_label: statusLabel,
    request_handle: p?.requestHandle ?? null,
    limit_value: p?.limit ?? null,
    error_message: errorMessage ? errorMessage.replaceAll(password, "********") : null,
    total_error_count: responseXml ? parseTotalErrorCount(responseXml) : null,
    validation_errors: responseXml ? extractCtaValidationErrors(responseXml) : [],
    sent_timestamp: sentTimestamp,
    created_by: createdBy,
  };
  const { data: saved, error: insErr } = await admin
    .from("nemsis_cta_submissions").insert(row).select("id").single();
  if (insErr) return json({ error: `CTA call made but log save failed: ${insErr.message}`, result: { ...row, request_xml_redacted: undefined } }, 500);

  return json({
    id: saved.id,
    operation,
    test_case: testCase,
    http_status: httpStatus,
    status_code: row.status_code,
    status_label: statusLabel,
    request_handle: row.request_handle,
    limit: row.limit_value,
    report_summary: p?.reportSummary ?? null,
    error: row.error_message,
    total_error_count: row.total_error_count,
    validation_errors: row.validation_errors,
    sent_timestamp: sentTimestamp,
  });
});

/**
 * nemsis-validate-unit — runs ONE validation unit (XSD, or one Schematron
 * file/part) for nemsis-validate. Separate function so the heavy work never
 * shares a worker with the orchestrator. Accepts only requests signed by
 * nemsis-validate (HMAC with a server-only key). Never calls the CTA.
 */
import { z } from "npm:zod@3.23.8";
import { runUnit } from "../_shared/nemsis/validation/engine.ts";
import { signUnitPayload } from "../_shared/nemsis/validation/unit-sig.ts";

const UnitBody = z.object({ action: z.literal("run_unit"), dataset: z.enum(["DEM", "EMS"]), unit: z.string().max(64), xml: z.string().max(5_000_000) });
const json = (p: unknown, status = 200) => new Response(JSON.stringify(p), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const sig = req.headers.get("x-unit-sig");
  const text = await req.text();
  if (!sig || sig !== await signUnitPayload(text)) return json({ error: "Unauthorized" }, 401);
  let body;
  try { body = UnitBody.safeParse(JSON.parse(text)); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!body.success) return json({ error: "Bad unit request" }, 400);
  return json(await runUnit(body.data.xml, body.data.dataset, body.data.unit));
});

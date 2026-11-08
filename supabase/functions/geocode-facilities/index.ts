// Geocodes FACILITY addresses only (facilities.address) via the US Census geocoder.
// HIPAA: callers pass facility IDs, never address strings; patient/residential
// addresses must never reach this function or Census (see AGENTS.md).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import {
  addressHash, geocodeWithCensus, nextRetryAt, normalizeAddress, type GeocodeResult,
} from "../_shared/geocode-census.ts";

const Body = z.union([
  z.object({ facility_ids: z.array(z.string().uuid()).min(1).max(50) }),
  z.object({ mode: z.literal("backfill") }),
]);

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const secret = Deno.env.get("GEOCODE_HASH_SECRET");
    if (!secret) return json({ error: "not configured" }, 500);
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "unauthorized" }, 401);
    const { data: companyId } = await userClient.rpc("get_my_company_id");
    if (!companyId) return json({ error: "no company" }, 403);

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let q = admin.from("facilities").select("id, address").eq("company_id", companyId).is("deleted_at", null);
    if ("facility_ids" in parsed.data) q = q.in("id", parsed.data.facility_ids);
    else q = q.limit(200);
    let { data: facilities, error } = await q;
    if (error && /deleted_at/.test(error.message)) {
      let q2 = admin.from("facilities").select("id, address").eq("company_id", companyId);
      if ("facility_ids" in parsed.data) q2 = q2.in("id", parsed.data.facility_ids); else q2 = q2.limit(200);
      ({ data: facilities, error } = await q2);
    }
    if (error) return json({ error: "facility read failed" }, 500);

    const results: Record<string, { lat: number; lng: number } | null> = {};
    const work: { id: string; hash: string; normalized: string }[] = [];
    for (const f of facilities ?? []) {
      const normalized = normalizeAddress(f.address);
      if (!normalized) { results[f.id] = null; continue; }
      work.push({ id: f.id, normalized, hash: await addressHash(secret, companyId, normalized) });
    }

    const hashes = [...new Set(work.map((w) => w.hash))];
    const { data: cached } = hashes.length
      ? await admin.from("geocode_cache").select("*").eq("company_id", companyId).in("address_hash", hashes)
      : { data: [] };
    const byHash = new Map((cached ?? []).map((r) => [r.address_hash, r]));
    const now = Date.now();
    const toFetch = new Map<string, string>(); // hash -> normalized
    for (const w of work) {
      const row = byHash.get(w.hash);
      const fresh = row && (row.status !== "error" || (row.next_retry_at && Date.parse(row.next_retry_at) > now));
      if (!fresh) toFetch.set(w.hash, w.normalized);
    }

    const fetched = new Map<string, GeocodeResult>();
    const queue = [...toFetch.entries()];
    await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        const [hash, normalized] = item;
        const r = await geocodeWithCensus(normalized);
        fetched.set(hash, r);
        const attempts = (byHash.get(hash)?.attempts ?? 0) + 1;
        const row = {
          company_id: companyId, address_hash: hash, lat: r.lat, lng: r.lng, status: r.status,
          source: "census", match_quality: r.match_quality, attempts,
          geocoded_at: new Date().toISOString(),
          next_retry_at: r.status === "error" ? nextRetryAt(attempts) : null,
        };
        const { error: upErr } = await admin.from("geocode_cache").upsert(row, { onConflict: "company_id,address_hash" });
        if (upErr) console.error("geocode_cache upsert failed:", upErr.message);
        byHash.set(hash, row);
      }
    }));

    for (const w of work) {
      const row = byHash.get(w.hash);
      results[w.id] = row?.status === "matched" && row.lat != null && row.lng != null ? { lat: row.lat, lng: row.lng } : null;
    }
    console.log(`geocode-facilities: ${work.length} facilities, ${fetched.size} census calls`);
    return json({ results });
  } catch (e) {
    console.error("geocode-facilities error:", e instanceof Error ? e.message : "unknown");
    return json({ error: "internal" }, 500);
  }
});

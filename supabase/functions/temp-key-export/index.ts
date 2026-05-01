import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const password = url.searchParams.get("p");
  if (password !== "lorenzo-temp-key-fetch-2026") {
    return new Response("Unauthorized", { status: 401 });
  }
  return new Response(JSON.stringify({
    SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  }, null, 2), { headers: { "Content-Type": "application/json" } });
});
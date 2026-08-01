import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verifies that the caller is an authenticated system creator.
 * Returns an admin (service-role) client on success, or an error + status.
 */
export async function requireSystemCreator(
  req: Request,
): Promise<
  | { admin: ReturnType<typeof createClient>; error?: undefined }
  | { admin?: undefined; error: string; status: number }
> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Unauthorized", status: 401 };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) {
    return { error: "Unauthorized", status: 401 };
  }
  const userId = claimsData.claims.sub as string;

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: sc, error: scErr } = await admin
    .from("system_creators")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (scErr) return { error: scErr.message, status: 500 };
  if (!sc) return { error: "Forbidden — system creators only", status: 403 };

  return { admin };
}
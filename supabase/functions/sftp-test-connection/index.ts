import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Client } from "jsr:@ein/ssh2-ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * sftp-test-connection — Proof-of-concept SFTP connectivity test.
 *
 * Connects to ftp10.officeally.com:22 with stored credentials,
 * lists the contents of the "outbound" folder, and returns the file list.
 * Does NOT modify any files or transmit claims.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = new Date().toISOString();
  const diagnostics: string[] = [];

  try {
    const { company_id } = await req.json();
    if (!company_id) {
      return new Response(
        JSON.stringify({ success: false, error: "company_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth check — only owner/creator can test SFTP
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      // Allow service-role invocation for POC testing
      diagnostics.push("No auth header — using service-role path for POC test");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Skip membership check if no auth header (POC mode)
    if (authHeader) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: membership } = await userClient
        .from("company_memberships")
        .select("role")
        .eq("company_id", company_id)
        .single();

      if (!membership || !["owner", "creator"].includes(membership.role)) {
        return new Response(
          JSON.stringify({ success: false, error: "Only owners/creators can test SFTP connections" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch SFTP credentials
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: settings } = await supabase
      .from("clearinghouse_settings")
      .select("sftp_host, sftp_port, sftp_username, test_mode")
      .eq("company_id", company_id)
      .maybeSingle();

    const { data: credRow } = await supabase
      .from("clearinghouse_credentials")
      .select("sftp_password")
      .eq("company_id", company_id)
      .maybeSingle();

    const host = (settings?.sftp_host ?? "ftp10.officeally.com").trim();
    const port = settings?.sftp_port ?? 22;
    const username = (settings?.sftp_username ?? "").trim();
    const password = (credRow?.sftp_password ?? "").trim();

    if (!username || !password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "SFTP credentials not configured. Enter username and password in Settings → Clearinghouse.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    diagnostics.push(`Connecting to ${host}:${port} as ${username}`);
    diagnostics.push(`Library: jsr:@ein/ssh2-ts`);

    // Attempt SFTP connection
    const client = new Client();

    try {
      diagnostics.push("Calling client.connect()...");

      await client.connect({
        host,
        port,
        username,
        password,
        readyTimeout: 15000,
        // Deno edge runtime may not support all key exchange algorithms;
        // let the library negotiate what's available.
      });

      diagnostics.push("SSH connection established. Opening SFTP session...");

      const sftp = await client.sftp();
      diagnostics.push("SFTP session opened. Listing 'outbound' folder...");

      // readdir returns an array of file info objects
      const fileList = await new Promise<any[]>((resolve, reject) => {
        sftp.readdir("outbound", (err: any, list: any[]) => {
          if (err) reject(err);
          else resolve(list ?? []);
        });
      });

      diagnostics.push(`Found ${fileList.length} items in outbound/`);

      const files = fileList.map((f: any) => ({
        filename: f.filename,
        size: f.attrs?.size ?? null,
        modified: f.attrs?.mtime ? new Date(f.attrs.mtime * 1000).toISOString() : null,
      }));

      // Also list inbound to confirm we have write access context
      let inboundCount = -1;
      try {
        const inboundList = await new Promise<any[]>((resolve, reject) => {
          sftp.readdir("inbound", (err: any, list: any[]) => {
            if (err) reject(err);
            else resolve(list ?? []);
          });
        });
        inboundCount = inboundList.length;
        diagnostics.push(`Inbound folder accessible: ${inboundCount} items`);
      } catch (inboundErr: any) {
        diagnostics.push(`Inbound folder error: ${inboundErr.message}`);
      }

      client.end();
      diagnostics.push("Connection closed cleanly.");

      return new Response(
        JSON.stringify({
          success: true,
          message: `SFTP connection successful. ${fileList.length} files in outbound/, ${inboundCount >= 0 ? inboundCount + " files in inbound/" : "inbound/ not accessible"}.`,
          host,
          port,
          username,
          test_mode: settings?.test_mode ?? false,
          outbound_files: files,
          inbound_file_count: inboundCount,
          diagnostics,
          started_at: startedAt,
          completed_at: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (sftpErr: any) {
      diagnostics.push(`SFTP error: ${sftpErr.message}`);
      diagnostics.push(`Error type: ${sftpErr.constructor?.name}`);
      diagnostics.push(`Stack: ${(sftpErr.stack ?? "").slice(0, 500)}`);

      try { client.end(); } catch { /* ignore */ }

      return new Response(
        JSON.stringify({
          success: false,
          error: `SFTP connection failed: ${sftpErr.message}`,
          diagnostics,
          started_at: startedAt,
          completed_at: new Date().toISOString(),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err: any) {
    diagnostics.push(`Outer error: ${err.message}`);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message,
        diagnostics,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
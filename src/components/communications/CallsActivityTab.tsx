import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { TablePagination } from "@/components/ui/table-pagination";
import { Filter, RefreshCw, Phone, PhoneIncoming, PhoneOutgoing, Play, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface CallRow {
  id: string;
  created_at: string;
  company_id: string | null;
  trip_id: string | null;
  truck_id: string | null;
  direction: string;
  event_type: string;
  status: string;
  call_status: string | null;
  call_type: string | null;
  patient_name: string | null;
  facility_name: string | null;
  to_number: string | null;
  from_number: string | null;
  message_text: string | null;
  error_message: string | null;
  twilio_call_sid: string | null;
  recording_url: string | null;
  recording_duration_seconds: number | null;
  retry_of_event_id: string | null;
  payload: any;
}

type StatusFilter = "all" | "sent" | "failed" | "queued";
type DirectionFilter = "all" | "outbound" | "inbound";

function rangeToSince(range: string): string {
  const d = new Date();
  if (range === "24h") d.setHours(d.getHours() - 24);
  else if (range === "7d") d.setDate(d.getDate() - 7);
  else if (range === "30d") d.setDate(d.getDate() - 30);
  else d.setDate(d.getDate() - 90);
  return d.toISOString();
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  sent: "default",
  queued: "secondary",
  failed: "destructive",
};

interface CallsActivityTabProps {
  isCreator: boolean;
  companies: { id: string; name: string }[];
}

export function CallsActivityTab({ isCreator, companies }: CallsActivityTabProps) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CallRow[]>([]);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [phone, setPhone] = useState("");
  const [range, setRange] = useState("7d");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("comms_events" as any)
      .select("*")
      .gte("created_at", rangeToSince(range))
      .order("created_at", { ascending: false })
      .limit(500);
    if (status !== "all") q = q.eq("status", status);
    if (direction !== "all") q = q.eq("direction", direction);
    if (companyFilter !== "all") q = q.eq("company_id", companyFilter);
    if (phone.trim()) {
      const p = `%${phone.trim()}%`;
      q = q.or(`to_number.ilike.${p},from_number.ilike.${p}`);
    }
    const { data, error } = await q;
    if (error) { console.error(error); setRows([]); }
    else setRows(((data as any[]) ?? []) as CallRow[]);
    setLoading(false);
  }, [status, direction, phone, range, companyFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [status, direction, range, companyFilter, phone]);

  const stats = useMemo(() => ({
    total: rows.length,
    sent: rows.filter(r => r.status === "sent").length,
    failed: rows.filter(r => r.status === "failed").length,
    inbound: rows.filter(r => r.direction === "inbound").length,
  }), [rows]);

  const companyName = (id: string | null) => {
    if (!id) return "—";
    return companies.find(c => c.id === id)?.name || id.slice(0, 8);
  };

  const playRecording = async (row: CallRow) => {
    if (!row.recording_url) return;
    if (playingId === row.id) {
      setPlayingId(null);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      return;
    }
    try {
      setPlayingId(row.id);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/twilio-recording-proxy?id=${row.id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(`Failed to load recording (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(url);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to play recording");
      setPlayingId(null);
    }
  };

  const retryCall = async (row: CallRow) => {
    const toNumber = row.to_number ?? (row.payload?.target_phone as string | undefined);
    if (!toNumber || !row.message_text) {
      toast.error("Missing phone or message — cannot retry");
      return;
    }
    setRetryingId(row.id);
    try {
      const { data: companyData } = await supabase.rpc("get_my_company_id");
      const { data: settings } = await supabase
        .from("company_settings")
        .select("verified_caller_id")
        .eq("company_id", companyData as string)
        .maybeSingle();
      const verifiedCallerId = (settings as any)?.verified_caller_id ?? null;
      const { data: { user } } = await supabase.auth.getUser();

      const { data: inserted, error: insErr } = await supabase
        .from("comms_events" as any)
        .insert({
          company_id: companyData,
          trip_id: row.trip_id,
          truck_id: row.truck_id,
          event_type: row.call_type ? `call_${row.call_type}` : "call_retry",
          call_type: row.call_type,
          patient_name: row.patient_name,
          facility_name: row.facility_name,
          message_text: row.message_text,
          to_number: toNumber,
          queued_by: user?.id,
          queued_at: new Date().toISOString(),
          status: "queued",
          direction: "outbound",
          retry_of_event_id: row.id,
          payload: { ...(row.payload ?? {}), retry_of: row.id },
        } as any)
        .select("id").single();
      if (insErr || !inserted) throw insErr ?? new Error("Insert failed");
      const newId = (inserted as any).id as string;

      const { data: cd, error: ce } = await supabase.functions.invoke("make-outbound-call", {
        body: { comms_event_id: newId, to_number: toNumber, script: row.message_text, from_number_override: verifiedCallerId },
      });
      if (ce || (cd && cd.ok === false)) {
        const msg = ce?.message ?? cd?.error ?? "Retry failed";
        await supabase.from("comms_events" as any).update({ status: "failed", error_message: msg }).eq("id", newId);
        toast.error(`Retry failed: ${msg}`);
      } else {
        toast.success("Retry initiated");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Retry error");
    } finally {
      setRetryingId(null);
      load();
    }
  };

  const paged = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Completed" value={stats.sent} tone="success" />
        <StatCard label="Failed" value={stats.failed} tone="danger" />
        <StatCard label="Inbound" value={stats.inbound} tone="muted" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Date range</label>
              <Select value={range} onValueChange={setRange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Direction</label>
              <Select value={direction} onValueChange={(v) => setDirection(v as DirectionFilter)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="sent">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="queued">Queued</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Phone contains</label>
              <form onSubmit={(e) => { e.preventDefault(); load(); }}>
                <Input placeholder="+1404…" value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={load} />
              </form>
            </div>
            {isCreator && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Company</label>
                <Select value={companyFilter} onValueChange={setCompanyFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All companies</SelectItem>
                    {companies.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <ResponsiveTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Dir</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Recording</TableHead>
                  {isCreator && <TableHead>Company</TableHead>}
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={isCreator ? 8 : 7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={isCreator ? 8 : 7} className="text-center py-8 text-muted-foreground">No calls match these filters.</TableCell></TableRow>
                ) : paged.map(r => {
                  const isIn = r.direction === "inbound";
                  const name = r.patient_name ?? r.facility_name ?? (isIn ? "Inbound callback" : "Unknown");
                  const phoneShown = isIn ? r.from_number : r.to_number;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {format(new Date(r.created_at), "MMM d, HH:mm:ss")}
                      </TableCell>
                      <TableCell>
                        {isIn ? <PhoneIncoming className="h-3.5 w-3.5 text-primary" /> : <PhoneOutgoing className="h-3.5 w-3.5 text-muted-foreground" />}
                      </TableCell>
                      <TableCell className="text-xs">{name}</TableCell>
                      <TableCell className="font-mono text-xs">{phoneShown ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[r.status] || "outline"}>{r.call_status ?? r.status}</Badge>
                        {r.retry_of_event_id && <Badge variant="outline" className="ml-1 text-[9px]">retry</Badge>}
                      </TableCell>
                      <TableCell>
                        {r.recording_url ? (
                          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => playRecording(r)}>
                            <Play className="h-3 w-3" />
                            {r.recording_duration_seconds ? `${r.recording_duration_seconds}s` : "Play"}
                          </Button>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      {isCreator && <TableCell className="text-xs">{companyName(r.company_id)}</TableCell>}
                      <TableCell className="text-xs max-w-md">
                        {r.error_message ? (
                          <div className="space-y-1">
                            <span className="text-destructive">{r.error_message}</span>
                            {r.status === "failed" && r.direction === "outbound" && (
                              <Button size="sm" variant="outline" className="h-6 gap-1 text-[10px]"
                                disabled={retryingId === r.id}
                                onClick={() => retryCall(r)}>
                                <RotateCcw className="h-3 w-3" />
                                {retryingId === r.id ? "Retrying…" : "Retry"}
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground truncate block max-w-[18rem]" title={r.message_text ?? ""}>
                            {r.message_text ?? "—"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ResponsiveTable>
          {!loading && rows.length > 0 && (
            <TablePagination
              page={page}
              pageSize={pageSize}
              totalItems={rows.length}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          )}
        </CardContent>
      </Card>

      {playingId && audioUrl && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border bg-background shadow-lg p-3 flex items-center gap-3">
          <Phone className="h-4 w-4 text-primary" />
          <audio src={audioUrl} controls autoPlay onEnded={() => { setPlayingId(null); URL.revokeObjectURL(audioUrl); setAudioUrl(null); }} />
          <Button size="sm" variant="ghost" onClick={() => { setPlayingId(null); URL.revokeObjectURL(audioUrl); setAudioUrl(null); }}>Close</Button>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "success" | "danger" | "muted" }) {
  const color =
    tone === "success" ? "text-[hsl(var(--status-green))]" :
    tone === "danger" ? "text-destructive" :
    tone === "muted" ? "text-muted-foreground" :
    "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
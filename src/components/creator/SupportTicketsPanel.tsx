import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Mail, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface TicketRow {
  id: string;
  ticket_number: string | null;
  company_id: string;
  user_id: string;
  subject: string | null;
  severity: string;
  category: string | null;
  status: string;
  page_path: string | null;
  trying_to_do: string | null;
  what_happened: string | null;
  client_context: any;
  creator_notes: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

interface EnrichedTicket extends TicketRow {
  company_name?: string;
  submitter_name?: string;
  submitter_email?: string;
}

const SEVERITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

const sevColor = (s: string) => {
  if (s === "urgent") return "destructive";
  if (s === "high") return "default";
  return "secondary";
};

const statusColor = (s: string) => {
  if (s === "resolved" || s === "closed") return "outline";
  if (s === "in_progress") return "secondary";
  return "default";
};

export function SupportTicketsPanel() {
  const [tickets, setTickets] = useState<EnrichedTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("open_active");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<EnrichedTicket | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const list = (rows as TicketRow[]) ?? [];
    const companyIds = Array.from(new Set(list.map((t) => t.company_id)));
    const userIds = Array.from(new Set(list.map((t) => t.user_id)));
    const [{ data: companies }, { data: profiles }] = await Promise.all([
      supabase.from("companies").select("id, name").in("id", companyIds.length ? companyIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("profiles").select("id, full_name, email").in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    const companyMap = new Map((companies ?? []).map((c: any) => [c.id, c.name]));
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    setTickets(list.map((t) => ({
      ...t,
      company_name: companyMap.get(t.company_id) ?? "(unknown)",
      submitter_name: profileMap.get(t.user_id)?.full_name ?? "(unknown)",
      submitter_email: profileMap.get(t.user_id)?.email ?? "",
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets
      .filter((t) => {
        if (statusFilter === "open_active") {
          if (t.status === "resolved" || t.status === "closed") return false;
        } else if (statusFilter !== "all" && t.status !== statusFilter) {
          return false;
        }
        if (severityFilter !== "all" && t.severity !== severityFilter) return false;
        if (!q) return true;
        return (
          t.ticket_number?.toLowerCase().includes(q) ||
          t.subject?.toLowerCase().includes(q) ||
          t.company_name?.toLowerCase().includes(q) ||
          t.submitter_email?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const sd = (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9);
        if (sd !== 0) return sd;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [tickets, statusFilter, severityFilter, search]);

  const openCounts = useMemo(() => ({
    open: tickets.filter((t) => t.status === "open").length,
    in_progress: tickets.filter((t) => t.status === "in_progress").length,
    urgent: tickets.filter((t) => t.severity === "urgent" && t.status !== "resolved" && t.status !== "closed").length,
  }), [tickets]);

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from("support_tickets")
      .update({ status: newStatus })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Status → ${newStatus}`);
    await load();
    setSelected((s) => (s && s.id === id ? { ...s, status: newStatus } : s));
  };

  const saveNotes = async (id: string, notes: string) => {
    const { error } = await supabase.from("support_tickets")
      .update({ creator_notes: notes })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Notes saved");
    await load();
  };

  const sendReply = async (markResolved: boolean) => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("reply-support-ticket", {
        body: { ticket_id: selected.id, message: reply.trim(), mark_resolved: markResolved },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Send failed");
      toast.success(markResolved ? "Reply sent and ticket resolved" : "Reply sent");
      setReply("");
      await load();
      if (markResolved) setSelected(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default">Open: {openCounts.open}</Badge>
          <Badge variant="secondary">In progress: {openCounts.in_progress}</Badge>
          {openCounts.urgent > 0 && <Badge variant="destructive">Urgent: {openCounts.urgent}</Badge>}
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Search ticket #, subject, company, email…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open_active">Open + In progress</SelectItem>
              <SelectItem value="open">Open only</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severity</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading tickets…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">No tickets match the current filters.</div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Ticket</TableHead>
                  <TableHead className="w-24">Severity</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="w-40">Company</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-36">Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id} className="cursor-pointer" onClick={() => { setSelected(t); setReply(t.creator_notes ?? ""); }}>
                    <TableCell className="font-mono text-xs">{t.ticket_number ?? "—"}</TableCell>
                    <TableCell><Badge variant={sevColor(t.severity) as any} className="text-[10px] uppercase">{t.severity}</Badge></TableCell>
                    <TableCell className="max-w-md truncate">{t.subject ?? "(no subject)"}{t.category && <span className="ml-2 text-xs text-muted-foreground">[{t.category}]</span>}</TableCell>
                    <TableCell className="text-xs">{t.company_name}</TableCell>
                    <TableCell><Badge variant={statusColor(t.status) as any} className="text-[10px]">{t.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(t.created_at), "MMM d, h:mm a")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Sheet open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setReply(""); } }}>
          <SheetContent className="sm:max-w-xl overflow-y-auto">
            {selected && (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm text-muted-foreground">{selected.ticket_number}</span>
                    <Badge variant={sevColor(selected.severity) as any} className="text-[10px] uppercase">{selected.severity}</Badge>
                    <Badge variant={statusColor(selected.status) as any} className="text-[10px]">{selected.status}</Badge>
                  </SheetTitle>
                  <SheetDescription className="text-base text-foreground">{selected.subject ?? "(no subject)"}</SheetDescription>
                </SheetHeader>
                <div className="space-y-4 mt-4 text-sm">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div><div className="text-muted-foreground">Company</div><div>{selected.company_name}</div></div>
                    <div><div className="text-muted-foreground">Submitter</div><div>{selected.submitter_name} &lt;{selected.submitter_email}&gt;</div></div>
                    <div><div className="text-muted-foreground">Page</div><div className="font-mono break-all">{selected.page_path ?? "—"}</div></div>
                    <div><div className="text-muted-foreground">Category</div><div>{selected.category ?? "—"}</div></div>
                    <div><div className="text-muted-foreground">Submitted</div><div>{format(new Date(selected.created_at), "PPp")}</div></div>
                    <div><div className="text-muted-foreground">Updated</div><div>{format(new Date(selected.updated_at), "PPp")}</div></div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">What they were trying to do</div>
                    <div className="rounded-md border p-2 text-sm whitespace-pre-wrap">{selected.trying_to_do || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">What happened</div>
                    <div className="rounded-md border p-2 text-sm whitespace-pre-wrap">{selected.what_happened || "—"}</div>
                  </div>
                  {selected.client_context && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground">Client context</summary>
                      <pre className="rounded-md border p-2 mt-1 bg-muted/50 whitespace-pre-wrap break-all text-[11px]">{JSON.stringify(selected.client_context, null, 2)}</pre>
                    </details>
                  )}

                  <div className="border-t pt-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Status:</Label>
                      <Select value={selected.status} onValueChange={(v) => updateStatus(selected.id, v)}>
                        <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="reply" className="text-xs">Reply / creator notes</Label>
                      <Textarea id="reply" rows={5} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type your reply to the customer. This will be saved as creator notes and emailed if you click Send Reply." />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" disabled={!reply.trim()} onClick={() => saveNotes(selected.id, reply.trim())}>
                        Save notes only
                      </Button>
                      <Button size="sm" disabled={!reply.trim() || sending} onClick={() => sendReply(false)}>
                        <Mail className="h-3.5 w-3.5 mr-1" /> Send reply
                      </Button>
                      <Button size="sm" variant="default" disabled={!reply.trim() || sending} onClick={() => sendReply(true)}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Send + resolve
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </CardContent>
    </Card>
  );
}
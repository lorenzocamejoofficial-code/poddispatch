import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { Mail, Filter, RefreshCw, Phone } from "lucide-react";
import { format } from "date-fns";
import { TablePagination } from "@/components/ui/table-pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CallsActivityTab } from "@/components/communications/CallsActivityTab";

type Status = "all" | "pending" | "sent" | "failed" | "bounced" | "suppressed";

interface EmailLogRow {
  id: string;
  created_at: string;
  company_id: string | null;
  recipient_email: string;
  recipient_user_id: string | null;
  email_type: string;
  subject: string;
  from_address: string;
  from_name: string | null;
  status: string;
  resend_email_id: string | null;
  error_message: string | null;
  attempted_at: string;
  sent_at: string | null;
}

interface CompanyOption { id: string; name: string }

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  sent: "default",
  pending: "secondary",
  failed: "destructive",
  bounced: "destructive",
  suppressed: "outline",
};

function rangeToSinceISO(range: string): string {
  const now = new Date();
  const d = new Date(now);
  if (range === "24h") d.setHours(d.getHours() - 24);
  else if (range === "7d") d.setDate(d.getDate() - 7);
  else if (range === "30d") d.setDate(d.getDate() - 30);
  else d.setDate(d.getDate() - 90);
  return d.toISOString();
}

export default function EmailActivity() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EmailLogRow[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [isCreator, setIsCreator] = useState(false);

  // Filters
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [status, setStatus] = useState<Status>("all");
  const [recipient, setRecipient] = useState("");
  const [range, setRange] = useState<string>("7d");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: creator } = await supabase
        .from("system_creators")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      setIsCreator(!!creator);
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("email_send_log")
      .select("*")
      .gte("created_at", rangeToSinceISO(range))
      .order("created_at", { ascending: false })
      .limit(500);

    if (status !== "all") q = q.eq("status", status);
    if (companyFilter !== "all") q = q.eq("company_id", companyFilter);
    if (recipient.trim()) q = q.ilike("recipient_email", `%${recipient.trim()}%`);

    const { data, error } = await q;
    if (error) {
      console.error(error);
      setRows([]);
    } else {
      setRows((data || []) as EmailLogRow[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status, companyFilter, range]);
  useEffect(() => { setPage(1); }, [status, companyFilter, range, recipient]);

  // Load company list for the filter (only useful for creators)
  useEffect(() => {
    if (!isCreator) return;
    (async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, company_name")
        .order("company_name");
      setCompanies((data || []).map((c: any) => ({ id: c.id, name: c.company_name })));
    })();
  }, [isCreator]);

  const stats = useMemo(() => {
    const total = rows.length;
    const sent = rows.filter(r => r.status === "sent").length;
    const failed = rows.filter(r => ["failed", "bounced"].includes(r.status)).length;
    const pending = rows.filter(r => r.status === "pending").length;
    return { total, sent, failed, pending };
  }, [rows]);

  const companyName = (id: string | null) => {
    if (!id) return "—";
    return companies.find(c => c.id === id)?.name || id.slice(0, 8);
  };

  const pagedRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Mail className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold">Communications Activity</h1>
              <p className="text-sm text-muted-foreground">
                {isCreator
                  ? "All transactional emails and Twilio calls across every company."
                  : "Transactional emails and Twilio calls for your company."}
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="emails" className="space-y-6">
          <TabsList>
            <TabsTrigger value="emails" className="gap-2"><Mail className="h-4 w-4" /> Emails</TabsTrigger>
            <TabsTrigger value="calls" className="gap-2"><Phone className="h-4 w-4" /> Calls</TabsTrigger>
          </TabsList>

          <TabsContent value="emails" className="space-y-6">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Sent" value={stats.sent} tone="success" />
          <StatCard label="Failed" value={stats.failed} tone="danger" />
          <StatCard label="Pending" value={stats.pending} tone="muted" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
                <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="bounced">Bounced</SelectItem>
                    <SelectItem value="suppressed">Suppressed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Recipient email</label>
                <form onSubmit={(e) => { e.preventDefault(); load(); }}>
                  <Input
                    placeholder="search@example.com"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    onBlur={load}
                  />
                </form>
              </div>
              {isCreator && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Company</label>
                  <Select value={companyFilter} onValueChange={setCompanyFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All companies</SelectItem>
                      {companies.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
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
                    <TableHead>Type</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    {isCreator && <TableHead>Company</TableHead>}
                    <TableHead>Resend ID / Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={isCreator ? 7 : 6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow><TableCell colSpan={isCreator ? 7 : 6} className="text-center py-8 text-muted-foreground">No emails match these filters.</TableCell></TableRow>
                  ) : pagedRows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {format(new Date(r.created_at), "MMM d, HH:mm:ss")}
                      </TableCell>
                      <TableCell><Badge variant="outline">{r.email_type}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{r.recipient_email}</TableCell>
                      <TableCell className="max-w-xs truncate" title={r.subject}>{r.subject}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[r.status] || "outline"}>{r.status}</Badge>
                      </TableCell>
                      {isCreator && <TableCell className="text-xs">{companyName(r.company_id)}</TableCell>}
                      <TableCell className="text-xs max-w-md break-all">
                        {r.error_message
                          ? <span className="text-destructive">{r.error_message}</span>
                          : r.resend_email_id
                            ? <span className="font-mono text-muted-foreground">{r.resend_email_id}</span>
                            : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
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
          </TabsContent>

          <TabsContent value="calls">
            <CallsActivityTab isCreator={isCreator} companies={companies} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "success" | "danger" | "muted" }) {
  const color =
    tone === "success" ? "text-green-600" :
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
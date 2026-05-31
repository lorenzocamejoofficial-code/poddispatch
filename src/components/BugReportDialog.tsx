import { useEffect, useState } from "react";
import { Bug, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface BugReportDialogProps {
  currentPath: string;
  userId: string | undefined;
  /** Optional controlled open state. When provided, the built-in trigger button is hidden. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function BugReportButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" onClick={onClick} title="Report an Issue">
      <Bug className="h-4 w-4" />
    </Button>
  );
}

const SEVERITIES = ["low", "normal", "high", "urgent"] as const;
const CATEGORIES = ["billing", "dispatch", "clinical", "scheduling", "account", "other"] as const;

type TicketHistoryRow = {
  id: string;
  ticket_number: string | null;
  subject: string | null;
  status: string;
  severity: string;
  created_at: string;
  resolved_at: string | null;
};

export function BugReportDialog({ currentPath, userId, open: controlledOpen, onOpenChange }: BugReportDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen! : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const [pagePath, setPagePath] = useState(currentPath);
  const [subject, setSubject] = useState("");
  const [severity, setSeverity] = useState<typeof SEVERITIES[number]>("normal");
  const [category, setCategory] = useState<string>("");
  const [tryingToDo, setTryingToDo] = useState("");
  const [whatHappened, setWhatHappened] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<TicketHistoryRow[]>([]);

  const handleOpen = () => {
    setPagePath(currentPath);
    setSubject("");
    setSeverity("normal");
    setCategory("");
    setTryingToDo("");
    setWhatHappened("");
    setOpen(true);
  };

  // When opened via controlled prop, still reset the form fields once.
  useEffect(() => {
    if (open) setPagePath(currentPath);
  }, [open, currentPath]);

  useEffect(() => {
    if (!open || !userId) return;
    supabase
      .from("support_tickets")
      .select("id, ticket_number, subject, status, severity, created_at, resolved_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setHistory((data as TicketHistoryRow[]) ?? []));
  }, [open, userId]);

  const handleSubmit = async () => {
    if (!subject.trim() || !tryingToDo.trim() || !whatHappened.trim()) {
      toast.error("Subject, what you were trying to do, and what happened are all required");
      return;
    }
    setSubmitting(true);
    try {
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      if (!companyId) {
        toast.error("Could not determine your company");
        return;
      }
      const clientContext = {
        userAgent: navigator.userAgent,
        viewport: { w: window.innerWidth, h: window.innerHeight },
        url: window.location.href,
        timestamp: new Date().toISOString(),
      };
      const { data: inserted, error } = await supabase.from("support_tickets").insert({
        company_id: companyId,
        user_id: userId ?? "",
        page_path: pagePath,
        subject: subject.trim(),
        severity,
        category: category || null,
        client_context: clientContext,
        trying_to_do: tryingToDo.trim(),
        what_happened: whatHappened.trim(),
      }).select("id").single();
      if (error) throw error;
      // Fire notification (best-effort — don't block submission UX on it)
      if (inserted?.id) {
        supabase.functions.invoke("notify-support-ticket", {
          body: { ticket_id: inserted.id },
        }).catch((e) => console.error("notify-support-ticket failed", e));
      }
      toast.success("Report submitted, we will follow up within 24 hours");
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  const statusVariant = (s: string): "default" | "secondary" | "outline" | "destructive" => {
    if (s === "resolved" || s === "closed") return "outline";
    if (s === "in_progress") return "secondary";
    return "default";
  };

  return (
    <>
      {!isControlled && <BugReportButton onClick={handleOpen} />}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Report an Issue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="bug-subject">Subject</Label>
              <Input id="bug-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief summary of the issue" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="bug-severity">Severity</Label>
                <Select value={severity} onValueChange={(v) => setSeverity(v as typeof SEVERITIES[number])}>
                  <SelectTrigger id="bug-severity"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((s) => (
                      <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bug-category">Category (optional)</Label>
                <Select value={category || "_none"} onValueChange={(v) => setCategory(v === "_none" ? "" : v)}>
                  <SelectTrigger id="bug-category"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">—</SelectItem>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bug-page">What page were you on?</Label>
              <Input id="bug-page" value={pagePath} onChange={(e) => setPagePath(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bug-trying">What were you trying to do?</Label>
              <Textarea id="bug-trying" value={tryingToDo} onChange={(e) => setTryingToDo(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bug-happened">What happened instead?</Label>
              <Textarea id="bug-happened" value={whatHappened} onChange={(e) => setWhatHappened(e.target.value)} rows={3} />
            </div>

            {history.length > 0 && (
              <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-start gap-2 px-2">
                    {historyOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    My past tickets ({history.length})
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-2">
                  {history.map((t) => (
                    <div key={t.id} className="text-xs border rounded-md p-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-muted-foreground">{t.ticket_number ?? "—"}</span>
                          <Badge variant={statusVariant(t.status)} className="text-[10px]">{t.status}</Badge>
                        </div>
                        <div className="truncate font-medium mt-0.5">{t.subject ?? "(no subject)"}</div>
                        <div className="text-muted-foreground mt-0.5">{format(new Date(t.created_at), "MMM d, yyyy h:mm a")}</div>
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

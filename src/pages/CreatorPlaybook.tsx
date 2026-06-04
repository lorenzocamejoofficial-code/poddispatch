import { useEffect, useMemo, useState, useRef } from "react";
import { CreatorLayout } from "@/components/layout/CreatorLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { BookOpen, Sparkles, Plus, Send, Copy, AlertTriangle, Clock, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Category = "customer_billing" | "hipaa_phi" | "legal_regulatory" | "software_incident" | "ops_unexpected";
type Severity = "critical" | "high" | "medium" | "low";

interface Step { title: string; detail: string }
interface Script { label: string; body: string }
interface Ref { label: string; url: string }
interface Playbook {
  id: string; slug: string; category: Category; severity: Severity;
  title: string; summary: string; when_it_applies: string;
  steps: Step[]; scripts: Script[]; legal_clock: string | null; refs: Ref[];
  is_seeded: boolean;
}
interface Note { id: string; body: string; created_at: string }

const CATEGORY_LABEL: Record<Category, string> = {
  customer_billing: "Customer / Billing",
  hipaa_phi: "HIPAA / PHI",
  legal_regulatory: "Legal / Regulatory",
  software_incident: "Software Incidents",
  ops_unexpected: "Operations / Unexpected",
};

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "bg-destructive text-destructive-foreground",
  high: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30",
  low: "bg-muted text-muted-foreground border",
};

export default function CreatorPlaybook() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<Category | "all">("all");
  const [selected, setSelected] = useState<Playbook | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any).from("creator_playbooks").select("*").order("severity").order("title");
    if (error) { toast.error("Failed to load playbooks"); setLoading(false); return; }
    setPlaybooks((data ?? []) as Playbook[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return playbooks.filter(p => {
      if (activeCat !== "all" && p.category !== activeCat) return false;
      if (search) {
        const q = search.toLowerCase();
        return (p.title + p.summary + p.when_it_applies).toLowerCase().includes(q);
      }
      return true;
    });
  }, [playbooks, activeCat, search]);

  return (
    <CreatorLayout title="Operations Playbook">
      <div className="space-y-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Operations Playbook
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Step-by-step guides for situations you'll face running PodDispatch. When you don't know what to do, look here first.
            </p>
          </div>
          <div className="flex gap-2">
            <AdvisorDialog playbooks={playbooks} onPickPlaybook={(slug) => {
              const p = playbooks.find(x => x.slug === slug);
              if (p) setSelected(p);
            }} />
            <NewPlaybookDialog onCreated={load} />
          </div>
        </div>

        <Card>
          <CardContent className="pt-4 space-y-3">
            <Input
              placeholder="Search playbooks (e.g. 'refund', 'breach', 'subpoena')"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <Tabs value={activeCat} onValueChange={v => setActiveCat(v as any)}>
              <TabsList className="flex flex-wrap h-auto">
                <TabsTrigger value="all">All ({playbooks.length})</TabsTrigger>
                {(Object.keys(CATEGORY_LABEL) as Category[]).map(c => (
                  <TabsTrigger key={c} value={c}>
                    {CATEGORY_LABEL[c]} ({playbooks.filter(p => p.category === c).length})
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No playbooks match.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(p => (
              <button key={p.id} onClick={() => setSelected(p)} className="text-left">
                <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm leading-tight">{p.title}</CardTitle>
                      <Badge className={`text-[10px] shrink-0 ${SEVERITY_COLOR[p.severity]}`}>{p.severity}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs text-muted-foreground line-clamp-2">{p.summary}</p>
                    <div className="flex items-center gap-2 text-[10px]">
                      <Badge variant="outline">{CATEGORY_LABEL[p.category]}</Badge>
                      {p.legal_clock && <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400"><Clock className="h-2.5 w-2.5" /> deadline</span>}
                    </div>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}

        {selected && (
          <PlaybookDetailDialog playbook={selected} onClose={() => setSelected(null)} onChanged={load} />
        )}
      </div>
    </CreatorLayout>
  );
}

// =================================

function PlaybookDetailDialog({ playbook, onClose, onChanged }: { playbook: Playbook; onClose: () => void; onChanged: () => void }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");

  useEffect(() => {
    (supabase as any).from("creator_playbook_notes")
      .select("*").eq("playbook_id", playbook.id).order("created_at", { ascending: false })
      .then(({ data }: any) => setNotes((data ?? []) as Note[]));
  }, [playbook.id]);

  async function addNote() {
    if (!newNote.trim()) return;
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { error } = await (supabase as any).from("creator_playbook_notes").insert({
      playbook_id: playbook.id, author_id: user.user.id, body: newNote.trim(),
    });
    if (error) return toast.error("Failed to save note");
    setNewNote("");
    const { data } = await (supabase as any).from("creator_playbook_notes")
      .select("*").eq("playbook_id", playbook.id).order("created_at", { ascending: false });
    setNotes((data ?? []) as Note[]);
  }

  async function deletePlaybook() {
    if (!confirm(`Delete "${playbook.title}"? This cannot be undone.`)) return;
    const { error } = await (supabase as any).from("creator_playbooks").delete().eq("id", playbook.id);
    if (error) return toast.error("Failed to delete");
    toast.success("Playbook deleted");
    onChanged();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="text-lg">{playbook.title}</DialogTitle>
            <Badge className={SEVERITY_COLOR[playbook.severity]}>{playbook.severity}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{playbook.summary}</p>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4 pb-4">
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <p className="text-xs font-semibold text-muted-foreground mb-1">WHEN THIS APPLIES</p>
              <p>{playbook.when_it_applies}</p>
            </div>

            {playbook.legal_clock && (
              <div className="rounded-md border border-orange-500/40 bg-orange-500/10 p-3 text-sm flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-orange-700 dark:text-orange-300">LEGAL DEADLINE</p>
                  <p className="text-orange-900 dark:text-orange-100">{playbook.legal_clock}</p>
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">STEPS</p>
              <ol className="space-y-2">
                {playbook.steps.map((s, i) => (
                  <li key={i} className="flex gap-3 rounded-md border p-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium">{s.title}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{s.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {playbook.scripts.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">SCRIPTS & TEMPLATES</p>
                <div className="space-y-2">
                  {playbook.scripts.map((s, i) => (
                    <div key={i} className="rounded-md border bg-muted/30 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold">{s.label}</p>
                        <Button size="sm" variant="ghost" className="h-6 text-xs gap-1"
                          onClick={() => { navigator.clipboard.writeText(s.body); toast.success("Copied"); }}>
                          <Copy className="h-3 w-3" /> Copy
                        </Button>
                      </div>
                      <pre className="text-xs whitespace-pre-wrap font-sans text-foreground/90">{s.body}</pre>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {playbook.refs.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">REFERENCES</p>
                <div className="space-y-1">
                  {playbook.refs.map((r, i) => (
                    <a key={i} href={r.url} target="_blank" rel="noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> {r.label}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">YOUR NOTES</p>
              <div className="space-y-2">
                {notes.map(n => (
                  <div key={n.id} className="rounded-md border p-2 bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-1">{new Date(n.created_at).toLocaleString()}</p>
                    <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Textarea value={newNote} onChange={e => setNewNote(e.target.value)}
                    placeholder="Add a personal note (what worked, who you called, lessons learned)..." rows={2} />
                  <Button onClick={addNote} disabled={!newNote.trim()}>Add</Button>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="border-t pt-3">
          {!playbook.is_seeded && (
            <Button variant="destructive" size="sm" onClick={deletePlaybook} className="mr-auto gap-1">
              <Trash2 className="h-3 w-3" /> Delete
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =================================

function AdvisorDialog({ playbooks, onPickPlaybook }: { playbooks: Playbook[]; onPickPlaybook: (slug: string) => void }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

  async function send() {
    if (!input.trim() || sending) return;
    const next = [...messages, { role: "user" as const, content: input.trim() }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("playbook-advisor", { body: { messages: next } });
      if (error) throw new Error(error.message);
      if ((data as any).error) throw new Error((data as any).error);
      setMessages([...next, { role: "assistant", content: (data as any).reply }]);
    } catch (err: any) {
      toast.error(err.message || "Advisor failed");
      setMessages(messages); // rollback
    } finally {
      setSending(false);
    }
  }

  function renderAssistant(text: string) {
    // turn [slug] references into clickable chips
    const parts = text.split(/(\[[a-z0-9-]+\])/g);
    return parts.map((part, i) => {
      const m = part.match(/^\[([a-z0-9-]+)\]$/);
      if (m && playbooks.some(p => p.slug === m[1])) {
        return (
          <button key={i} onClick={() => { onPickPlaybook(m[1]); setOpen(false); }}
            className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/15 text-primary text-xs font-medium hover:bg-primary/25 mx-0.5">
            {m[1]}
          </button>
        );
      }
      return <span key={i}>{part}</span>;
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5"><Sparkles className="h-4 w-4" /> Ask Advisor</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> Situation Advisor
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Describe what's happening in plain English. The advisor knows your playbooks and will point you to the right one — or help you think through something new. Not a substitute for an attorney.
          </p>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-3">
          <div className="space-y-3 py-2">
            {messages.length === 0 && (
              <div className="text-sm text-muted-foreground space-y-2 p-3 rounded-md bg-muted/30">
                <p className="font-medium text-foreground">Try things like:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>"A customer's crew lost a tablet that was logged into PodDispatch. What do I do?"</li>
                  <li>"I got an email from an attorney saying they're going to sue. Real or fake?"</li>
                  <li>"Customer is yelling at me and threatening a chargeback. How do I respond?"</li>
                  <li>"My internet is down at 6am, dispatch can't load. What do I tell customers?"</li>
                </ul>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`text-sm ${m.role === "user" ? "ml-12" : "mr-12"}`}>
                <p className="text-[10px] font-semibold text-muted-foreground mb-1">
                  {m.role === "user" ? "YOU" : "ADVISOR"}
                </p>
                <div className={`rounded-md p-3 whitespace-pre-wrap ${m.role === "user" ? "bg-primary/10" : "bg-muted/50 border"}`}>
                  {m.role === "assistant" ? renderAssistant(m.content) : m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="text-sm mr-12">
                <p className="text-[10px] font-semibold text-muted-foreground mb-1">ADVISOR</p>
                <div className="rounded-md p-3 bg-muted/50 border flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </ScrollArea>

        <div className="border-t pt-3 flex gap-2">
          <Textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Describe the situation..." rows={2} />
          <Button onClick={send} disabled={!input.trim() || sending} className="self-end">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =================================

function NewPlaybookDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    slug: "", title: "", summary: "", when_it_applies: "",
    category: "ops_unexpected" as Category, severity: "medium" as Severity,
    steps: "", legal_clock: "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.title || !form.slug || !form.summary || !form.when_it_applies) {
      return toast.error("Title, slug, summary, and when-it-applies are required");
    }
    setSaving(true);
    const steps = form.steps.split(/\n\n+/).filter(Boolean).map(block => {
      const [title, ...rest] = block.split("\n");
      return { title: title.trim(), detail: rest.join(" ").trim() || title.trim() };
    });
    const { error } = await (supabase as any).from("creator_playbooks").insert({
      slug: form.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      title: form.title, summary: form.summary, when_it_applies: form.when_it_applies,
      category: form.category, severity: form.severity,
      steps, scripts: [], legal_clock: form.legal_clock || null, refs: [],
      is_seeded: false,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Playbook saved");
    setOpen(false);
    setForm({ slug: "", title: "", summary: "", when_it_applies: "", category: "ops_unexpected", severity: "medium", steps: "", legal_clock: "" });
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-1.5"><Plus className="h-4 w-4" /> New</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New playbook</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium">Title</label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium">Slug (kebab-case)</label>
              <Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="my-new-playbook" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium">Category</label>
              <select className="w-full border rounded-md h-9 px-2 text-sm bg-background"
                value={form.category} onChange={e => setForm({ ...form, category: e.target.value as Category })}>
                {(Object.keys(CATEGORY_LABEL) as Category[]).map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Severity</label>
              <select className="w-full border rounded-md h-9 px-2 text-sm bg-background"
                value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value as Severity })}>
                <option value="critical">critical</option><option value="high">high</option>
                <option value="medium">medium</option><option value="low">low</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">One-line summary</label>
            <Input value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium">When this applies</label>
            <Textarea value={form.when_it_applies} onChange={e => setForm({ ...form, when_it_applies: e.target.value })} rows={2} />
          </div>
          <div>
            <label className="text-xs font-medium">Steps (one per block, blank line between; first line of each block is the step title)</label>
            <Textarea value={form.steps} onChange={e => setForm({ ...form, steps: e.target.value })} rows={6}
              placeholder={`Stop and breathe\nDon't reply for 30 minutes.\n\nGather facts\nPull the company record from Creator Console.`} />
          </div>
          <div>
            <label className="text-xs font-medium">Legal deadline (optional)</label>
            <Input value={form.legal_clock} onChange={e => setForm({ ...form, legal_clock: e.target.value })}
              placeholder="e.g. 60 days from discovery" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
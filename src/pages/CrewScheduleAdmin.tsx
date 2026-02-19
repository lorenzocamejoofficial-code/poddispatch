import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSchedulingStore } from "@/hooks/useSchedulingStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, RefreshCw, Link2, Trash2, Truck, Users, Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface ShareToken {
  id: string;
  token: string;
  truck_id: string;
  truck_name: string;
  valid_from: string;
  valid_until: string;
  active: boolean;
}

interface ActiveEmployee {
  id: string;
  full_name: string;
  phone_number: string | null;
  truck_id: string | null; // assigned truck for selectedDate
  truck_name: string | null;
}

interface SendTarget {
  employee: ActiveEmployee;
  link?: string;
}

export default function CrewScheduleAdmin() {
  const { user } = useAuth();
  const { trucks, selectedDate } = useSchedulingStore();
  const [tokens, setTokens] = useState<ShareToken[]>([]);
  const [selectedTruck, setSelectedTruck] = useState("");
  const [employees, setEmployees] = useState<ActiveEmployee[]>([]);

  // Send panel state
  const [sendMode, setSendMode] = useState<"individual" | "collective">("individual");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [readyModal, setReadyModal] = useState<SendTarget[]>([]);
  const [modalMode, setModalMode] = useState<"link" | "message">("link");

  const fetchTokens = useCallback(async () => {
    const { data } = await supabase
      .from("crew_share_tokens")
      .select("*, truck:trucks!crew_share_tokens_truck_id_fkey(name)")
      .eq("active", true)
      .order("created_at", { ascending: false });

    setTokens((data ?? []).map((t: any) => ({
      id: t.id,
      token: t.token,
      truck_id: t.truck_id,
      truck_name: t.truck?.name ?? "Unknown",
      valid_from: t.valid_from,
      valid_until: t.valid_until,
      active: t.active,
    })));
  }, []);

  const fetchEmployees = useCallback(async () => {
    // Get active employees with their crew assignments for selectedDate
    const [{ data: profiles }, { data: crews }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, phone_number").eq("active", true).order("full_name"),
      supabase.from("crews")
        .select("member1_id, member2_id, truck_id, truck:trucks!crews_truck_id_fkey(name)")
        .eq("active_date", selectedDate),
    ]);

    const crewMap = new Map<string, { truck_id: string; truck_name: string }>();
    for (const c of (crews ?? []) as any[]) {
      const info = { truck_id: c.truck_id, truck_name: c.truck?.name ?? "" };
      if (c.member1_id) crewMap.set(c.member1_id, info);
      if (c.member2_id) crewMap.set(c.member2_id, info);
    }

    setEmployees((profiles ?? []).map((p: any) => ({
      id: p.id,
      full_name: p.full_name,
      phone_number: p.phone_number,
      truck_id: crewMap.get(p.id)?.truck_id ?? null,
      truck_name: crewMap.get(p.id)?.truck_name ?? null,
    })));
  }, [selectedDate]);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);
  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const generateToken = async () => {
    if (!selectedTruck) { toast.error("Select a truck"); return; }
    const validFrom = selectedDate;
    const until = new Date(selectedDate + "T12:00:00");
    until.setDate(until.getDate() + 1);
    const validUntil = until.toISOString().split("T")[0];

    const { error } = await supabase.from("crew_share_tokens").insert({
      truck_id: selectedTruck,
      valid_from: validFrom,
      valid_until: validUntil,
      created_by: user?.id,
    } as any);

    if (error) { toast.error("Failed to create share link"); return; }
    toast.success("Share link created");
    setSelectedTruck("");
    fetchTokens();
  };

  const revokeToken = async (id: string) => {
    await supabase.from("crew_share_tokens").update({ active: false } as any).eq("id", id);
    toast.success("Link revoked");
    fetchTokens();
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/crew/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  // Build link for a truck token
  const getLinkForTruck = (truckId: string): string | undefined => {
    const t = tokens.find((tk) => tk.truck_id === truckId && tk.valid_from === selectedDate);
    if (!t) return undefined;
    return `${window.location.origin}/crew/${t.token}`;
  };

  // Get targets for send action
  const getTargets = (): ActiveEmployee[] => {
    if (sendMode === "individual") {
      const e = employees.find((e) => e.id === selectedEmployeeId);
      return e ? [e] : [];
    }
    return employees.filter((e) => selectedEmployeeIds.has(e.id));
  };

  const handleSendLink = () => {
    const targets = getTargets();
    if (!targets.length) { toast.error("Select at least one crew member"); return; }

    const sendTargets: SendTarget[] = targets.map((e) => ({
      employee: e,
      link: e.truck_id ? getLinkForTruck(e.truck_id) : undefined,
    }));
    setModalMode("link");
    setReadyModal(sendTargets);
  };

  const handleSendMessage = () => {
    const targets = getTargets();
    if (!targets.length) { toast.error("Select at least one crew member"); return; }
    if (!message.trim()) { toast.error("Enter a message"); return; }
    setModalMode("message");
    setReadyModal(targets.map((e) => ({ employee: e })));
  };

  const toggleCollective = (id: string) => {
    setSelectedEmployeeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const copyAllLinks = () => {
    const lines = readyModal.map((t) => {
      const phone = t.employee.phone_number ?? "(no phone)";
      if (modalMode === "link") {
        return `${t.employee.full_name} | ${phone} | ${t.link ?? "(no link—generate one first)"}`;
      }
      return `${t.employee.full_name} | ${phone} | ${message}`;
    }).join("\n");
    navigator.clipboard.writeText(lines);
    toast.success("Copied to clipboard");
  };

  return (
    <AdminLayout>
      <div className="space-y-8">

        {/* ── SEND PANEL ── */}
        <section className="rounded-lg border bg-card p-4 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Send to Crew
          </h3>

          {/* Mode toggle */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={sendMode === "individual" ? "default" : "outline"}
              onClick={() => { setSendMode("individual"); setSelectedEmployeeIds(new Set()); }}
            >
              Individual
            </Button>
            <Button
              size="sm"
              variant={sendMode === "collective" ? "default" : "outline"}
              onClick={() => { setSendMode("collective"); setSelectedEmployeeId(""); }}
            >
              Collective (Multi-select)
            </Button>
          </div>

          {/* Recipient selector */}
          {sendMode === "individual" ? (
            <div className="max-w-xs">
              <Label className="mb-1 block text-xs">Crew Member</Label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select crew member" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      <span className="flex items-center gap-2">
                        {e.full_name}
                        {e.truck_name && (
                          <span className="text-xs text-muted-foreground">({e.truck_name})</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-xs">Select Crew Members</Label>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {employees.map((e) => (
                  <label
                    key={e.id}
                    className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 cursor-pointer hover:border-primary/40 transition-colors"
                  >
                    <Checkbox
                      checked={selectedEmployeeIds.has(e.id)}
                      onCheckedChange={() => toggleCollective(e.id)}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{e.full_name}</p>
                      {e.truck_name && (
                        <p className="text-xs text-muted-foreground">{e.truck_name}</p>
                      )}
                    </div>
                  </label>
                ))}
                {employees.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-full">No active employees found.</p>
                )}
              </div>
            </div>
          )}

          {/* Message box */}
          <div>
            <Label className="mb-1 block text-xs">Message (optional for link send, required for message send)</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message to send…"
              rows={3}
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSendLink} variant="default">
              <Link2 className="mr-1.5 h-4 w-4" /> Send Run Sheet Link
            </Button>
            <Button onClick={handleSendMessage} variant="outline">
              <MessageSquare className="mr-1.5 h-4 w-4" /> Send Message
            </Button>
          </div>
        </section>

        {/* ── GENERATE SHARE LINKS ── */}
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Generate Crew Share Link
          </h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1 max-w-xs">
              <Select value={selectedTruck} onValueChange={setSelectedTruck}>
                <SelectTrigger><SelectValue placeholder="Select truck" /></SelectTrigger>
                <SelectContent>
                  {trucks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={generateToken}>
              <Link2 className="mr-1.5 h-4 w-4" /> Generate Link
            </Button>
          </div>
        </section>

        {/* ── ACTIVE LINKS ── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Active Share Links
            </h3>
            <Button variant="ghost" size="sm" onClick={fetchTokens}>
              <RefreshCw className="mr-1 h-3 w-3" /> Refresh
            </Button>
          </div>
          <div className="space-y-2">
            {tokens.length === 0 && (
              <p className="text-sm text-muted-foreground">No active share links.</p>
            )}
            {tokens.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
                <div className="flex items-center gap-3">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="font-medium text-card-foreground">{t.truck_name}</span>
                    <p className="text-xs text-muted-foreground">{t.valid_from} → {t.valid_until}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => copyLink(t.token)}>
                    <Copy className="mr-1 h-3 w-3" /> Copy Link
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => revokeToken(t.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── READY TO PASTE MODAL ── */}
      <Dialog open={readyModal.length > 0} onOpenChange={(o) => { if (!o) setReadyModal([]); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {modalMode === "link" ? "Run Sheet Links — Ready to Paste" : "Message — Ready to Send"}
            </DialogTitle>
            <DialogDescription>
              Copy and paste to each recipient's phone number via SMS or your preferred messaging app.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-96 overflow-y-auto">
            {readyModal.map(({ employee, link }) => (
              <div key={employee.id} className="rounded-md border bg-background p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{employee.full_name}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      const text = modalMode === "link"
                        ? (link ?? "(no link—generate one first)")
                        : message;
                      navigator.clipboard.writeText(text);
                      toast.success("Copied");
                    }}
                  >
                    <Copy className="mr-1 h-3 w-3" /> Copy
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  📞 {employee.phone_number ?? <span className="italic">No phone on file</span>}
                </p>
                {modalMode === "link" ? (
                  <p className="text-xs text-primary break-all">
                    {link ?? <span className="text-destructive italic">No active link for this truck/date — generate one above first.</span>}
                  </p>
                ) : (
                  <p className="text-xs text-foreground break-words">{message}</p>
                )}
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full" onClick={copyAllLinks}>
            <Copy className="mr-2 h-4 w-4" /> Copy All to Clipboard
          </Button>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

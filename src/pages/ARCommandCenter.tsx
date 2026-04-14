import { useEffect, useState, useCallback, useMemo } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageLoader } from "@/components/ui/page-loader";
import {
  DollarSign, AlertTriangle, Clock, TrendingUp, Phone,
  ArrowUpRight, XCircle, Search, Filter,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getDenialTranslation, isRecoverable } from "@/lib/denial-code-translations";
import { logAuditEvent } from "@/lib/audit-logger";
import { DenialRecoveryEngine, TimelyFilingBadge, ResubmissionHistory } from "@/components/billing/DenialRecoveryEngine";
import { PayerContactLookup } from "@/components/billing/PayerDirectoryTab";
import { BillerTaskQueue } from "@/components/billing/BillerTaskQueue";
import { Wrench } from "lucide-react";

/* ---------- types ---------- */
interface ARClaim {
  id: string;
  trip_id: string;
  patient_name: string;
  member_id: string | null;
  payer_name: string | null;
  payer_type: string | null;
  run_date: string;
  total_charge: number | null;
  amount_paid: number | null;
  status: string;
  submitted_at: string | null;
  denial_code: string | null;
  denial_reason: string | null;
  last_contacted_at: string | null;
  company_id: string | null;
  resubmission_count: number | null;
  resubmitted_at: string | null;
  // computed
  days_outstanding: number;
  priority: number;
  priority_label: string;
  priority_color: string;
}

interface FollowUpNote {
  id: string;
  note_text: string;
  created_by_name: string | null;
  created_at: string;
}

/* ---------- priority logic ---------- */
function computePriority(claim: {
  status: string;
  run_date: string;
  submitted_at: string | null;
  denial_code: string | null;
  payer_type: string | null;
  days_outstanding: number;
}): { priority: number; label: string; color: string } {
  const dosDate = new Date(claim.run_date);
  const monthsSinceDOS = (Date.now() - dosDate.getTime()) / (1000 * 60 * 60 * 24 * 30);

  // 1. Timely filing risk
  const isMedicare = (claim.payer_type ?? "").toLowerCase().includes("medicare");
  const isMedicaid = (claim.payer_type ?? "").toLowerCase().includes("medicaid");
  if ((isMedicare && monthsSinceDOS >= 10) || (isMedicaid && monthsSinceDOS >= 10) || monthsSinceDOS >= 10) {
    return { priority: 1, label: "Timely Filing Risk", color: "destructive" };
  }

  // 2. Follow up required — submitted > 45 days, no payment or denial
  if (claim.status === "submitted" && claim.days_outstanding > 45) {
    return { priority: 2, label: "Follow Up Required", color: "warning" };
  }

  // 3. Denied — recoverable
  if (claim.status === "denied" && claim.denial_code && isRecoverable(claim.denial_code)) {
    return { priority: 3, label: "Denial — Recoverable", color: "warning" };
  }

  // 4. Aging — monitor (submitted > 31 days)
  if (claim.status === "submitted" && claim.days_outstanding > 31) {
    return { priority: 4, label: "Aging — Monitor", color: "secondary" };
  }

  // 5. Needs correction
  if (claim.status === "needs_correction") {
    return { priority: 5, label: "Correction Needed", color: "secondary" };
  }

  // Default: low priority
  return { priority: 6, label: "Active", color: "outline" };
}

function daysFromSubmission(submittedAt: string | null): number {
  if (!submittedAt) return 0;
  return Math.floor((Date.now() - new Date(submittedAt).getTime()) / (1000 * 60 * 60 * 24));
}

/* ---------- component ---------- */
export default function ARCommandCenter() {
  const { activeCompanyId, user } = useAuth();
  const [claims, setClaims] = useState<ARClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<ARClaim | null>(null);
  const [notes, setNotes] = useState<FollowUpNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterPayer, setFilterPayer] = useState<string>("all");
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [writeOffReason, setWriteOffReason] = useState("");
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryClaim, setRecoveryClaim] = useState<ARClaim | null>(null);

  /* -- fetch claims -- */
  const fetchClaims = useCallback(async () => {
    if (!activeCompanyId) return;
    const { data, error } = await supabase
      .from("claim_records")
      .select("id, trip_id, payer_name, payer_type, run_date, total_charge, amount_paid, status, submitted_at, denial_code, denial_reason, last_contacted_at, company_id, member_id, patient_id, resubmission_count, resubmitted_at")
      .eq("company_id", activeCompanyId)
      .eq("is_simulated", false)
      .in("status", ["submitted", "denied", "needs_correction"] as any)
      .order("run_date", { ascending: true });

    if (error) {
      console.error("Failed to load AR claims:", error);
      return;
    }

    // Fetch patient names for all claims
    const patientIds = [...new Set((data ?? []).map((c: any) => c.patient_id).filter(Boolean))];
    let patientMap: Record<string, string> = {};
    if (patientIds.length > 0) {
      const { data: patients } = await supabase
        .from("patients")
        .select("id, first_name, last_name")
        .in("id", patientIds);
      for (const p of patients ?? []) {
        patientMap[p.id] = `${p.first_name} ${p.last_name}`;
      }
    }

    const mapped: ARClaim[] = (data ?? []).map((c: any) => {
      const days = daysFromSubmission(c.submitted_at);
      const pri = computePriority({ ...c, days_outstanding: days });
      return {
        ...c,
        patient_name: patientMap[c.patient_id] ?? "Unknown Patient",
        days_outstanding: days,
        priority: pri.priority,
        priority_label: pri.label,
        priority_color: pri.color,
      };
    });

    mapped.sort((a, b) => a.priority - b.priority || b.days_outstanding - a.days_outstanding);
    setClaims(mapped);
    setLoading(false);
  }, [activeCompanyId]);

  useEffect(() => { fetchClaims(); }, [fetchClaims]);

  /* -- fetch notes for selected claim -- */
  const fetchNotes = useCallback(async (claimId: string) => {
    setNotesLoading(true);
    const { data } = await supabase
      .from("ar_followup_notes")
      .select("id, note_text, created_by_name, created_at")
      .eq("claim_id", claimId)
      .order("created_at", { ascending: true });
    setNotes((data as FollowUpNote[]) ?? []);
    setNotesLoading(false);
  }, []);

  useEffect(() => {
    if (selectedClaim) fetchNotes(selectedClaim.id);
  }, [selectedClaim, fetchNotes]);

  /* -- actions -- */
  const logNote = async (text: string) => {
    if (!selectedClaim || !activeCompanyId || !user) return;
    setSaving(true);
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    await supabase.from("ar_followup_notes").insert({
      claim_id: selectedClaim.id,
      company_id: activeCompanyId,
      note_text: text,
      created_by: user.id,
      created_by_name: profile?.full_name ?? user.email ?? "Unknown",
    });

    setNewNote("");
    await fetchNotes(selectedClaim.id);
    setSaving(false);
    toast.success("Note logged");
  };

  const markAsContacted = async () => {
    if (!selectedClaim) return;
    setSaving(true);
    await supabase
      .from("claim_records")
      .update({ last_contacted_at: new Date().toISOString() } as any)
      .eq("id", selectedClaim.id);
    await logNote("Payer contacted for follow-up on claim status.");
    setSelectedClaim({ ...selectedClaim, last_contacted_at: new Date().toISOString() });
    await fetchClaims();
    setSaving(false);
    toast.success("Claim marked as contacted");
  };

  const escalateToOwner = async () => {
    if (!selectedClaim || !activeCompanyId) return;
    setSaving(true);
    const { data: owners } = await supabase
      .from("company_memberships")
      .select("user_id")
      .eq("company_id", activeCompanyId)
      .eq("role", "owner" as any);

    if (owners?.length) {
      await supabase.from("notifications").insert(
        owners.map((o: any) => ({
          user_id: o.user_id,
          message: `AR escalation: ${selectedClaim.patient_name} — $${(selectedClaim.total_charge ?? 0).toFixed(2)} — ${selectedClaim.priority_label}`,
          notification_type: "ar_escalation",
        }))
      );
    }
    await logNote("Claim escalated to owner for review.");
    setSaving(false);
    toast.success("Escalated to owner");
  };

  const writeOff = async () => {
    if (!selectedClaim || !writeOffReason.trim()) return;
    setSaving(true);
    await supabase
      .from("claim_records")
      .update({ status: "voided" } as any)
      .eq("id", selectedClaim.id);

    await logAuditEvent({
      action: "delete",
      tableName: "claim_records",
      recordId: selectedClaim.id,
      oldData: { status: selectedClaim.status, total_charge: selectedClaim.total_charge },
      newData: { status: "voided", write_off_reason: writeOffReason.trim() },
      notes: `AR write-off: ${writeOffReason.trim()}`,
    });

    await logNote(`Claim written off. Reason: ${writeOffReason.trim()}`);
    setWriteOffOpen(false);
    setWriteOffReason("");
    setSelectedClaim(null);
    await fetchClaims();
    setSaving(false);
    toast.success("Claim written off");
  };

  /* -- filters -- */
  const payers = useMemo(() => {
    const set = new Set(claims.map(c => c.payer_name).filter(Boolean));
    return [...set].sort();
  }, [claims]);

  const filtered = useMemo(() => {
    return claims.filter(c => {
      if (filterPriority !== "all" && c.priority_label !== filterPriority) return false;
      if (filterPayer !== "all" && c.payer_name !== filterPayer) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!c.patient_name.toLowerCase().includes(q) && !(c.member_id ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [claims, filterPriority, filterPayer, search]);

  /* -- summary cards -- */
  const totalOutstanding = claims.reduce((sum, c) => sum + ((c.total_charge ?? 0) - (c.amount_paid ?? 0)), 0);
  const actionToday = claims.filter(c => c.priority <= 3).length;
  const timelyFilingRisk = claims.filter(c => c.priority === 1).reduce((s, c) => s + (c.total_charge ?? 0), 0);

  // Recovered this month — need separate query, approximate with paid claims
  const [recoveredThisMonth, setRecoveredThisMonth] = useState(0);
  useEffect(() => {
    if (!activeCompanyId) return;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    supabase
      .from("claim_records")
      .select("amount_paid")
      .eq("company_id", activeCompanyId)
      .eq("is_simulated", false)
      .eq("status", "paid" as any)
      .gte("paid_at", monthStart.toISOString())
      .then(({ data }) => {
        setRecoveredThisMonth((data ?? []).reduce((s: number, c: any) => s + (c.amount_paid ?? 0), 0));
      });
  }, [activeCompanyId]);

  if (loading) return <AdminLayout><PageLoader /></AdminLayout>;

  const denialInfo = selectedClaim?.denial_code ? getDenialTranslation(selectedClaim.denial_code) : null;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">AR Command Center</h1>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2"><DollarSign className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Outstanding</p>
                <p className="text-xl font-bold">${totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2"><AlertTriangle className="h-5 w-5 text-amber-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Claims Requiring Action</p>
                <p className="text-xl font-bold">{actionToday}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-destructive/10 p-2"><Clock className="h-5 w-5 text-destructive" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Timely Filing Risk</p>
                <p className="text-xl font-bold">${timelyFilingRisk.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2"><TrendingUp className="h-5 w-5 text-emerald-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Recovered This Month</p>
                <p className="text-xl font-bold">${recoveredThisMonth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search patient or member ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-[200px]">
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue placeholder="Priority filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="Timely Filing Risk">Timely Filing Risk</SelectItem>
              <SelectItem value="Follow Up Required">Follow Up Required</SelectItem>
              <SelectItem value="Denial — Recoverable">Denial — Recoverable</SelectItem>
              <SelectItem value="Aging — Monitor">Aging — Monitor</SelectItem>
              <SelectItem value="Correction Needed">Correction Needed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPayer} onValueChange={setFilterPayer}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Payers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payers</SelectItem>
              {payers.map(p => <SelectItem key={p} value={p!}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{filtered.length} claims</span>
        </div>

        {/* Worklist Table */}
        <div className="rounded-lg border bg-card overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Patient</th>
                <th className="text-left p-3 font-medium">Payer</th>
                <th className="text-left p-3 font-medium">DOS</th>
                <th className="text-right p-3 font-medium">Billed</th>
                <th className="text-right p-3 font-medium">Days Out</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">No claims requiring AR follow-up</td></tr>
              )}
              {filtered.map(claim => (
                <tr
                  key={claim.id}
                  className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setSelectedClaim(claim)}
                >
                  <td className="p-3 font-medium">{claim.patient_name}</td>
                  <td className="p-3 text-muted-foreground">{claim.payer_name ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{claim.run_date}</td>
                  <td className="p-3 text-right">${(claim.total_charge ?? 0).toFixed(2)}</td>
                  <td className="p-3 text-right">{claim.days_outstanding}</td>
                  <td className="p-3"><Badge variant="outline" className="text-xs">{claim.status}</Badge></td>
                  <td className="p-3">
                    <Badge variant={claim.priority_color as any} className="text-xs whitespace-nowrap">
                      {claim.priority_label}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedClaim} onOpenChange={open => { if (!open) setSelectedClaim(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedClaim && (
            <div className="space-y-5 pt-2">
              <SheetHeader>
                <SheetTitle className="text-lg">{selectedClaim.patient_name}</SheetTitle>
              </SheetHeader>

              {/* Claim details */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Member ID</p>
                  <p className="font-medium">{selectedClaim.member_id ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Payer</p>
                  <p className="font-medium">{selectedClaim.payer_name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date of Service</p>
                  <p className="font-medium">{selectedClaim.run_date}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Amount Billed</p>
                  <p className="font-medium">${(selectedClaim.total_charge ?? 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Amount Paid</p>
                  <p className="font-medium">${(selectedClaim.amount_paid ?? 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Days Outstanding</p>
                  <p className="font-medium">{selectedClaim.days_outstanding}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant="outline">{selectedClaim.status}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Contacted</p>
                  <p className="font-medium">{selectedClaim.last_contacted_at ? new Date(selectedClaim.last_contacted_at).toLocaleDateString() : "Never"}</p>
                </div>
              </div>

              {/* Payer Contact */}
              <Separator />
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payer Contact</p>
                <PayerContactLookup payerType={selectedClaim.payer_type} payerName={selectedClaim.payer_name} />
              </div>

              {/* Timely filing deadline */}
              <div className="flex items-center gap-2">
                <TimelyFilingBadge runDate={selectedClaim.run_date} />
              </div>

              {/* Denial info */}
              {selectedClaim.denial_code && (
                <>
                  <Separator />
                  <div className="space-y-2.5">
                    <p className="text-sm font-medium text-destructive">Denial: {selectedClaim.denial_code}</p>
                    {denialInfo ? (
                      <div className="rounded-md bg-destructive/5 border border-destructive/20 p-3 text-sm space-y-1">
                        <p>{denialInfo.plain_english_explanation}</p>
                        <p className="text-muted-foreground">{denialInfo.action_required}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{selectedClaim.denial_reason ?? "No details available"}</p>
                    )}
                    {selectedClaim.status === "denied" && (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => { setRecoveryClaim(selectedClaim); setRecoveryOpen(true); }}
                      >
                        <Wrench className="h-3.5 w-3.5 mr-1.5" /> Recover This Claim
                      </Button>
                    )}
                  </div>
                </>
              )}

              {/* Resubmission History */}
              <ResubmissionHistory claimId={selectedClaim.id} submittedAt={selectedClaim.submitted_at} />

              <Separator />

              {/* Follow-up notes */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Follow-Up Notes</h3>
                {notesLoading ? (
                  <p className="text-sm text-muted-foreground">Loading notes...</p>
                ) : notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No notes yet</p>
                ) : (
                  <ScrollArea className="max-h-48">
                    <div className="space-y-2">
                      {notes.map(n => (
                        <div key={n.id} className="rounded-md bg-muted/50 p-2.5 text-sm">
                          <p>{n.note_text}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {n.created_by_name} · {new Date(n.created_at).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                <div className="flex gap-2">
                  <Textarea
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    placeholder="Add a follow-up note..."
                    className="min-h-[60px]"
                  />
                </div>
                <Button
                  size="sm"
                  disabled={!newNote.trim() || saving}
                  onClick={() => logNote(newNote.trim())}
                >
                  Log Note
                </Button>
              </div>

              <Separator />

              {/* Action buttons */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Actions</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" disabled={saving} onClick={markAsContacted}>
                    <Phone className="h-3.5 w-3.5 mr-1.5" /> Mark as Contacted
                  </Button>
                  <Button variant="outline" size="sm" disabled={saving} onClick={escalateToOwner}>
                    <ArrowUpRight className="h-3.5 w-3.5 mr-1.5" /> Escalate to Owner
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={saving}
                    onClick={() => setWriteOffOpen(true)}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1.5" /> Write Off
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Write-off confirmation */}
      <Dialog open={writeOffOpen} onOpenChange={setWriteOffOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Write Off Claim</DialogTitle>
            <DialogDescription>
              This will void the claim for {selectedClaim?.patient_name ?? "this patient"} (${(selectedClaim?.total_charge ?? 0).toFixed(2)}). This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={writeOffReason}
            onChange={e => setWriteOffReason(e.target.value)}
            placeholder="Reason for write-off (required)..."
            className="min-h-[80px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setWriteOffOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={!writeOffReason.trim() || saving} onClick={writeOff}>
              Write Off
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Denial Recovery Engine */}
      {recoveryClaim && (
        <DenialRecoveryEngine
          claim={recoveryClaim}
          open={recoveryOpen}
          onOpenChange={open => { setRecoveryOpen(open); if (!open) setRecoveryClaim(null); }}
          onComplete={() => { fetchClaims(); setSelectedClaim(null); }}
        />
      )}
    </AdminLayout>
  );
}

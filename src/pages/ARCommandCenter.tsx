import React, { useEffect, useState, useCallback, useMemo, lazy, Suspense } from "react";
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
import { Wrench as WrenchIcon, FileText, UserCheck, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createSecondaryClaim } from "@/lib/create-secondary-claim";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getDenialTranslation, isRecoverable } from "@/lib/denial-code-translations";
import { logAuditEvent } from "@/lib/audit-logger";
import { classifyDenial, type NextActionKind } from "@/lib/classify-denial";
import { isMedicareCoinsuranceWriteOffRisk } from "@/lib/payer-compliance";
import { ChevronDown, ChevronRight, Info, CheckCircle2 } from "lucide-react";
// DenialRecoveryEngine is heavy (650+ lines, multiple data fetches) and only
// renders when the user clicks "Recover This Claim". Lazy-load it so it
// doesn't block the AR page or the detail sheet from opening.
const DenialRecoveryEngine = lazy(() =>
  import("@/components/billing/DenialRecoveryEngine").then(m => ({ default: m.DenialRecoveryEngine }))
);
import { TimelyFilingBadge, ResubmissionHistory } from "@/components/billing/DenialRecoveryEngine";
import { PayerContactLookup } from "@/components/billing/PayerDirectoryTab";
import { BillerTaskQueue } from "@/components/billing/BillerTaskQueue";
import { BillingWorkQueue } from "@/components/billing/BillingWorkQueue";
import { ClaimTimelineDrawer, TimelineTrigger } from "@/components/billing/ClaimTimelineDrawer";
import { Wrench } from "lucide-react";
import { TablePagination } from "@/components/ui/table-pagination";

const LORENZO_TEST_COMPANY_ID = "f53311c3-a40e-4b2b-b4c2-5aec852f7789";

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
  denial_category: string | null;
  last_contacted_at: string | null;
  company_id: string | null;
  resubmission_count: number | null;
  resubmitted_at: string | null;
  acknowledgment_status: string | null;
  rejection_reason: string | null;
  rejection_codes: string[] | null;
  // computed
  days_outstanding: number;
  priority: number;
  priority_label: string;
  priority_color: string;
  patient_id?: string | null;
  has_secondary_on_file?: boolean;
  secondary_already_generated?: boolean;
  is_partial_paid?: boolean;
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
  filing_limit_days?: number;
  acknowledgment_status?: string | null;
}): { priority: number; label: string; color: string } {
  const dosDate = new Date(claim.run_date);
  const filingLimit = claim.filing_limit_days ?? 365;
  const daysSinceDOS = (Date.now() - dosDate.getTime()) / (1000 * 60 * 60 * 24);
  const daysToDeadline = filingLimit - daysSinceDOS;

  // 0. Missing Acknowledgment — submitted >24h ago with no 999/277CA back yet
  if (
    claim.status === "submitted" &&
    claim.submitted_at &&
    (Date.now() - new Date(claim.submitted_at).getTime()) > 24 * 60 * 60 * 1000 &&
    !claim.acknowledgment_status
  ) {
    return { priority: 0, label: "Missing Acknowledgment", color: "destructive" };
  }

  // 1. Filing Deadline — within 30 days of payer-specific deadline
  if (daysToDeadline <= 30) {
    return { priority: 1, label: "Filing Deadline", color: "destructive" };
  }

  // 2. Denied — Action Required
  if (claim.status === "denied" && claim.denial_code && isRecoverable(claim.denial_code)) {
    return { priority: 2, label: "Denied — Action Required", color: "warning" };
  }

  // 3. No Response — 45+ Days
  if (claim.status === "submitted" && claim.days_outstanding > 45) {
    return { priority: 3, label: "No Response — 45+ Days", color: "warning" };
  }

  // 4. Aging — Monitor (submitted > 31 days)
  if (claim.status === "submitted" && claim.days_outstanding > 31) {
    return { priority: 4, label: "Aging — Monitor", color: "secondary" };
  }

  // 5. Follow Up
  if (claim.status === "needs_correction") {
    return { priority: 5, label: "Follow Up", color: "secondary" };
  }

  // Default: submitted and not yet aging — show as Pending so the customer
  // knows the claim is alive at the payer, not "Active" (which reads vague).
  if (claim.status === "submitted") {
    return { priority: 6, label: "Pending — Awaiting Payer", color: "outline" };
  }
  return { priority: 6, label: "Active", color: "outline" };
}

function daysFromSubmission(submittedAt: string | null): number {
  if (!submittedAt) return 0;
  return Math.floor((Date.now() - new Date(submittedAt).getTime()) / (1000 * 60 * 60 * 24));
}

/* ---------- component ---------- */
export default function ARCommandCenter() {
  const { activeCompanyId, user, isSystemCreator } = useAuth();
  const navigate = useNavigate();
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
  const [filterAck, setFilterAck] = useState<string>("all");
  const [filterDenialCat, setFilterDenialCat] = useState<string>("all");
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [writeOffReason, setWriteOffReason] = useState("");
  const [writeOffAttested, setWriteOffAttested] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryClaim, setRecoveryClaim] = useState<ARClaim | null>(null);
  const [workQueueRefreshKey, setWorkQueueRefreshKey] = useState(0);
  // Per-row "why?" toggle for the inline plain-English denial explanation.
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  // Close-out confirmation for non-recoverable denials (CO-45, CO-29, etc.)
  const [closeOutClaim, setCloseOutClaim] = useState<ARClaim | null>(null);
  const [closeOutOpen, setCloseOutOpen] = useState(false);
  // Defer mounting the Sheet's heavy children (PayerContactLookup,
  // TimelyFilingBadge, ResubmissionHistory, notes fetch) until after the
  // sheet's slide-in animation has had a frame to paint. Without this, the
  // click → setSelectedClaim → synchronous render of 4 query-firing
  // children blocks the main thread for ~500ms and the sheet appears
  // frozen.
  const [sheetReady, setSheetReady] = useState(false);
  useEffect(() => {
    if (!selectedClaim) { setSheetReady(false); return; }
    // Two RAFs ensure the sheet's open animation starts before the heavy
    // subtree mounts and the network requests fire.
    const r1 = requestAnimationFrame(() => {
      const r2 = requestAnimationFrame(() => setSheetReady(true));
      (r1 as any).inner = r2;
    });
    return () => cancelAnimationFrame(r1);
  }, [selectedClaim]);

  /* -- fetch claims -- */
  const fetchClaims = useCallback(async () => {
    if (!activeCompanyId) {
      setLoading(false);
      return;
    }
    const [{ data, error }, { data: payerDir }] = await Promise.all([
      supabase
        .from("claim_records")
        .select("id, trip_id, payer_name, payer_type, run_date, total_charge, amount_paid, status, submitted_at, denial_code, denial_reason, denial_category, last_contacted_at, company_id, member_id, patient_id, resubmission_count, resubmitted_at, acknowledgment_status, rejection_reason, rejection_codes, secondary_claim_generated, original_claim_id")
        .eq("company_id", activeCompanyId)
        .eq("is_simulated", false)
        .eq("is_test_submission", false)
        .in("status", ["submitted", "denied", "needs_correction", "paid"] as any)
        .order("run_date", { ascending: true }),
      supabase
        .from("payer_directory")
        .select("payer_type, timely_filing_days")
        .eq("company_id", activeCompanyId),
    ]);

    if (error) {
      console.error("Failed to load AR claims:", error);
      return;
    }

    // Build payer filing limit map
    const filingMap: Record<string, number> = {};
    for (const p of payerDir ?? []) {
      if (p.payer_type) filingMap[p.payer_type.toLowerCase()] = p.timely_filing_days ?? 365;
    }

    // Fetch patient names for all claims; also get oneoff names from scheduling_legs via trip
    const patientIds = [...new Set((data ?? []).map((c: any) => c.patient_id).filter(Boolean))];
    const tripIds = [...new Set((data ?? []).map((c: any) => c.trip_id).filter(Boolean))];
    let patientMap: Record<string, string> = {};
    let patientSecondaryMap: Record<string, boolean> = {};
    let tripLegMap: Record<string, any> = {};

    const [{ data: patients }, { data: tripLegs }] = await Promise.all([
      patientIds.length > 0
        ? supabase.from("patients").select("id, first_name, last_name, secondary_payer, secondary_member_id").in("id", patientIds)
        : Promise.resolve({ data: [] as any[] }),
      tripIds.length > 0
        ? supabase.from("trip_records" as any).select("id, leg:scheduling_legs!trip_records_leg_id_fkey(is_oneoff, oneoff_name)").in("id", tripIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    for (const p of (patients ?? []) as any[]) {
      patientMap[p.id] = `${p.first_name} ${p.last_name}`;
      patientSecondaryMap[p.id] = !!(p.secondary_payer && p.secondary_member_id);
    }
    for (const t of (tripLegs ?? []) as any[]) {
      if (t.leg?.is_oneoff) tripLegMap[t.id] = t.leg.oneoff_name;
    }

    const mapped: ARClaim[] = (data ?? []).map((c: any) => {
      const days = daysFromSubmission(c.submitted_at);
      const filingLimitDays = filingMap[(c.payer_type ?? "").toLowerCase()] ?? 365;
      const pri = computePriority({ ...c, days_outstanding: days, filing_limit_days: filingLimitDays });
      const isPartial = c.status === "paid"
        && Number(c.amount_paid ?? 0) > 0
        && Number(c.amount_paid ?? 0) < Number(c.total_charge ?? 0);
      const finalPri = isPartial
        ? { priority: 2, label: "Partial Pay — Recover", color: "warning" }
        : pri;
      return {
        ...c,
        patient_name: patientMap[c.patient_id] ?? tripLegMap[c.trip_id] ?? "Unknown Patient",
        days_outstanding: days,
        priority: finalPri.priority,
        priority_label: finalPri.label,
        priority_color: finalPri.color,
        has_secondary_on_file: c.patient_id ? !!patientSecondaryMap[c.patient_id] : false,
        secondary_already_generated: !!c.secondary_claim_generated,
        is_partial_paid: isPartial,
      };
    })
    // Drop fully-paid claims — only partial-pay belongs in AR
    .filter((c: any) => c.status !== "paid" || c.is_partial_paid);

    mapped.sort((a, b) => a.priority - b.priority || b.days_outstanding - a.days_outstanding);
    setClaims(mapped);
    setLoading(false);
  }, [activeCompanyId]);

  useEffect(() => {
    if (!isSystemCreator || activeCompanyId === LORENZO_TEST_COMPANY_ID) return;
    (supabase as any)
      .rpc("enter_creator_simulation", { _company_id: LORENZO_TEST_COMPANY_ID })
      .then(({ error }: { error: any }) => {
        if (error) {
          console.error("Failed to enter AR simulation tenant:", error);
          setLoading(false);
          return;
        }
        window.location.reload();
      });
  }, [activeCompanyId, isSystemCreator]);

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
    // Wait until after the sheet has painted before firing the notes query.
    if (selectedClaim && sheetReady) fetchNotes(selectedClaim.id);
  }, [selectedClaim, sheetReady, fetchNotes]);

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

    // Auto-complete follow-up biller_tasks for this claim
    await supabase
      .from("biller_tasks")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        completed_by: user.id,
        dismiss_reason: "Auto-completed when follow-up note was logged.",
      } as any)
      .eq("claim_id", selectedClaim.id)
      .in("task_type", ["follow_up_14", "follow_up_45"])
      .in("status", ["pending", "in_progress"]);

    setNewNote("");
    await fetchNotes(selectedClaim.id);
    setSaving(false);
    setWorkQueueRefreshKey(k => k + 1);
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

  /* ---------- Per-row "Next Step" CTA ----------
   * Single visible action per claim row so customers don't have to dig
   * into the detail sheet to recover money. Surfaces logic that's
   * already built (Denial Recovery, Secondary Insurance, payer contact)
   * as one obvious button.
   */
  type NextAction = {
    label: string;
    icon: typeof WrenchIcon;
    variant: "default" | "outline" | "secondary";
    run: () => void | Promise<void>;
  } | null;

  const getNextAction = useCallback((claim: ARClaim): NextAction => {
    // Honest classifier — never tells the biller to "Start recovery" on a
    // contractual write-off, and never tells them to "Mark closed" on
    // something they could actually appeal.
    const verdict = classifyDenial(claim);
    if (verdict.nextActionKind === "none") return null;

    const iconFor = (kind: NextActionKind) => {
      switch (kind) {
        case "start_recovery":    return WrenchIcon;
        case "bill_secondary":    return ArrowRight;
        case "check_for_secondary": return UserCheck;
        case "bill_patient":      return UserCheck;
        case "mark_closed":       return CheckCircle2;
        case "call_payer":        return Phone;
        case "review":            return FileText;
        default:                  return ArrowRight;
      }
    };
    const variantFor = (kind: NextActionKind): "default" | "outline" | "secondary" => {
      if (kind === "mark_closed") return "secondary";
      if (kind === "review" || kind === "check_for_secondary") return "outline";
      return "default";
    };

    const run = async () => {
      switch (verdict.nextActionKind) {
        case "start_recovery":
          setRecoveryClaim(claim); setRecoveryOpen(true); return;
        case "bill_secondary": {
          const res = await createSecondaryClaim(claim.id);
          if (res.ok) { toast.success("Secondary claim created — ready to submit"); await fetchClaims(); }
          else toast.error(res.error ?? "Could not create secondary claim");
          return;
        }
        case "check_for_secondary":
          if (claim.patient_id) navigate(`/patients?patientId=${claim.patient_id}&focus=primary_payer`);
          else navigate("/patients");
          return;
        case "bill_patient":
          if (claim.patient_id) navigate(`/patients?patientId=${claim.patient_id}&focus=billing`);
          else navigate("/patients");
          return;
        case "mark_closed":
          setCloseOutClaim(claim); setCloseOutOpen(true); return;
        case "call_payer":
        case "review":
        default:
          setSelectedClaim(claim); return;
      }
    };

    return {
      label: verdict.nextAction,
      icon: iconFor(verdict.nextActionKind),
      variant: variantFor(verdict.nextActionKind),
      run,
    };
  }, [fetchClaims, navigate]);

  /** Close a non-recoverable denial honestly (CO-45 etc.) — voids without
   *  pretending the customer should appeal. */
  const confirmCloseOut = async () => {
    if (!closeOutClaim) return;
    const verdict = classifyDenial(closeOutClaim);
    setSaving(true);
    await supabase
      .from("claim_records")
      .update({ status: "voided" } as any)
      .eq("id", closeOutClaim.id);
    await logAuditEvent({
      action: "delete",
      tableName: "claim_records",
      recordId: closeOutClaim.id,
      oldData: { status: closeOutClaim.status, denial_code: closeOutClaim.denial_code },
      newData: { status: "voided", reason: verdict.headline },
      notes: `Closed by classifier: ${verdict.headline} — ${verdict.plainEnglish}`,
    });
    setCloseOutOpen(false);
    setCloseOutClaim(null);
    await fetchClaims();
    setSaving(false);
    toast.success("Claim closed");
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
      if (filterAck === "rejected_999" && c.acknowledgment_status !== "rejected_999") return false;
      if (filterAck === "rejected_277ca" && c.acknowledgment_status !== "rejected_277ca") return false;
      if (filterAck === "any_rejected" && !["rejected_999","rejected_277ca"].includes(c.acknowledgment_status ?? "")) return false;
      if (filterAck === "accepted" && !["accepted_999","accepted_277ca","forwarded_to_payer"].includes(c.acknowledgment_status ?? "")) return false;
      if (filterAck === "no_ack" && c.acknowledgment_status) return false;
      if (filterDenialCat !== "all" && c.denial_category !== filterDenialCat) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!c.patient_name.toLowerCase().includes(q) && !(c.member_id ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [claims, filterPriority, filterPayer, filterAck, filterDenialCat, search]);

  // Pagination — keeps DOM render small as AR queue grows past hundreds of rows
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  useEffect(() => { setPage(1); }, [search, filterPriority, filterPayer, filterAck, filterDenialCat, pageSize]);
  const pageStart = (page - 1) * pageSize;
  const paginatedClaims = useMemo(() => filtered.slice(pageStart, pageStart + pageSize), [filtered, pageStart, pageSize]);

  /* -- summary cards -- */
  const totalOutstanding = claims.reduce((sum, c) => sum + ((c.total_charge ?? 0) - (c.amount_paid ?? 0)), 0);
  const actionToday = claims.filter(c => c.priority <= 3).length;
  const timelyFilingRisk = claims.filter(c => c.priority === 1).reduce((s, c) => s + (c.total_charge ?? 0), 0);

  /* Denial category counts (denied claims only) */
  const denialCounts = useMemo(() => {
    const c = { appeal: 0, correct_resubmit: 0, write_off: 0, patient_responsibility: 0, followup: 0 };
    for (const cl of claims) {
      if (cl.status !== "denied" || !cl.denial_category) continue;
      if (cl.denial_category in c) (c as any)[cl.denial_category]++;
    }
    return c;
  }, [claims]);

  // Recovered this month — need separate query, approximate with paid claims
  const [recoveredThisMonth, setRecoveredThisMonth] = useState(0);
  useEffect(() => {
    if (!activeCompanyId) return;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    // Pass 1B-1: read net cash applied to the company this month from the
    // ledger (claim_payments) rather than claim_records.amount_paid filtered
    // by paid_at. amount_paid is net of reversals attributed to the original
    // payment date, so a reversal posted this month would otherwise be missed.
    // RLS on claim_payments scopes to get_my_company_id() automatically.
    (supabase
      .from("claim_payments" as any)
      .select("amount")
      .eq("company_id", activeCompanyId)
      .gte("applied_at", monthStart.toISOString()) as any)
      .then(({ data }: { data: any }) => {
        setRecoveredThisMonth((data ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0));
      });
  }, [activeCompanyId]);

  if (loading) return <AdminLayout><PageLoader /></AdminLayout>;

  const denialInfo = selectedClaim?.denial_code ? getDenialTranslation(selectedClaim.denial_code) : null;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">AR Command Center</h1>

        {/* Biller Task Queue */}
        <BillerTaskQueue />

        <Tabs defaultValue="todays-work" className="space-y-4">
          <TabsList>
            <TabsTrigger value="todays-work">Today's Work</TabsTrigger>
            <TabsTrigger value="all-claims">All Claims</TabsTrigger>
          </TabsList>

          <TabsContent value="todays-work" className="space-y-4">
            <BillingWorkQueue refreshKey={workQueueRefreshKey} onOpenClaim={(claimId) => {
              const claim = claims.find(c => c.id === claimId);
              if (claim) setSelectedClaim(claim);
            }} />
          </TabsContent>

          <TabsContent value="all-claims" className="space-y-6">
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
              {/* Denial category chips */}
              {(["appeal","correct_resubmit","write_off","patient_responsibility","followup"] as const).some(k => denialCounts[k] > 0) && (
                <div className="w-full flex flex-wrap items-center gap-2 pb-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mr-1">Denials:</span>
                  {([
                    ["appeal","Appealable","destructive"],
                    ["correct_resubmit","Correct & Resubmit","warning"],
                    ["write_off","Write-Off","secondary"],
                    ["patient_responsibility","Patient Resp.","secondary"],
                    ["followup","Follow-Up","outline"],
                  ] as const).map(([key, label, variant]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilterDenialCat(filterDenialCat === key ? "all" : key)}
                      className={`transition-opacity ${filterDenialCat !== "all" && filterDenialCat !== key ? "opacity-40" : ""}`}
                    >
                      <Badge variant={variant as any} className="text-xs cursor-pointer">
                        {denialCounts[key]} {label}
                      </Badge>
                    </button>
                  ))}
                  {filterDenialCat !== "all" && (
                    <button type="button" onClick={() => setFilterDenialCat("all")} className="text-xs text-muted-foreground underline">clear</button>
                  )}
                </div>
              )}
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
                  <SelectItem value="Missing Acknowledgment">Missing Acknowledgment</SelectItem>
                  <SelectItem value="Filing Deadline">Filing Deadline</SelectItem>
                  <SelectItem value="Denied — Action Required">Denied — Action Required</SelectItem>
                  <SelectItem value="Partial Pay — Recover">Partial Pay — Recover</SelectItem>
                  <SelectItem value="No Response — 45+ Days">No Response — 45+ Days</SelectItem>
                  <SelectItem value="Aging — Monitor">Aging — Monitor</SelectItem>
                  <SelectItem value="Follow Up">Follow Up</SelectItem>
                  <SelectItem value="Pending — Awaiting Payer">Pending — Awaiting Payer</SelectItem>
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
              <Select value={filterAck} onValueChange={setFilterAck}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Clearinghouse status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clearinghouse acks</SelectItem>
                  <SelectItem value="any_rejected">Any rejection (999 / 277CA)</SelectItem>
                  <SelectItem value="rejected_999">Rejected — 999 (syntax)</SelectItem>
                  <SelectItem value="rejected_277ca">Rejected — 277CA (claim)</SelectItem>
                  <SelectItem value="accepted">Accepted / Forwarded</SelectItem>
                  <SelectItem value="no_ack">No ack received yet</SelectItem>
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
                    <th className="text-left p-3 font-medium">Clearinghouse</th>
                    <th className="text-left p-3 font-medium">Priority</th>
                    <th className="text-left p-3 font-medium">Next Step</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">No claims requiring AR follow-up</td></tr>
                  )}
                  {paginatedClaims.map(claim => (
                    <React.Fragment key={claim.id}>
                    <tr
                      className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => setSelectedClaim(claim)}
                    >
                      <td className="p-3 font-medium">
                        <div className="flex items-center gap-1.5">
                          {(claim.status === "denied" || claim.is_partial_paid) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedRow(expandedRow === claim.id ? null : claim.id);
                              }}
                              className="text-muted-foreground hover:text-foreground"
                              aria-label="Why this status?"
                            >
                              {expandedRow === claim.id
                                ? <ChevronDown className="h-3.5 w-3.5" />
                                : <ChevronRight className="h-3.5 w-3.5" />}
                            </button>
                          )}
                          <span>{claim.patient_name}</span>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground">{claim.payer_name ?? "—"}</td>
                      <td className="p-3 text-muted-foreground">{claim.run_date}</td>
                      <td className="p-3 text-right">
                        ${(claim.total_charge ?? 0).toFixed(2)}
                        {claim.is_partial_paid && (
                          <div className="text-[10px] text-amber-600 font-medium">
                            paid ${(claim.amount_paid ?? 0).toFixed(2)}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right">{claim.days_outstanding}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">
                          {claim.is_partial_paid ? "partial paid" : claim.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {claim.acknowledgment_status === "rejected_999" && (
                          <Badge variant="destructive" className="text-xs whitespace-nowrap" title={claim.rejection_reason ?? ""}>999 Rejected</Badge>
                        )}
                        {claim.acknowledgment_status === "rejected_277ca" && (
                          <Badge variant="destructive" className="text-xs whitespace-nowrap" title={claim.rejection_reason ?? ""}>277CA Rejected</Badge>
                        )}
                        {claim.acknowledgment_status === "accepted_999" && (
                          <Badge variant="secondary" className="text-xs whitespace-nowrap">999 OK</Badge>
                        )}
                        {claim.acknowledgment_status === "accepted_277ca" && (
                          <Badge variant="secondary" className="text-xs whitespace-nowrap">277CA OK</Badge>
                        )}
                        {claim.acknowledgment_status === "forwarded_to_payer" && (
                          <Badge variant="secondary" className="text-xs whitespace-nowrap">Forwarded</Badge>
                        )}
                        {!claim.acknowledgment_status && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant={claim.priority_color as any} className="text-xs whitespace-nowrap">
                          {claim.priority_label}
                        </Badge>
                      </td>
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const a = getNextAction(claim);
                          if (!a) return <span className="text-xs text-muted-foreground">—</span>;
                          const Icon = a.icon;
                          return (
                            <Button
                              size="sm"
                              variant={a.variant}
                              className="h-7 text-xs whitespace-nowrap"
                              onClick={() => a.run()}
                            >
                              <Icon className="h-3 w-3 mr-1" />
                              {a.label}
                            </Button>
                          );
                        })()}
                      </td>
                    </tr>
                    {expandedRow === claim.id && (claim.status === "denied" || claim.is_partial_paid) && (() => {
                      const v = classifyDenial(claim);
                      const tone =
                        v.recoverable === "no"  ? "border-l-muted-foreground/30 bg-muted/40"
                      : v.recoverable === "yes" ? "border-l-emerald-500 bg-emerald-500/5"
                                                : "border-l-amber-500 bg-amber-500/5";
                      return (
                        <tr className="border-b">
                          <td colSpan={9} className={`p-3 border-l-4 ${tone}`}>
                            <div className="flex items-start gap-2 text-sm">
                              <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                              <div className="space-y-1">
                                <p className="font-medium">
                                  {v.headline}
                                  {v.carc && <span className="ml-2 text-xs text-muted-foreground">({v.carc.code})</span>}
                                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                                    {v.recoverable === "yes"  && "· Recoverable"}
                                    {v.recoverable === "no"   && "· Not recoverable"}
                                    {v.recoverable === "maybe"&& "· Review needed"}
                                  </span>
                                </p>
                                <p className="text-muted-foreground">{v.plainEnglish}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })()}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              {filtered.length > 0 && (
                <TablePagination
                  page={page}
                  pageSize={pageSize}
                  totalItems={filtered.length}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedClaim} onOpenChange={open => { if (!open) setSelectedClaim(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedClaim && (
            <div className="space-y-5 pt-2">
              <SheetHeader>
                <SheetTitle className="text-lg flex items-center justify-between gap-2">
                  <span className="truncate">{selectedClaim.patient_name}</span>
                  <TimelineTrigger claimId={selectedClaim.id} variant="button" />
                </SheetTitle>
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
                {sheetReady ? (
                  <PayerContactLookup payerType={selectedClaim.payer_type} payerName={selectedClaim.payer_name} />
                ) : (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                )}
              </div>

              {/* Timely filing deadline */}
              <div className="flex items-center gap-2">
                {sheetReady && (
                  <TimelyFilingBadge runDate={selectedClaim.run_date} payerType={selectedClaim.payer_type} companyId={selectedClaim.company_id} />
                )}
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
              {sheetReady && (
                <ResubmissionHistory claimId={selectedClaim.id} submittedAt={selectedClaim.submitted_at} />
              )}

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
        <Suspense fallback={null}>
          <DenialRecoveryEngine
            claim={recoveryClaim}
            open={recoveryOpen}
            onOpenChange={open => { setRecoveryOpen(open); if (!open) setRecoveryClaim(null); }}
            onComplete={() => { fetchClaims(); setSelectedClaim(null); setWorkQueueRefreshKey(k => k + 1); }}
          />
        </Suspense>
      )}
      <ClaimTimelineDrawer />

      {/* Close-out confirmation for non-recoverable denials */}
      <Dialog open={closeOutOpen} onOpenChange={(o) => { setCloseOutOpen(o); if (!o) setCloseOutClaim(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close this claim?</DialogTitle>
            <DialogDescription asChild>
              {closeOutClaim ? (
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="font-medium text-foreground">{closeOutClaim.patient_name}</span>
                    {" · $"}{(closeOutClaim.total_charge ?? 0).toFixed(2)}
                  </p>
                  {(() => {
                    const v = classifyDenial(closeOutClaim);
                    return (
                      <div className="rounded-md border bg-muted/40 p-3 space-y-1">
                        <p className="font-medium text-foreground">{v.headline}{v.carc && <span className="ml-2 text-xs text-muted-foreground">({v.carc.code})</span>}</p>
                        <p>{v.plainEnglish}</p>
                      </div>
                    );
                  })()}
                  <p className="text-muted-foreground">
                    Closing marks the claim as voided. Use this only when the classifier confirms there is no recoverable balance.
                  </p>
                </div>
              ) : <span />}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseOutOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={saving} onClick={confirmCloseOut}>Close claim</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

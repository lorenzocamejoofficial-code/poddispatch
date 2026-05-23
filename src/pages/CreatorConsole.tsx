import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search, CheckCircle2, XCircle, Ban, RefreshCw, Loader2, Trash2, KeyRound, Pencil,
  ChevronDown, ChevronRight, Shield, Archive, RotateCcw, MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { CreatorLayout } from "@/components/layout/CreatorLayout";
import { CompanyVerificationPanel, type VerificationResult } from "@/components/creator/CompanyVerificationPanel";
import { logAuditEvent } from "@/lib/audit-logger";
import { Checkbox } from "@/components/ui/checkbox";
import { RemittanceQuarantinePanel } from "@/components/creator/RemittanceQuarantinePanel";
import { ReconciliationReportPanel } from "@/components/creator/ReconciliationReportPanel";
import { SupportTicketsPanel } from "@/components/creator/SupportTicketsPanel";
import { LoadTestHarnessPanel } from "@/components/creator/LoadTestHarnessPanel";
import { TablePagination } from "@/components/ui/table-pagination";

interface CompanyRecord {
  id: string;
  name: string;
  onboarding_status: string;
  owner_email: string | null;
  owner_user_id: string | null;
  owner_name?: string;
  created_at: string;
  approved_at: string | null;
  suspended_reason: string | null;
  suspended_at: string | null;
  rejected_reason: string | null;
  deleted_at: string | null;
  npi_number: string | null;
  state_of_operation: string | null;
  current_software: string | null;
  years_in_operation: number | null;
  has_inhouse_biller: boolean | null;
  hipaa_privacy_officer: string | null;
  is_protected?: boolean;
}

interface VerificationSnapshot {
  npi_verified: boolean;
  medicare_enrolled: boolean;
  oig_clear: boolean;
  npi_result: any;
  medicare_result: any;
  oig_result: any;
  approver_email: string | null;
  approved_at: string;
  manual_notes: string | null;
}

type ModalAction =
  | { type: "suspend"; company: CompanyRecord }
  | { type: "delete"; company: CompanyRecord }
  | { type: "edit"; company: CompanyRecord }
  | { type: "reset_password"; company: CompanyRecord }
  | { type: "reject"; company: CompanyRecord }
  | null;

const RETENTION_YEARS = 10;
const PAGE_SIZE_DEFAULT = 25;

// Tab keys mapped to onboarding_status (or "archived" virtual key)
const TAB_TO_STATUS: Record<string, string> = {
  pending: "pending_approval",
  active: "active",
  awaiting_payment: "approved_pending_payment",
  suspended: "suspended",
  rejected: "rejected",
};

export default function CreatorConsole() {
  const { isSystemCreator } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [archivedCompanies, setArchivedCompanies] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [modal, setModal] = useState<ModalAction>(null);
  const [confirmText, setConfirmText] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [editName, setEditName] = useState("");
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [verificationResults, setVerificationResults] = useState<Record<string, VerificationResult>>({});
  const [snapshots, setSnapshots] = useState<Record<string, VerificationSnapshot>>({});
  const [snapshotLoaded, setSnapshotLoaded] = useState<Record<string, boolean>>({});

  // Unified selection: cleared when tab changes.
  const [activeTab, setActiveTab] = useState<string>("active");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pageByTab, setPageByTab] = useState<Record<string, number>>({});
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);

  // Bulk action dialogs
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkConfirmText, setBulkConfirmText] = useState("");
  const [bulkSuspendOpen, setBulkSuspendOpen] = useState(false);
  const [bulkSuspendReason, setBulkSuspendReason] = useState("");
  const [bulkSuspendConfirm, setBulkSuspendConfirm] = useState("");

  useEffect(() => {
    if (!isSystemCreator) { navigate("/"); return; }
    loadCompanies();
  }, [isSystemCreator, navigate]);

  // Reset selection + page when tab changes or search changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeTab]);

  useEffect(() => {
    setPageByTab((p) => ({ ...p, [activeTab]: 1 }));
  }, [search, activeTab]);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, onboarding_status, owner_email, owner_user_id, created_at, approved_at, suspended_reason, suspended_at, rejected_reason, deleted_at, npi_number, state_of_operation, current_software, years_in_operation, has_inhouse_biller, hipaa_privacy_officer")
      .eq("creator_test_tenant", false)
      .eq("is_sandbox", false)
      .order("created_at", { ascending: false });

    if (error) { console.error(error); setLoading(false); return; }

    const rows = (data ?? []) as unknown as CompanyRecord[];
    const ownerIds = rows.map(c => c.owner_user_id).filter(Boolean) as string[];
    const companyIds = rows.map(c => c.id);

    // Batch: fetch profile names + verification rows in parallel (replaces N RPC calls)
    const [profilesRes, verificationsRes] = await Promise.all([
      ownerIds.length > 0
        ? supabase.from("profiles").select("user_id, full_name").in("user_id", ownerIds)
        : Promise.resolve({ data: [] as any[] }),
      companyIds.length > 0
        ? supabase
            .from("company_verifications")
            .select("company_id, npi_verified, medicare_enrolled, oig_clear")
            .in("company_id", companyIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const profileMap: Record<string, string> = Object.fromEntries(
      (profilesRes.data ?? []).map((p: any) => [p.user_id, p.full_name])
    );

    // Protected = approved_at IS NOT NULL AND any verification flag is true
    const verifiedSet = new Set<string>();
    (verificationsRes.data ?? []).forEach((v: any) => {
      if (v.npi_verified || v.medicare_enrolled || v.oig_clear) verifiedSet.add(v.company_id);
    });

    const enriched = rows.map(c => ({
      ...c,
      owner_name: c.owner_user_id ? profileMap[c.owner_user_id] || "—" : "—",
      is_protected: !!c.approved_at && verifiedSet.has(c.id),
    }));

    setCompanies(enriched.filter(c => !c.deleted_at));
    setArchivedCompanies(enriched.filter(c => !!c.deleted_at));
    setLoading(false);
  }, []);

  const loadSnapshot = useCallback(async (companyId: string) => {
    if (snapshotLoaded[companyId]) return;
    const { data } = await supabase
      .from("company_verifications")
      .select("npi_verified, medicare_enrolled, oig_clear, npi_result, medicare_result, oig_result, approver_email, approved_at, manual_notes")
      .eq("company_id", companyId)
      .order("approved_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) setSnapshots(prev => ({ ...prev, [companyId]: data as VerificationSnapshot }));
    setSnapshotLoaded(prev => ({ ...prev, [companyId]: true }));
  }, [snapshotLoaded]);

  const toggleExpand = (c: CompanyRecord) => {
    const next = expandedCompany === c.id ? null : c.id;
    setExpandedCompany(next);
    if (next && c.approved_at) loadSnapshot(c.id);
  };

  const invokeAction = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!modal) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-company", {
        body: { companyId: modal.company.id, action, ...extra },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (action === "force_password_reset") toast.success("Password reset link generated.");
      else if (data?.archived) {
        toast.success(`"${modal.company.name}" archived. Data retained for legal compliance.`);
        if (data.stripe_cancel_status && !["cancelled", "no_subscription", "already_cancelled", "skipped: no STRIPE_SECRET_KEY configured"].includes(data.stripe_cancel_status)) {
          toast.warning(`Stripe: ${data.stripe_cancel_status}`);
        }
      } else if (data?.deleted) {
        toast.success(`"${modal.company.name}" permanently deleted.`);
      } else if (data?.restored) {
        toast.success(`"${modal.company.name}" restored.`);
      } else {
        toast.success("Action completed successfully.");
      }
      setModal(null);
      setConfirmText("");
      setReasonText("");
      await loadCompanies();
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    }
    setActionLoading(false);
  };

  const handleApprove = async (c: CompanyRecord) => {
    const vr = verificationResults[c.id];
    if (!vr) {
      toast.error("Run the verification panel first — expand the company row.");
      return;
    }
    if (vr.npi.status === "pending" || vr.medicare.status === "pending" || vr.oig.status === "pending") {
      toast.error("Verification still loading. Wait for all checks to complete.");
      return;
    }
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-company", {
        body: { companyId: c.id, action: "approve", verification: vr },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await logAuditEvent({
        action: "approve" as any,
        tableName: "companies",
        recordId: c.id,
        newData: {
          verification_results: { npi: vr.npi, medicare: vr.medicare, oig: vr.oig },
          decision: "approve",
        },
        notes: `Company approved with verification: NPI=${vr.npi.status}, Medicare=${vr.medicare.status}, OIG=${vr.oig.status}`,
      });
      toast.success("Company approved!");
      await loadCompanies();
    } catch (err: any) { toast.error(err.message || "Failed to approve"); }
    setActionLoading(false);
  };

  const invokeDirectUnsuspend = async (id: string) => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-company", { body: { companyId: id, action: "unsuspend" } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Company reactivated!");
      await loadCompanies();
    } catch (err: any) { toast.error(err.message); }
    setActionLoading(false);
  };

  const invokeRestoreArchived = async (c: CompanyRecord) => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-company", {
        body: { companyId: c.id, action: "restore_archived", reason: "Restored by system creator" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`"${c.name}" restored.`);
      await loadCompanies();
    } catch (err: any) { toast.error(err.message || "Failed to restore"); }
    setActionLoading(false);
  };

  // Run a manage-company action against many ids in parallel.
  const runBulk = async (
    ids: string[],
    nameLookup: (id: string) => string | undefined,
    body: (id: string) => Record<string, unknown>,
    successVerb: string,
  ) => {
    if (ids.length === 0) return;
    const pendingToast = toast.loading(`${successVerb} ${ids.length} compan${ids.length === 1 ? "y" : "ies"}…`);
    const results = await Promise.allSettled(
      ids.map(async (id) => {
        const { data, error } = await supabase.functions.invoke("manage-company", { body: body(id) });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return data;
      })
    );
    let success = 0;
    const errors: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") success++;
      else errors.push(`${nameLookup(ids[i]) ?? ids[i]}: ${(r.reason as Error)?.message ?? "failed"}`);
    });
    toast.dismiss(pendingToast);
    if (success > 0) toast.success(`${successVerb} ${success} compan${success === 1 ? "y" : "ies"}.`);
    if (errors.length > 0) toast.error(`${errors.length} failed: ${errors.slice(0, 2).join("; ")}${errors.length > 2 ? "…" : ""}`);
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds).filter((id) => {
      const pool = activeTab === "archived" ? archivedCompanies : companies;
      const c = pool.find(x => x.id === id);
      return c && !c.is_protected;
    });
    if (ids.length === 0) return;
    // Close dialog FIRST so user gets immediate feedback, then run in parallel.
    setBulkDeleteOpen(false);
    setBulkConfirmText("");
    const idsToDelete = [...ids];
    setSelectedIds(new Set());
    setActionLoading(true);
    const pool = activeTab === "archived" ? archivedCompanies : companies;
    const lookup = (id: string) => pool.find(c => c.id === id)?.name;
    await runBulk(
      idsToDelete,
      lookup,
      (id) => ({ companyId: id, action: "delete", reason: "Bulk delete by system creator" }),
      "Deleted",
    );
    await loadCompanies();
    setActionLoading(false);
  };

  const handleBulkSuspend = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || !bulkSuspendReason.trim()) return;
    setBulkSuspendOpen(false);
    const reason = bulkSuspendReason.trim();
    const idsToSuspend = [...ids];
    setBulkSuspendReason("");
    setBulkSuspendConfirm("");
    setSelectedIds(new Set());
    setActionLoading(true);
    const lookup = (id: string) => companies.find(c => c.id === id)?.name;
    await runBulk(
      idsToSuspend,
      lookup,
      (id) => ({ companyId: id, action: "suspend", reason }),
      "Suspended",
    );
    await loadCompanies();
    setActionLoading(false);
  };

  // -------- Filtering / pagination ----------
  const filtered = useCallback((status: string) =>
    companies.filter(c => {
      if (c.onboarding_status !== status) return false;
      const q = search.toLowerCase();
      return !q || c.name.toLowerCase().includes(q) || (c.owner_email ?? "").toLowerCase().includes(q);
    }), [companies, search]);

  const filteredArchived = useCallback(() => archivedCompanies.filter(c => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || (c.owner_email ?? "").toLowerCase().includes(q);
  }), [archivedCompanies, search]);

  const paginate = <T,>(items: T[], tabKey: string): T[] => {
    const page = pageByTab[tabKey] ?? 1;
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  };

  const setPage = (tabKey: string, page: number) => setPageByTab((p) => ({ ...p, [tabKey]: page }));

  // Counts per status (memoized for tab badges)
  const counts = useMemo(() => ({
    pending: filtered("pending_approval").length,
    active: filtered("active").length,
    awaiting_payment: filtered("approved_pending_payment").length,
    suspended: filtered("suspended").length,
    rejected: filtered("rejected").length,
    archived: filteredArchived().length,
  }), [filtered, filteredArchived]);

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      active: "bg-[hsl(var(--status-green-bg))] text-[hsl(var(--status-green))]",
      pending_approval: "bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]",
      approved_pending_payment: "bg-primary/15 text-primary",
      suspended: "bg-destructive/15 text-destructive",
      rejected: "bg-destructive/15 text-destructive",
    };
    return colors[s] || "bg-muted text-muted-foreground";
  };

  const renderCompanyName = (c: CompanyRecord) => (
    <div className="flex items-center gap-1.5">
      {c.is_protected && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Protected — data under legal retention</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      <span>{c.name}</span>
    </div>
  );

  const renderActionsDropdown = (c: CompanyRecord) => {
    const isPending = c.onboarding_status === "pending_approval";
    const isActive = c.onboarding_status === "active";
    const isSuspended = c.onboarding_status === "suspended";
    const isRejected = c.onboarding_status === "rejected";
    const isAwaitingPayment = c.onboarding_status === "approved_pending_payment";

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={actionLoading}>
            {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-3.5 w-3.5" />}
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {isPending && (
            <>
              <DropdownMenuItem onClick={() => handleApprove(c)}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-[hsl(var(--status-green))]" /> Approve
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => { setModal({ type: "reject", company: c }); setReasonText(""); }}
              >
                <XCircle className="h-3.5 w-3.5 mr-2" /> Reject
              </DropdownMenuItem>
            </>
          )}

          {isActive && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => { setModal({ type: "suspend", company: c }); setReasonText(""); setConfirmText(""); }}
            >
              <Ban className="h-3.5 w-3.5 mr-2" /> Suspend
            </DropdownMenuItem>
          )}

          {isSuspended && (
            <DropdownMenuItem onClick={() => invokeDirectUnsuspend(c.id)}>
              <RefreshCw className="h-3.5 w-3.5 mr-2" /> Unsuspend
            </DropdownMenuItem>
          )}

          {(isActive || isSuspended) && (
            <>
              <DropdownMenuItem onClick={() => { setModal({ type: "reset_password", company: c }); setConfirmText(""); }}>
                <KeyRound className="h-3.5 w-3.5 mr-2" /> Reset Password
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setModal({ type: "edit", company: c }); setEditName(c.name); }}>
                <Pencil className="h-3.5 w-3.5 mr-2" /> Edit Profile
              </DropdownMenuItem>
            </>
          )}

          {(isActive || isSuspended || isRejected || isAwaitingPayment) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => { setModal({ type: "delete", company: c }); setConfirmText(""); setReasonText(""); }}
              >
                {c.is_protected
                  ? <><Archive className="h-3.5 w-3.5 mr-2" /> Archive</>
                  : <><Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Forever</>}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  // ---------- Selection helpers ----------
  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAllOnPage = (pageItems: CompanyRecord[], deletableOnly = false) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const items = deletableOnly ? pageItems.filter(c => !c.is_protected) : pageItems;
      const allSelected = items.length > 0 && items.every(c => next.has(c.id));
      if (allSelected) items.forEach(c => next.delete(c.id));
      else items.forEach(c => next.add(c.id));
      return next;
    });
  };

  // ---------- Bulk action toolbar ----------
  const BulkToolbar = ({ tabKey, selectableIds }: { tabKey: string; selectableIds: string[] }) => {
    const count = selectedIds.size;
    if (count === 0) return null;
    const showSuspend = tabKey === "active";
    return (
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
        <span className="text-sm font-medium">{count} selected</span>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
          {showSuspend && (
            <Button
              size="sm"
              variant="destructive"
              className="gap-1"
              disabled={actionLoading}
              onClick={() => { setBulkSuspendOpen(true); setBulkSuspendReason(""); setBulkSuspendConfirm(""); }}
            >
              <Ban className="h-3 w-3" /> Suspend {count}
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            className="gap-1"
            disabled={actionLoading || selectableIds.length === 0}
            onClick={() => { setBulkDeleteOpen(true); setBulkConfirmText(""); }}
          >
            <Trash2 className="h-3 w-3" /> Delete {selectableIds.length} Forever
          </Button>
        </div>
      </div>
    );
  };

  // ---------- Expandable row (with checkbox) ----------
  const ExpandableRow = ({ c, allowVerificationPanel, selectable }: { c: CompanyRecord; allowVerificationPanel: boolean; selectable: boolean }) => (
    <>
      <TableRow className="cursor-pointer" onClick={() => toggleExpand(c)}>
        <TableCell className="w-8" onClick={(e) => e.stopPropagation()}>
          {selectable && !c.is_protected ? (
            <Checkbox
              checked={selectedIds.has(c.id)}
              onCheckedChange={() => toggleOne(c.id)}
              aria-label={`Select ${c.name}`}
            />
          ) : null}
        </TableCell>
        <TableCell className="w-8">
          {expandedCompany === c.id
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          }
        </TableCell>
        <TableCell className="font-medium">{renderCompanyName(c)}</TableCell>
        <TableCell className="text-xs text-muted-foreground">{c.owner_name}</TableCell>
        <TableCell className="text-xs text-muted-foreground">{c.owner_email || "—"}</TableCell>
        <TableCell className="text-xs text-muted-foreground">{format(new Date(c.created_at), "MMM d, yyyy")}</TableCell>
        <TableCell>
          <Badge variant="outline" className={statusBadge(c.onboarding_status)}>
            {c.onboarding_status.replace(/_/g, " ")}
          </Badge>
        </TableCell>
        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-end">{renderActionsDropdown(c)}</div>
        </TableCell>
      </TableRow>
      {expandedCompany === c.id && (
        <TableRow>
          <TableCell colSpan={8} className="p-4 bg-muted/20">
            {c.onboarding_status === "pending_approval" && allowVerificationPanel ? (
              <CompanyVerificationPanel
                company={{
                  id: c.id,
                  name: c.name,
                  npi_number: c.npi_number,
                  state_of_operation: c.state_of_operation,
                  owner_email: c.owner_email,
                  current_software: c.current_software,
                  years_in_operation: c.years_in_operation,
                  has_inhouse_biller: c.has_inhouse_biller,
                  hipaa_privacy_officer: c.hipaa_privacy_officer,
                }}
                onVerificationComplete={(r) => setVerificationResults(prev => ({ ...prev, [c.id]: r }))}
              />
            ) : (
              <VerificationSnapshotView
                company={c}
                snapshot={snapshots[c.id]}
                loaded={!!snapshotLoaded[c.id]}
              />
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );

  // ---------- Generic status table ----------
  const CompanyTableExpandable = ({ items, allowVerificationPanel, tabKey }: { items: CompanyRecord[]; allowVerificationPanel: boolean; tabKey: string }) => {
    const page = pageByTab[tabKey] ?? 1;
    const pageItems = paginate(items, tabKey);
    const deletableOnPage = pageItems.filter(c => !c.is_protected);
    const allDeletableSelected = deletableOnPage.length > 0 && deletableOnPage.every(c => selectedIds.has(c.id));
    const someDeletableSelected = deletableOnPage.some(c => selectedIds.has(c.id));
    const selectableIds = items.filter(c => !c.is_protected && selectedIds.has(c.id)).map(c => c.id);

    if (items.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">No companies in this category.</p>;

    return (
      <>
        <BulkToolbar tabKey={tabKey} selectableIds={selectableIds} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                {deletableOnPage.length > 0 && (
                  <Checkbox
                    checked={allDeletableSelected ? true : someDeletableSelected ? "indeterminate" : false}
                    onCheckedChange={() => toggleAllOnPage(pageItems, true)}
                    aria-label="Select all on page"
                  />
                )}
              </TableHead>
              <TableHead className="w-8"></TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.map(c => <ExpandableRow key={c.id} c={c} allowVerificationPanel={allowVerificationPanel} selectable />)}
          </TableBody>
        </Table>
        <TablePagination
          page={page}
          pageSize={pageSize}
          totalItems={items.length}
          onPageChange={(p) => setPage(tabKey, p)}
          onPageSizeChange={setPageSize}
        />
      </>
    );
  };

  // ---------- Archived table (with checkbox + pagination) ----------
  const ArchivedTable = ({ items }: { items: CompanyRecord[] }) => {
    const tabKey = "archived";
    const page = pageByTab[tabKey] ?? 1;
    const pageItems = paginate(items, tabKey);
    const deletableOnPage = pageItems.filter(c => !c.is_protected);
    const allSelected = deletableOnPage.length > 0 && deletableOnPage.every(c => selectedIds.has(c.id));
    const someSelected = deletableOnPage.some(c => selectedIds.has(c.id));
    const selectableIds = items.filter(c => !c.is_protected && selectedIds.has(c.id)).map(c => c.id);

    if (items.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">No archived companies.</p>;

    return (
      <>
        <BulkToolbar tabKey={tabKey} selectableIds={selectableIds} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                {deletableOnPage.length > 0 && (
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={() => toggleAllOnPage(pageItems, true)}
                    aria-label="Select all deletable on page"
                  />
                )}
              </TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Owner Email</TableHead>
              <TableHead>Archived</TableHead>
              <TableHead>Eligible for purge</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.map(c => {
              const archivedAt = c.deleted_at ? new Date(c.deleted_at) : null;
              const purgeAt = archivedAt ? new Date(archivedAt.getTime() + RETENTION_YEARS * 365 * 24 * 60 * 60 * 1000) : null;
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    {!c.is_protected && (
                      <Checkbox
                        checked={selectedIds.has(c.id)}
                        onCheckedChange={() => toggleOne(c.id)}
                        aria-label={`Select ${c.name}`}
                      />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{renderCompanyName(c)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.owner_email || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{archivedAt ? format(archivedAt, "MMM d, yyyy") : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{purgeAt ? format(purgeAt, "MMM d, yyyy") : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button size="sm" variant="default" className="gap-1 text-xs" disabled={actionLoading} onClick={() => invokeRestoreArchived(c)}>
                        <RotateCcw className="h-3 w-3" /> Restore
                      </Button>
                      {!c.is_protected && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={actionLoading}
                          onClick={() => { setModal({ type: "delete", company: c }); setConfirmText(""); setReasonText(""); }}
                        >
                          <Trash2 className="h-3 w-3" /> Delete Forever
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <TablePagination
          page={page}
          pageSize={pageSize}
          totalItems={items.length}
          onPageChange={(p) => setPage(tabKey, p)}
          onPageSizeChange={setPageSize}
        />
      </>
    );
  };

  return (
    <CreatorLayout title="Company Console">
      <Collapsible className="mb-4">
        <CollapsibleTrigger className="text-xs text-primary hover:underline">ℹ️ How this works</CollapsibleTrigger>
        <CollapsibleContent className="mt-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
          <p>Single console for the full company lifecycle. Click a row to expand the verification view.</p>
          <p><strong>Pending</strong>: expand to run NPI / Medicare / OIG checks. Verification snapshot is required before Approve and is permanently retained.</p>
          <p>Companies showing <Shield className="inline h-3 w-3 text-primary" /> are <strong>protected</strong> — data is under legal retention. Their delete button reads <strong>Archive</strong> and preserves all clinical records.</p>
          <p>Test/unverified companies show <Trash2 className="inline h-3 w-3 text-destructive" /> <strong>Delete</strong> — they hard-delete permanently.</p>
          <p>Tick the checkboxes to select multiple at once. Use the bulk bar to suspend or delete in one go. Lists are paginated at {PAGE_SIZE_DEFAULT} per page.</p>
        </CollapsibleContent>
      </Collapsible>

      <div className="relative max-w-md mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by company name or email..." className="pl-10" />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading companies...
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending">
              Pending {counts.pending > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px]">{counts.pending}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="active">Active ({counts.active})</TabsTrigger>
            <TabsTrigger value="awaiting_payment">
              Awaiting Payment {counts.awaiting_payment > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px]">{counts.awaiting_payment}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="suspended">
              Suspended {counts.suspended > 0 && <Badge variant="destructive" className="ml-1.5 text-[10px]">{counts.suspended}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
            <TabsTrigger value="archived">Archived ({counts.archived})</TabsTrigger>
            <TabsTrigger value="remittance_quarantine">Remittance Quarantine</TabsTrigger>
            <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
            <TabsTrigger value="acknowledgments">Acknowledgments</TabsTrigger>
            <TabsTrigger value="support">Support</TabsTrigger>
            <TabsTrigger value="loadtest">Load Test</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card><CardContent className="pt-4"><CompanyTableExpandable items={filtered("pending_approval")} allowVerificationPanel tabKey="pending" /></CardContent></Card>
          </TabsContent>
          <TabsContent value="active">
            <Card><CardContent className="pt-4"><CompanyTableExpandable items={filtered("active")} allowVerificationPanel={false} tabKey="active" /></CardContent></Card>
          </TabsContent>
          <TabsContent value="awaiting_payment">
            <Card><CardContent className="pt-4"><CompanyTableExpandable items={filtered("approved_pending_payment")} allowVerificationPanel={false} tabKey="awaiting_payment" /></CardContent></Card>
          </TabsContent>
          <TabsContent value="suspended">
            <Card><CardContent className="pt-4"><CompanyTableExpandable items={filtered("suspended")} allowVerificationPanel={false} tabKey="suspended" /></CardContent></Card>
          </TabsContent>
          <TabsContent value="rejected">
            <Card><CardContent className="pt-4"><CompanyTableExpandable items={filtered("rejected")} allowVerificationPanel={false} tabKey="rejected" /></CardContent></Card>
          </TabsContent>
          <TabsContent value="archived">
            <Card><CardContent className="pt-4"><ArchivedTable items={filteredArchived()} /></CardContent></Card>
          </TabsContent>
          <TabsContent value="remittance_quarantine">
            <RemittanceQuarantinePanel />
          </TabsContent>
          <TabsContent value="reconciliation">
            <ReconciliationReportPanel />
          </TabsContent>
          <TabsContent value="acknowledgments">
            <AcknowledgmentsPanel />
          </TabsContent>
          <TabsContent value="support">
            <SupportTicketsPanel />
          </TabsContent>
          <TabsContent value="loadtest">
            <LoadTestHarnessPanel />
          </TabsContent>
        </Tabs>
      )}

      {/* Suspend Modal */}
      <Dialog open={modal?.type === "suspend"} onOpenChange={(open) => { if (!open) setModal(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend Company</DialogTitle>
            <DialogDescription>Suspend "{modal?.company.name}" — all users will be locked out until unsuspended.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea placeholder="Reason for suspension (required)..." value={reasonText} onChange={(e) => setReasonText(e.target.value)} className="h-20" />
            <p className="text-xs text-muted-foreground">Type <strong>OVERRIDE</strong> to confirm:</p>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="OVERRIDE" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button variant="destructive" disabled={confirmText !== "OVERRIDE" || !reasonText.trim() || actionLoading} onClick={() => invokeAction("suspend", { reason: reasonText.trim() })}>
              {actionLoading && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />} Suspend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={modal?.type === "reject"} onOpenChange={(open) => { if (!open) setModal(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Company</DialogTitle>
            <DialogDescription>Reject "{modal?.company.name}". The owner will see this reason on their pending screen.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Reason for rejection (required)..." value={reasonText} onChange={(e) => setReasonText(e.target.value)} className="h-20" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button variant="destructive" disabled={!reasonText.trim() || actionLoading} onClick={() => invokeAction("reject", { reason: reasonText.trim() })}>
              {actionLoading && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />} Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete / Archive Modal */}
      <Dialog open={modal?.type === "delete"} onOpenChange={(open) => { if (!open) setModal(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {modal?.company.is_protected ? "Archive Company" : "Delete Company Permanently"}
            </DialogTitle>
            <DialogDescription>
              {modal?.company.is_protected
                ? `"${modal?.company.name}" passed verification and is under legal retention. It will be archived (data preserved for ${RETENTION_YEARS} years) and any active subscription will be cancelled.`
                : `"${modal?.company.name}" never passed verification (test or unverified account). This will permanently delete the company and all related rows. Cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea placeholder="Reason (optional but recommended for audit log)..." value={reasonText} onChange={(e) => setReasonText(e.target.value)} className="h-20" />
            <p className="text-xs text-muted-foreground">
              Type the company name <strong className="text-foreground">{modal?.company.name}</strong> to confirm:
            </p>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={modal?.company.name || ""} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={confirmText !== modal?.company.name || actionLoading}
              onClick={() => invokeAction("delete", { reason: reasonText.trim() || undefined })}
            >
              {actionLoading && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
              {modal?.company.is_protected ? "Archive" : "Delete Forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Modal */}
      <Dialog open={modal?.type === "reset_password"} onOpenChange={(open) => { if (!open) setModal(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Force Owner Password Reset</DialogTitle>
            <DialogDescription>Generate a password reset link for the owner of "{modal?.company.name}" ({modal?.company.owner_email}). A reset email will be triggered.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Type <strong>OVERRIDE</strong> to confirm:</p>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="OVERRIDE" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button disabled={confirmText !== "OVERRIDE" || actionLoading} onClick={() => invokeAction("force_password_reset")}>
              {actionLoading && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />} Send Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={modal?.type === "edit"} onOpenChange={(open) => { if (!open) setModal(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Company Profile</DialogTitle>
            <DialogDescription>Update company details for "{modal?.company.name}".</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Company Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button disabled={!editName.trim() || actionLoading} onClick={() => invokeAction("update_profile", { patch: { name: editName.trim() } })}>
              {actionLoading && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirm */}
      <Dialog open={bulkDeleteOpen} onOpenChange={(open) => { if (!open) { setBulkDeleteOpen(false); setBulkConfirmText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently delete {selectedIds.size} compan{selectedIds.size === 1 ? "y" : "ies"}?</DialogTitle>
            <DialogDescription>
              This will hard-delete all selected unprotected companies and their data. Protected (verified) companies in the selection will be skipped. Cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Type <strong>DELETE</strong> to confirm:</p>
            <Input value={bulkConfirmText} onChange={(e) => setBulkConfirmText(e.target.value)} placeholder="DELETE" className="font-mono" autoComplete="off" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setBulkDeleteOpen(false); setBulkConfirmText(""); }}>Cancel</Button>
            <Button variant="destructive" disabled={bulkConfirmText !== "DELETE" || actionLoading} onClick={handleBulkDelete}>
              {actionLoading && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />} Delete Forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Suspend Confirm */}
      <Dialog open={bulkSuspendOpen} onOpenChange={(open) => { if (!open) { setBulkSuspendOpen(false); setBulkSuspendReason(""); setBulkSuspendConfirm(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend {selectedIds.size} compan{selectedIds.size === 1 ? "y" : "ies"}?</DialogTitle>
            <DialogDescription>
              All selected companies will be suspended with the same reason. All of their users will be locked out until unsuspended.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea placeholder="Reason for suspension (required)..." value={bulkSuspendReason} onChange={(e) => setBulkSuspendReason(e.target.value)} className="h-20" />
            <p className="text-xs text-muted-foreground">Type <strong>OVERRIDE</strong> to confirm:</p>
            <Input value={bulkSuspendConfirm} onChange={(e) => setBulkSuspendConfirm(e.target.value)} placeholder="OVERRIDE" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setBulkSuspendOpen(false); setBulkSuspendReason(""); setBulkSuspendConfirm(""); }}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={bulkSuspendConfirm !== "OVERRIDE" || !bulkSuspendReason.trim() || actionLoading}
              onClick={handleBulkSuspend}
            >
              {actionLoading && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />} Suspend {selectedIds.size}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CreatorLayout>
  );
}

function VerificationSnapshotView({ company, snapshot, loaded }: { company: CompanyRecord; snapshot?: VerificationSnapshot; loaded: boolean }) {
  if (!company.approved_at) {
    return (
      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        No approval record. Verification snapshot only exists for approved companies.
      </div>
    );
  }
  if (!loaded) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground p-3">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading verification snapshot...
      </div>
    );
  }
  if (!snapshot) {
    return (
      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        No verification snapshot on file. This company was approved before verification snapshots were captured at approval.
      </div>
    );
  }
  const Pill = ({ ok, label }: { ok: boolean; label: string }) => (
    <Badge variant="outline" className={ok ? "bg-[hsl(var(--status-green))]/15 text-[hsl(var(--status-green))]" : "bg-[hsl(var(--status-yellow))]/15 text-[hsl(var(--status-yellow))]"}>
      {label}: {ok ? "Pass" : "Fail/Unknown"}
    </Badge>
  );
  return (
    <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> Verification Snapshot (at approval)
        </p>
        <p className="text-xs text-muted-foreground">
          Approved {format(new Date(snapshot.approved_at), "MMM d, yyyy")}
          {snapshot.approver_email ? ` by ${snapshot.approver_email}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Pill ok={snapshot.npi_verified} label="NPI" />
        <Pill ok={snapshot.medicare_enrolled} label="Medicare" />
        <Pill ok={snapshot.oig_clear} label="OIG" />
      </div>
      {(snapshot.npi_result || snapshot.medicare_result || snapshot.oig_result) && (
        <div className="text-xs space-y-1 text-muted-foreground border-t pt-2">
          {snapshot.npi_result?.registeredName && (
            <p><span className="font-medium text-foreground">NPI registered name:</span> {snapshot.npi_result.registeredName}</p>
          )}
          {snapshot.medicare_result?.specialty && (
            <p><span className="font-medium text-foreground">Medicare specialty:</span> {snapshot.medicare_result.specialty}</p>
          )}
          {snapshot.oig_result?.details && (
            <p className="text-destructive"><span className="font-medium">OIG:</span> {snapshot.oig_result.details}</p>
          )}
        </div>
      )}
      {snapshot.manual_notes && (
        <p className="text-xs text-muted-foreground border-t pt-2">
          <span className="font-medium text-foreground">Notes:</span> {snapshot.manual_notes}
        </p>
      )}
    </div>
  );
}

import { useEffect, useState, useCallback } from "react";
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
  const [selectedArchived, setSelectedArchived] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkConfirmText, setBulkConfirmText] = useState("");

  useEffect(() => {
    if (!isSystemCreator) { navigate("/"); return; }
    loadCompanies();
  }, [isSystemCreator, navigate]);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, onboarding_status, owner_email, owner_user_id, created_at, approved_at, suspended_reason, suspended_at, rejected_reason, deleted_at, npi_number, state_of_operation, current_software, years_in_operation, has_inhouse_biller, hipaa_privacy_officer")
      .order("created_at", { ascending: false });

    if (error) { console.error(error); setLoading(false); return; }

    const rows = (data ?? []) as unknown as CompanyRecord[];

    // Owner names
    const ownerIds = rows.map(c => c.owner_user_id).filter(Boolean) as string[];
    let profileMap: Record<string, string> = {};
    if (ownerIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ownerIds);
      if (profiles) profileMap = Object.fromEntries(profiles.map((p: any) => [p.user_id, p.full_name]));
    }

    // Protection status (DB is source of truth)
    const protectionMap: Record<string, boolean> = {};
    await Promise.all(rows.map(async (c) => {
      const { data: prot } = await supabase.rpc("is_protected_record", { _company_id: c.id });
      protectionMap[c.id] = !!prot;
    }));

    const enriched = rows.map(c => ({
      ...c,
      owner_name: c.owner_user_id ? profileMap[c.owner_user_id] || "—" : "—",
      is_protected: protectionMap[c.id] ?? false,
    }));

    setCompanies(enriched.filter(c => !c.deleted_at));
    setArchivedCompanies(enriched.filter(c => !!c.deleted_at));
    setLoading(false);
  }, []);

  // Load verification snapshot lazily when a row is expanded
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

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedArchived);
    if (ids.length === 0) return;
    setActionLoading(true);
    let success = 0;
    let failed = 0;
    const errors: string[] = [];
    for (const id of ids) {
      const company = archivedCompanies.find(c => c.id === id);
      if (!company || company.is_protected) { failed++; continue; }
      try {
        const { data, error } = await supabase.functions.invoke("manage-company", {
          body: { companyId: id, action: "delete", reason: "Bulk delete by system creator" },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        success++;
      } catch (err: any) {
        failed++;
        errors.push(`${company.name}: ${err.message || "failed"}`);
      }
    }
    if (success > 0) toast.success(`Deleted ${success} compan${success === 1 ? "y" : "ies"}.`);
    if (failed > 0) toast.error(`${failed} failed${errors.length ? `: ${errors.slice(0, 2).join("; ")}` : ""}`);
    setSelectedArchived(new Set());
    setBulkDeleteOpen(false);
    setBulkConfirmText("");
    setActionLoading(false);
    await loadCompanies();
  };

  const filtered = (status: string) =>
    companies.filter(c => {
      if (c.onboarding_status !== status) return false;
      const q = search.toLowerCase();
      return !q || c.name.toLowerCase().includes(q) || (c.owner_email ?? "").toLowerCase().includes(q);
    });

  const filteredArchived = () => archivedCompanies.filter(c => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || (c.owner_email ?? "").toLowerCase().includes(q);
  });

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

  // Actions dropdown — keeps the row compact instead of a button cluster.
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

  const ExpandableRow = ({ c, allowVerificationPanel }: { c: CompanyRecord; allowVerificationPanel: boolean }) => (
    <>
      <TableRow className="cursor-pointer" onClick={() => toggleExpand(c)}>
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
          <TableCell colSpan={7} className="p-4 bg-muted/20">
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

  const CompanyTableExpandable = ({ items, allowVerificationPanel }: { items: CompanyRecord[]; allowVerificationPanel: boolean }) => {
    if (items.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">No companies in this category.</p>;
    return (
      <Table>
        <TableHeader>
          <TableRow>
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
          {items.map(c => <ExpandableRow key={c.id} c={c} allowVerificationPanel={allowVerificationPanel} />)}
        </TableBody>
      </Table>
    );
  };

  const ArchivedTable = ({ items }: { items: CompanyRecord[] }) => {
    if (items.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">No archived companies.</p>;
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Owner Email</TableHead>
            <TableHead>Archived</TableHead>
            <TableHead>Eligible for purge</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(c => {
            const archivedAt = c.deleted_at ? new Date(c.deleted_at) : null;
            const purgeAt = archivedAt ? new Date(archivedAt.getTime() + RETENTION_YEARS * 365 * 24 * 60 * 60 * 1000) : null;
            return (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{renderCompanyName(c)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.owner_email || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {archivedAt ? format(archivedAt, "MMM d, yyyy") : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {purgeAt ? format(purgeAt, "MMM d, yyyy") : "—"}
                </TableCell>
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
          <p>Archived companies live in the Archived tab and can be restored. The 10-year purge runs after the eligibility date.</p>
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
        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending">
              Pending {filtered("pending_approval").length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px]">{filtered("pending_approval").length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="active">Active ({filtered("active").length})</TabsTrigger>
            <TabsTrigger value="awaiting_payment">
              Awaiting Payment {filtered("approved_pending_payment").length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px]">{filtered("approved_pending_payment").length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="suspended">
              Suspended {filtered("suspended").length > 0 && <Badge variant="destructive" className="ml-1.5 text-[10px]">{filtered("suspended").length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="rejected">Rejected ({filtered("rejected").length})</TabsTrigger>
            <TabsTrigger value="archived">Archived ({filteredArchived().length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card><CardContent className="pt-4"><CompanyTableExpandable items={filtered("pending_approval")} allowVerificationPanel /></CardContent></Card>
          </TabsContent>
          <TabsContent value="active">
            <Card><CardContent className="pt-4"><CompanyTableExpandable items={filtered("active")} allowVerificationPanel={false} /></CardContent></Card>
          </TabsContent>
          <TabsContent value="awaiting_payment">
            <Card><CardContent className="pt-4"><CompanyTableExpandable items={filtered("approved_pending_payment")} allowVerificationPanel={false} /></CardContent></Card>
          </TabsContent>
          <TabsContent value="suspended">
            <Card><CardContent className="pt-4"><CompanyTableExpandable items={filtered("suspended")} allowVerificationPanel={false} /></CardContent></Card>
          </TabsContent>
          <TabsContent value="rejected">
            <Card><CardContent className="pt-4"><CompanyTableExpandable items={filtered("rejected")} allowVerificationPanel={false} /></CardContent></Card>
          </TabsContent>
          <TabsContent value="archived">
            <Card><CardContent className="pt-4"><ArchivedTable items={filteredArchived()} /></CardContent></Card>
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

      {/* Delete / Archive Modal — single dialog, label flips by protection */}
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
    </CreatorLayout>
  );
}

// Read-only view of the verification snapshot captured at approval.
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

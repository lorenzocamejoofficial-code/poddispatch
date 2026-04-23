import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, Trash2, Loader2, ChevronDown, ChevronRight, Shield, Archive, RotateCcw } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { format } from "date-fns";
import { CreatorLayout } from "@/components/layout/CreatorLayout";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CompanyVerificationPanel, type VerificationResult } from "@/components/creator/CompanyVerificationPanel";
import { logAuditEvent } from "@/lib/audit-logger";

interface PendingCompany {
  id: string;
  name: string;
  owner_email: string | null;
  created_at: string;
  onboarding_status: string;
  owner_name?: string;
  npi_number?: string | null;
  state_of_operation?: string | null;
  current_software?: string | null;
  years_in_operation?: number | null;
  has_inhouse_biller?: boolean | null;
  hipaa_privacy_officer?: string | null;
  is_protected?: boolean;
  deleted_at?: string | null;
}

export default function PendingCompaniesAdmin() {
  const { isSystemCreator } = useAuth();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<PendingCompany[]>([]);
  const [archivedCompanies, setArchivedCompanies] = useState<PendingCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [showRejectInput, setShowRejectInput] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PendingCompany | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [verificationResults, setVerificationResults] = useState<Record<string, VerificationResult>>({});

  useEffect(() => {
    if (!isSystemCreator) { navigate("/"); return; }
    loadCompanies();
  }, [isSystemCreator, navigate]);

  const loadCompanies = async () => {
    setLoading(true);
    // Live + pending companies (excludes archived). System creator policy
    // still returns archived rows, so we filter explicitly.
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, owner_email, created_at, onboarding_status, owner_user_id, npi_number, state_of_operation, current_software, years_in_operation, has_inhouse_biller, hipaa_privacy_officer, deleted_at" as any)
      .in("onboarding_status", ["pending_approval", "approved_pending_payment", "rejected", "suspended"])
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) { console.error(error); setLoading(false); return; }

    const ownerIds = (data || []).map((c: any) => c.owner_user_id).filter(Boolean);
    let profileMap: Record<string, string> = {};
    if (ownerIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ownerIds);
      if (profiles) profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p.full_name]));
    }

    // Determine protection status per company in parallel.
    const companyIds = (data || []).map((c: any) => c.id);
    const protectionMap: Record<string, boolean> = {};
    await Promise.all(companyIds.map(async (id: string) => {
      const { data: prot } = await supabase.rpc("is_protected_record", { _company_id: id });
      protectionMap[id] = !!prot;
    }));

    setCompanies((data || []).map((c: any) => ({
      ...c,
      owner_name: c.owner_user_id ? profileMap[c.owner_user_id] || "—" : "—",
      is_protected: protectionMap[c.id] ?? false,
    })));

    // Archived companies (separate tab).
    const { data: archived } = await supabase
      .from("companies")
      .select("id, name, owner_email, created_at, onboarding_status, owner_user_id, deleted_at" as any)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });
    setArchivedCompanies(((archived as any[]) || []).map((c: any) => ({
      ...c,
      owner_name: c.owner_user_id ? profileMap[c.owner_user_id] || "—" : "—",
      is_protected: true,
    })));

    setLoading(false);
  };

  const logVerification = async (companyId: string, action: string) => {
    const vr = verificationResults[companyId];
    if (vr) {
      await logAuditEvent({
        action: action as any,
        tableName: "companies",
        recordId: companyId,
        newData: {
          verification_results: {
            npi: vr.npi,
            medicare: vr.medicare,
            oig: vr.oig,
          },
          decision: action,
        },
        notes: `Company ${action} with verification: NPI=${vr.npi.status}, Medicare=${vr.medicare.status}, OIG=${vr.oig.status}`,
      });
    }
  };

  const handleApprove = async (companyId: string) => {
    const vr = verificationResults[companyId];
    if (!vr) {
      toast.error("Run the verification panel first — expand the company row.");
      return;
    }
    if (vr.npi.status === "pending" || vr.medicare.status === "pending" || vr.oig.status === "pending") {
      toast.error("Verification still loading. Wait for all checks to complete.");
      return;
    }
    setActionLoading(companyId);
    try {
      const { data, error } = await supabase.functions.invoke("manage-company", {
        body: { companyId, action: "approve", verification: vr },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await logVerification(companyId, "approve");
      toast.success("Company approved and activated!");
      await loadCompanies();
    } catch (err: any) { toast.error(err.message || "Failed to approve"); }
    setActionLoading(null);
  };

  const handleReject = async (companyId: string) => {
    const reason = rejectReason[companyId]?.trim();
    if (!reason) { toast.error("Please provide a rejection reason."); return; }
    setActionLoading(companyId);
    try {
      const { data, error } = await supabase.functions.invoke("manage-company", { body: { companyId, action: "reject", reason } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await logVerification(companyId, "reject");
      toast.success("Company rejected.");
      setShowRejectInput(null);
      await loadCompanies();
    } catch (err: any) { toast.error(err.message || "Failed to reject"); }
    setActionLoading(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(deleteTarget.id);
    try {
      const { data, error } = await supabase.functions.invoke("manage-company", {
        body: {
          companyId: deleteTarget.id,
          action: "delete",  // edge function auto-routes to archive vs hard-delete
          reason: deleteReason || (deleteTarget.is_protected ? "Archived by system creator" : "Deleted by system creator"),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.archived) {
        toast.success(`Company "${deleteTarget.name}" archived. Data retained for legal compliance.`);
        if (data.stripe_cancel_status && !["cancelled", "no_subscription", "already_cancelled"].includes(data.stripe_cancel_status)) {
          toast.warning(`Stripe: ${data.stripe_cancel_status}`);
        }
      } else {
        toast.success(`Company "${deleteTarget.name}" permanently deleted.`);
      }
      setDeleteTarget(null);
      setDeleteConfirmText("");
      setDeleteReason("");
      await loadCompanies();
    } catch (err: any) { toast.error(err.message || "Failed to delete"); }
    setActionLoading(null);
  };

  const handleRestore = async (company: PendingCompany) => {
    setActionLoading(company.id);
    try {
      const { data, error } = await supabase.functions.invoke("manage-company", {
        body: { companyId: company.id, action: "restore_archived", reason: "Restored by system creator" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`"${company.name}" restored.`);
      await loadCompanies();
    } catch (err: any) { toast.error(err.message || "Failed to restore"); }
    setActionLoading(null);
  };

  // Every company in the active list is deletable now — the edge function
  // decides whether that means archive or hard-delete based on protection.
  const canDelete = () => true;

  const statusColor = (status: string) => {
    if (status === "pending_approval") return "bg-[hsl(var(--status-yellow))]/15 text-[hsl(var(--status-yellow))]";
    if (status === "approved_pending_payment") return "bg-primary/15 text-primary";
    if (status === "rejected") return "bg-destructive/15 text-destructive";
    return "bg-muted text-muted-foreground";
  };

  const toggleExpand = (id: string) => {
    setExpandedCompany(prev => prev === id ? null : id);
  };

  return (
    <CreatorLayout title="Pending Companies">
      <Collapsible className="mb-4">
        <CollapsibleTrigger className="text-xs text-primary hover:underline">ℹ️ How this works</CollapsibleTrigger>
        <CollapsibleContent className="mt-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
          <p>This page shows companies awaiting your approval. New signups land here with <strong>pending</strong> status.</p>
          <p>Click a company row to expand the <strong>Verification Panel</strong> with automated NPI, Medicare, and OIG checks.</p>
          <p>Approve to activate a company's workspace, or reject with a reason. Verification results are <strong>required</strong> at approval and snapshotted permanently.</p>
          <p>Companies showing a <Shield className="inline h-3 w-3 text-primary" /> shield are <strong>protected records</strong> — their data is under legal retention and the delete button archives instead of purging.</p>
          <p>All actions and verification results are logged for audit.</p>
        </CollapsibleContent>
      </Collapsible>
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active ({companies.length})</TabsTrigger>
          <TabsTrigger value="archived">Archived ({archivedCompanies.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Companies awaiting review</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : companies.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No pending companies. All clear! 🎉</p>
          ) : (
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
                {companies.map((c) => (
                  <>
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => toggleExpand(c.id)}>
                      <TableCell className="w-8">
                        {expandedCompany === c.id
                          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        }
                      </TableCell>
                      <TableCell className="font-medium">
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
                      </TableCell>
                      <TableCell>{c.owner_name}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{c.owner_email || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(c.created_at), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColor(c.onboarding_status)}>
                          {c.onboarding_status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {c.onboarding_status === "pending_approval" && (
                            <>
                              <Button size="sm" variant="default" className="gap-1.5" disabled={actionLoading === c.id} onClick={() => handleApprove(c.id)}>
                                {actionLoading === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Approve
                              </Button>
                              {showRejectInput === c.id ? (
                                <div className="flex flex-col gap-1.5 min-w-[200px]">
                                  <Textarea placeholder="Reason for rejection..." className="text-xs h-16" value={rejectReason[c.id] || ""} onChange={(e) => setRejectReason(prev => ({ ...prev, [c.id]: e.target.value }))} />
                                  <div className="flex gap-1.5">
                                    <Button size="sm" variant="destructive" className="gap-1 flex-1" disabled={actionLoading === c.id} onClick={() => handleReject(c.id)}>Confirm Reject</Button>
                                    <Button size="sm" variant="ghost" onClick={() => setShowRejectInput(null)}>Cancel</Button>
                                  </div>
                                </div>
                              ) : (
                                <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setShowRejectInput(c.id)}>
                                  <XCircle className="h-3 w-3" /> Reject
                                </Button>
                              )}
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={actionLoading === c.id}
                            onClick={() => { setDeleteTarget(c); setDeleteConfirmText(""); setDeleteReason(""); }}
                          >
                            {c.is_protected ? <Archive className="h-3 w-3" /> : <Trash2 className="h-3 w-3" />}
                            {c.is_protected ? "Archive" : "Delete"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedCompany === c.id && (
                      <TableRow key={`${c.id}-verify`}>
                        <TableCell colSpan={7} className="p-4 bg-muted/20">
                          <CompanyVerificationPanel
                            company={{
                              id: c.id,
                              name: c.name,
                              npi_number: c.npi_number || null,
                              state_of_operation: c.state_of_operation || null,
                              owner_email: c.owner_email,
                              current_software: c.current_software,
                              years_in_operation: c.years_in_operation,
                              has_inhouse_biller: c.has_inhouse_biller,
                              hipaa_privacy_officer: c.hipaa_privacy_officer,
                            }}
                            onVerificationComplete={(r) => setVerificationResults(prev => ({ ...prev, [c.id]: r }))}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="archived">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Archive className="h-4 w-4" /> Archived Companies — Legal Retention
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                Soft-deleted records preserved for regulatory retention (Georgia EMS: 10 years).
                Members can no longer access their data; the creator can read for audit/legal purposes.
                A future scheduled job will purge eligible records after the retention window expires.
              </p>
              {archivedCompanies.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No archived companies.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Archived</TableHead>
                      <TableHead>Eligible for purge</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {archivedCompanies.map((c) => {
                      const archivedAt = c.deleted_at ? new Date(c.deleted_at) : null;
                      const eligibleAt = archivedAt ? new Date(archivedAt.getTime() + 10 * 365 * 24 * 60 * 60 * 1000) : null;
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1.5">
                              <Shield className="h-3.5 w-3.5 text-primary" />
                              {c.name}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.owner_email || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {archivedAt ? format(archivedAt, "MMM d, yyyy") : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {eligibleAt ? format(eligibleAt, "MMM d, yyyy") : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1.5"
                              disabled={actionLoading === c.id}
                              onClick={() => handleRestore(c)}
                            >
                              {actionLoading === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                              Restore
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirmText(""); setDeleteReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleteTarget?.is_protected ? "Archive Company" : "Delete Company Permanently"}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.is_protected ? (
                <>
                  <strong>{deleteTarget?.name}</strong> is a <strong>protected record</strong> (verified at approval, or has submitted PCRs).
                  Their data will be soft-deleted and preserved for legal retention. Members will lose all access immediately,
                  and any active Stripe subscription will be cancelled.
                </>
              ) : (
                <>
                  This will permanently delete <strong>{deleteTarget?.name}</strong> and all associated data including memberships,
                  profiles, and the owner's auth account. This cannot be undone. The company has no verified approval and no submitted PCRs,
                  so deletion is safe.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              placeholder="Reason (optional, recorded in audit log)"
              className="text-xs h-16"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Type <strong>{deleteTarget?.name}</strong> to proceed:
            </p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={deleteTarget?.name || ""}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDeleteTarget(null); setDeleteConfirmText(""); setDeleteReason(""); }}>Cancel</Button>
            <Button
              variant={deleteTarget?.is_protected ? "default" : "destructive"}
              disabled={deleteConfirmText !== deleteTarget?.name || actionLoading === deleteTarget?.id}
              onClick={handleDelete}
            >
              {actionLoading === deleteTarget?.id ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
              {deleteTarget?.is_protected ? "Archive Company" : "Delete Forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CreatorLayout>
  );
}

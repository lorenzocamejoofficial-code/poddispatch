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
import { CheckCircle2, XCircle, Trash2, Loader2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { format } from "date-fns";
import { CreatorLayout } from "@/components/layout/CreatorLayout";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PendingCompany {
  id: string;
  name: string;
  owner_email: string | null;
  created_at: string;
  onboarding_status: string;
  owner_name?: string;
}

export default function PendingCompaniesAdmin() {
  const { isSystemCreator } = useAuth();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<PendingCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [showRejectInput, setShowRejectInput] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PendingCompany | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  useEffect(() => {
    if (!isSystemCreator) { navigate("/"); return; }
    loadCompanies();
  }, [isSystemCreator, navigate]);

  const loadCompanies = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, owner_email, created_at, onboarding_status, owner_user_id")
      .in("onboarding_status", ["pending_approval", "rejected", "suspended"])
      .order("created_at", { ascending: false });

    if (error) { console.error(error); setLoading(false); return; }

    const ownerIds = (data || []).map(c => c.owner_user_id).filter(Boolean);
    let profileMap: Record<string, string> = {};
    if (ownerIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ownerIds);
      if (profiles) profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p.full_name]));
    }

    setCompanies((data || []).map(c => ({ ...c, owner_name: c.owner_user_id ? profileMap[c.owner_user_id] || "—" : "—" })));
    setLoading(false);
  };

  const handleApprove = async (companyId: string) => {
    setActionLoading(companyId);
    try {
      const { data, error } = await supabase.functions.invoke("manage-company", { body: { companyId, action: "approve" } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
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
        body: { companyId: deleteTarget.id, action: "delete", reason: "Deleted by system creator" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Company "${deleteTarget.name}" permanently deleted.`);
      setDeleteTarget(null);
      setDeleteConfirmText("");
      await loadCompanies();
    } catch (err: any) { toast.error(err.message || "Failed to delete"); }
    setActionLoading(null);
  };

  const canDelete = (status: string) => status === "pending_approval" || status === "rejected";

  const statusColor = (status: string) => {
    if (status === "pending_approval") return "bg-[hsl(var(--status-yellow))]/15 text-[hsl(var(--status-yellow))]";
    if (status === "rejected") return "bg-destructive/15 text-destructive";
    return "bg-muted text-muted-foreground";
  };

  return (
    <CreatorLayout title="Pending Companies">
      <Collapsible className="mb-4">
        <CollapsibleTrigger className="text-xs text-primary hover:underline">ℹ️ How this works</CollapsibleTrigger>
        <CollapsibleContent className="mt-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
          <p>This page shows companies awaiting your approval. New signups land here with <strong>pending</strong> status.</p>
          <p>Approve to activate a company's workspace, or reject with a reason. You can also permanently delete pending/rejected companies.</p>
          <p>All actions are logged for audit. Approved companies move to the Company Console.</p>
        </CollapsibleContent>
      </Collapsible>
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
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.owner_name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{c.owner_email || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(c.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColor(c.onboarding_status)}>
                        {c.onboarding_status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
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
                        {canDelete(c.onboarding_status) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={actionLoading === c.id}
                            onClick={() => { setDeleteTarget(c); setDeleteConfirmText(""); }}
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirmText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Company Permanently</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong> and all associated data including memberships, profiles, and the owner's auth account. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Type <strong>CONFIRM</strong> to proceed:
            </p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="CONFIRM"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDeleteTarget(null); setDeleteConfirmText(""); }}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmText !== "CONFIRM" || actionLoading === deleteTarget?.id}
              onClick={handleDelete}
            >
              {actionLoading === deleteTarget?.id ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
              Delete Forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CreatorLayout>
  );
}
